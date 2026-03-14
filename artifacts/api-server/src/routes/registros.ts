import { Router, type IRouter } from "express";
import { eq, and, gte, lte, desc, count, sql } from "drizzle-orm";
import { db, registrosTable, funcionariosTable, usinasTable } from "@workspace/db";
import {
  RegistrarEntradaBody, RegistrarSaidaBody, AjustarRegistroBody,
  GetRegistroParams, AjustarRegistroParams, EncerrarRegistroParams
} from "@workspace/api-zod";
import { authenticate, type AuthRequest } from "../middlewares/authenticate.js";
import { logAuditoria } from "../lib/auditoria.js";

const router: IRouter = Router();

function getClientIp(req: import("express").Request): string {
  return (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "";
}

function ipInRange(ip: string, cidr: string): boolean {
  if (cidr.includes("/")) {
    try {
      const [range, bits] = cidr.split("/");
      const mask = ~((1 << (32 - parseInt(bits))) - 1) >>> 0;
      const ipNum = ip.split(".").reduce((acc, oct) => (acc << 8) + parseInt(oct), 0) >>> 0;
      const rangeNum = range.split(".").reduce((acc, oct) => (acc << 8) + parseInt(oct), 0) >>> 0;
      return (ipNum & mask) === (rangeNum & mask);
    } catch { return false; }
  }
  return ip === cidr || cidr === "0.0.0.0" || cidr === "any";
}

const buildRegistroResponse = (r: {
  id: number;
  funcionarioId: number;
  funcionarioNome: string;
  funcionarioCpf: string;
  usinaId: number;
  usinaNome: string;
  dataHoraEntrada: Date;
  dataHoraSaida: Date | null;
  totalMinutos: number | null;
  ip: string | null;
  dispositivo: string | null;
  status: string;
  observacoes: string | null;
  fotoSelfieUrl: string | null;
  createdAt: Date;
}) => ({ ...r });

router.get("/registros/ativos", authenticate, async (req, res): Promise<void> => {
  const { usinaId } = req.query as Record<string, string>;

  const conditions = [eq(registrosTable.status, "aberto")];
  if (usinaId) conditions.push(eq(registrosTable.usinaId, parseInt(usinaId)) as typeof conditions[0]);

  const ativos = await db
    .select({
      registroId: registrosTable.id,
      funcionarioId: funcionariosTable.id,
      funcionarioNome: funcionariosTable.nome,
      funcionarioCpf: funcionariosTable.cpf,
      funcionarioCargo: funcionariosTable.cargo,
      funcionarioFotoUrl: funcionariosTable.fotoUrl,
      usinaId: usinasTable.id,
      usinaNome: usinasTable.nome,
      dataHoraEntrada: registrosTable.dataHoraEntrada,
    })
    .from(registrosTable)
    .innerJoin(funcionariosTable, eq(registrosTable.funcionarioId, funcionariosTable.id))
    .innerJoin(usinasTable, eq(registrosTable.usinaId, usinasTable.id))
    .where(and(...(conditions as [typeof conditions[0], ...typeof conditions[]])))
    .orderBy(desc(registrosTable.dataHoraEntrada));

  const now = new Date();
  res.json(ativos.map(r => ({
    ...r,
    minutosNoLocal: Math.floor((now.getTime() - r.dataHoraEntrada.getTime()) / 60000),
  })));
});

router.post("/registros/registro-entrada", async (req, res): Promise<void> => {
  const parsed = RegistrarEntradaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { cpf, usinaToken, fotoSelfieUrl, dispositivo } = parsed.data;
  const clientIp = getClientIp(req);

  const [usina] = await db.select().from(usinasTable).where(eq(usinasTable.token, usinaToken));
  if (!usina) {
    res.status(400).json({ error: "Token de usina inválido" });
    return;
  }

  const wifiOk = usina.wifiAutorizado === "any" || ipInRange(clientIp, usina.wifiAutorizado);
  if (!wifiOk) {
    res.status(403).json({ error: `Acesso negado. Você precisa estar conectado ao Wi-Fi da usina ${usina.nome}. IP detectado: ${clientIp}` });
    return;
  }

  const [funcionario] = await db.select().from(funcionariosTable).where(eq(funcionariosTable.cpf, cpf.replace(/\D/g, "")));
  if (!funcionario) {
    res.status(400).json({ error: "Funcionário não encontrado com esse CPF" });
    return;
  }

  const [existente] = await db.select().from(registrosTable).where(
    and(eq(registrosTable.funcionarioId, funcionario.id), eq(registrosTable.status, "aberto"))
  );
  if (existente) {
    res.status(400).json({ error: "Funcionário já tem um registro em aberto" });
    return;
  }

  const [registro] = await db.insert(registrosTable).values({
    funcionarioId: funcionario.id,
    usinaId: usina.id,
    ip: clientIp,
    dispositivo: dispositivo ?? null,
    fotoSelfieUrl: fotoSelfieUrl ?? null,
    status: "aberto",
  }).returning();

  res.status(201).json(buildRegistroResponse({
    id: registro.id,
    funcionarioId: funcionario.id,
    funcionarioNome: funcionario.nome,
    funcionarioCpf: funcionario.cpf,
    usinaId: usina.id,
    usinaNome: usina.nome,
    dataHoraEntrada: registro.dataHoraEntrada,
    dataHoraSaida: registro.dataHoraSaida ?? null,
    totalMinutos: registro.totalMinutos ?? null,
    ip: registro.ip,
    dispositivo: registro.dispositivo,
    status: registro.status,
    observacoes: registro.observacoes,
    fotoSelfieUrl: registro.fotoSelfieUrl,
    createdAt: registro.createdAt,
  }));
});

router.post("/registros/registro-saida", async (req, res): Promise<void> => {
  const parsed = RegistrarSaidaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { cpf, usinaToken } = parsed.data;

  const [usina] = await db.select().from(usinasTable).where(eq(usinasTable.token, usinaToken));
  if (!usina) {
    res.status(400).json({ error: "Token de usina inválido" });
    return;
  }

  const [funcionario] = await db.select().from(funcionariosTable).where(eq(funcionariosTable.cpf, cpf.replace(/\D/g, "")));
  if (!funcionario) {
    res.status(400).json({ error: "Funcionário não encontrado" });
    return;
  }

  const [registro] = await db.select().from(registrosTable).where(
    and(
      eq(registrosTable.funcionarioId, funcionario.id),
      eq(registrosTable.usinaId, usina.id),
      eq(registrosTable.status, "aberto")
    )
  );

  if (!registro) {
    res.status(400).json({ error: "Nenhum registro em aberto encontrado para este funcionário nesta usina" });
    return;
  }

  const agora = new Date();
  const totalMinutos = Math.floor((agora.getTime() - registro.dataHoraEntrada.getTime()) / 60000);

  const [updated] = await db.update(registrosTable).set({
    dataHoraSaida: agora,
    totalMinutos,
    status: "finalizado",
  }).where(eq(registrosTable.id, registro.id)).returning();

  res.json(buildRegistroResponse({
    id: updated.id,
    funcionarioId: funcionario.id,
    funcionarioNome: funcionario.nome,
    funcionarioCpf: funcionario.cpf,
    usinaId: usina.id,
    usinaNome: usina.nome,
    dataHoraEntrada: updated.dataHoraEntrada,
    dataHoraSaida: updated.dataHoraSaida ?? null,
    totalMinutos: updated.totalMinutos ?? null,
    ip: updated.ip,
    dispositivo: updated.dispositivo,
    status: updated.status,
    observacoes: updated.observacoes,
    fotoSelfieUrl: updated.fotoSelfieUrl,
    createdAt: updated.createdAt,
  }));
});

router.get("/registros", authenticate, async (req, res): Promise<void> => {
  const { usinaId, funcionarioId, dataInicio, dataFim, status, page: pageStr, limit: limitStr } = req.query as Record<string, string>;
  const page = parseInt(pageStr ?? "1");
  const limit = parseInt(limitStr ?? "20");
  const offset = (page - 1) * limit;

  const conditions = [];
  if (usinaId) conditions.push(eq(registrosTable.usinaId, parseInt(usinaId)));
  if (funcionarioId) conditions.push(eq(registrosTable.funcionarioId, parseInt(funcionarioId)));
  if (dataInicio) conditions.push(gte(registrosTable.dataHoraEntrada, new Date(dataInicio)));
  if (dataFim) conditions.push(lte(registrosTable.dataHoraEntrada, new Date(dataFim)));
  if (status) conditions.push(eq(registrosTable.status, status));

  const whereClause = conditions.length > 0 ? and(...(conditions as [typeof conditions[0], ...typeof conditions[]])) : undefined;

  const [{ total }] = await db.select({ total: count() }).from(registrosTable).where(whereClause);

  const data = await db
    .select({
      id: registrosTable.id,
      funcionarioId: funcionariosTable.id,
      funcionarioNome: funcionariosTable.nome,
      funcionarioCpf: funcionariosTable.cpf,
      usinaId: usinasTable.id,
      usinaNome: usinasTable.nome,
      dataHoraEntrada: registrosTable.dataHoraEntrada,
      dataHoraSaida: registrosTable.dataHoraSaida,
      totalMinutos: registrosTable.totalMinutos,
      ip: registrosTable.ip,
      dispositivo: registrosTable.dispositivo,
      status: registrosTable.status,
      observacoes: registrosTable.observacoes,
      fotoSelfieUrl: registrosTable.fotoSelfieUrl,
      createdAt: registrosTable.createdAt,
    })
    .from(registrosTable)
    .innerJoin(funcionariosTable, eq(registrosTable.funcionarioId, funcionariosTable.id))
    .innerJoin(usinasTable, eq(registrosTable.usinaId, usinasTable.id))
    .where(whereClause)
    .orderBy(desc(registrosTable.dataHoraEntrada))
    .limit(limit)
    .offset(offset);

  res.json({ data, total, page, limit });
});

router.get("/registros/:id", authenticate, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetRegistroParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [registro] = await db
    .select({
      id: registrosTable.id,
      funcionarioId: funcionariosTable.id,
      funcionarioNome: funcionariosTable.nome,
      funcionarioCpf: funcionariosTable.cpf,
      usinaId: usinasTable.id,
      usinaNome: usinasTable.nome,
      dataHoraEntrada: registrosTable.dataHoraEntrada,
      dataHoraSaida: registrosTable.dataHoraSaida,
      totalMinutos: registrosTable.totalMinutos,
      ip: registrosTable.ip,
      dispositivo: registrosTable.dispositivo,
      status: registrosTable.status,
      observacoes: registrosTable.observacoes,
      fotoSelfieUrl: registrosTable.fotoSelfieUrl,
      createdAt: registrosTable.createdAt,
    })
    .from(registrosTable)
    .innerJoin(funcionariosTable, eq(registrosTable.funcionarioId, funcionariosTable.id))
    .innerJoin(usinasTable, eq(registrosTable.usinaId, usinasTable.id))
    .where(eq(registrosTable.id, params.data.id));

  if (!registro) {
    res.status(404).json({ error: "Registro não encontrado" });
    return;
  }

  res.json(registro);
});

router.patch("/registros/:id", authenticate, async (req: AuthRequest, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = AjustarRegistroParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = AjustarRegistroBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {
    observacoes: parsed.data.observacoes,
    status: "ajustado",
    ajustadoPorId: req.user!.id,
  };
  if (parsed.data.dataHoraEntrada) updateData.dataHoraEntrada = new Date(parsed.data.dataHoraEntrada);
  if (parsed.data.dataHoraSaida) {
    updateData.dataHoraSaida = new Date(parsed.data.dataHoraSaida);
    if (updateData.dataHoraEntrada || parsed.data.dataHoraEntrada) {
      const entrada = new Date((updateData.dataHoraEntrada as Date) || parsed.data.dataHoraEntrada!);
      const saida = new Date(parsed.data.dataHoraSaida);
      updateData.totalMinutos = Math.floor((saida.getTime() - entrada.getTime()) / 60000);
    }
  }

  const [updated] = await db.update(registrosTable).set(updateData).where(eq(registrosTable.id, params.data.id)).returning();
  if (!updated) {
    res.status(404).json({ error: "Registro não encontrado" });
    return;
  }

  await logAuditoria("AJUSTE_PONTO", "registro", { entidadeId: updated.id, usuarioId: req.user!.id, usuarioNome: req.user!.nome, detalhes: parsed.data.observacoes, req });

  const [funcionario] = await db.select().from(funcionariosTable).where(eq(funcionariosTable.id, updated.funcionarioId));
  const [usina] = await db.select().from(usinasTable).where(eq(usinasTable.id, updated.usinaId));

  res.json(buildRegistroResponse({
    id: updated.id,
    funcionarioId: funcionario?.id ?? updated.funcionarioId,
    funcionarioNome: funcionario?.nome ?? "",
    funcionarioCpf: funcionario?.cpf ?? "",
    usinaId: usina?.id ?? updated.usinaId,
    usinaNome: usina?.nome ?? "",
    dataHoraEntrada: updated.dataHoraEntrada,
    dataHoraSaida: updated.dataHoraSaida ?? null,
    totalMinutos: updated.totalMinutos ?? null,
    ip: updated.ip,
    dispositivo: updated.dispositivo,
    status: updated.status,
    observacoes: updated.observacoes,
    fotoSelfieUrl: updated.fotoSelfieUrl,
    createdAt: updated.createdAt,
  }));
});

router.post("/registros/:id/encerrar", authenticate, async (req: AuthRequest, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = EncerrarRegistroParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [registro] = await db.select().from(registrosTable).where(eq(registrosTable.id, params.data.id));
  if (!registro) {
    res.status(404).json({ error: "Registro não encontrado" });
    return;
  }

  const agora = new Date();
  const totalMinutos = Math.floor((agora.getTime() - registro.dataHoraEntrada.getTime()) / 60000);

  const [updated] = await db.update(registrosTable).set({
    dataHoraSaida: agora,
    totalMinutos,
    status: "finalizado",
    ajustadoPorId: req.user!.id,
    observacoes: "Encerrado manualmente pelo administrador",
  }).where(eq(registrosTable.id, params.data.id)).returning();

  await logAuditoria("ENCERRAR_PONTO", "registro", { entidadeId: updated.id, usuarioId: req.user!.id, usuarioNome: req.user!.nome, req });

  const [funcionario] = await db.select().from(funcionariosTable).where(eq(funcionariosTable.id, updated.funcionarioId));
  const [usina] = await db.select().from(usinasTable).where(eq(usinasTable.id, updated.usinaId));

  res.json(buildRegistroResponse({
    id: updated.id,
    funcionarioId: funcionario?.id ?? updated.funcionarioId,
    funcionarioNome: funcionario?.nome ?? "",
    funcionarioCpf: funcionario?.cpf ?? "",
    usinaId: usina?.id ?? updated.usinaId,
    usinaNome: usina?.nome ?? "",
    dataHoraEntrada: updated.dataHoraEntrada,
    dataHoraSaida: updated.dataHoraSaida ?? null,
    totalMinutos: updated.totalMinutos ?? null,
    ip: updated.ip,
    dispositivo: updated.dispositivo,
    status: updated.status,
    observacoes: updated.observacoes,
    fotoSelfieUrl: updated.fotoSelfieUrl,
    createdAt: updated.createdAt,
  }));
});

export default router;
