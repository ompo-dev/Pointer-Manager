import { Router, type IRouter } from "express";
import { eq, and, ilike, or, gte, lte } from "drizzle-orm";
import { db, funcionariosTable, usinasTable, registrosTable } from "@workspace/db";
import { CreateFuncionarioBody, UpdateFuncionarioBody, GetFuncionarioParams, UpdateFuncionarioParams, DeleteFuncionarioParams, GetFuncionarioHistoricoParams } from "@workspace/api-zod";
import { authenticate, type AuthRequest } from "../middlewares/authenticate.js";
import { logAuditoria } from "../lib/auditoria.js";

const router: IRouter = Router();

router.get("/funcionarios", authenticate, async (req, res): Promise<void> => {
  const { search, usinaId, status } = req.query as Record<string, string>;

  const conditions = [];
  if (search) {
    conditions.push(or(
      ilike(funcionariosTable.nome, `%${search}%`),
      ilike(funcionariosTable.cpf, `%${search}%`),
      ilike(funcionariosTable.empresa, `%${search}%`)
    ));
  }
  if (usinaId) conditions.push(eq(funcionariosTable.usinaId, parseInt(usinaId)));
  if (status) conditions.push(eq(funcionariosTable.status, status));

  const funcionarios = await db
    .select({
      id: funcionariosTable.id,
      nome: funcionariosTable.nome,
      cpf: funcionariosTable.cpf,
      empresa: funcionariosTable.empresa,
      cargo: funcionariosTable.cargo,
      usinaId: funcionariosTable.usinaId,
      usinaNome: usinasTable.nome,
      telefone: funcionariosTable.telefone,
      fotoUrl: funcionariosTable.fotoUrl,
      status: funcionariosTable.status,
      createdAt: funcionariosTable.createdAt,
    })
    .from(funcionariosTable)
    .leftJoin(usinasTable, eq(funcionariosTable.usinaId, usinasTable.id))
    .where(conditions.length > 0 ? and(...(conditions as [typeof conditions[0], ...typeof conditions])) : undefined)
    .orderBy(funcionariosTable.nome);

  res.json(funcionarios);
});

router.post("/funcionarios", authenticate, async (req: AuthRequest, res): Promise<void> => {
  const parsed = CreateFuncionarioBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [funcionario] = await db.insert(funcionariosTable).values(parsed.data).returning();
  await logAuditoria("CREATE_FUNCIONARIO", "funcionario", { entidadeId: funcionario.id, usuarioId: req.user!.id, usuarioNome: req.user!.nome, req });

  const [withUsina] = await db
    .select({
      id: funcionariosTable.id,
      nome: funcionariosTable.nome,
      cpf: funcionariosTable.cpf,
      empresa: funcionariosTable.empresa,
      cargo: funcionariosTable.cargo,
      usinaId: funcionariosTable.usinaId,
      usinaNome: usinasTable.nome,
      telefone: funcionariosTable.telefone,
      fotoUrl: funcionariosTable.fotoUrl,
      status: funcionariosTable.status,
      createdAt: funcionariosTable.createdAt,
    })
    .from(funcionariosTable)
    .leftJoin(usinasTable, eq(funcionariosTable.usinaId, usinasTable.id))
    .where(eq(funcionariosTable.id, funcionario.id));

  res.status(201).json({ ...withUsina, usinaNome: withUsina.usinaNome ?? null });
});

router.get("/funcionarios/:id", authenticate, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetFuncionarioParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [funcionario] = await db
    .select({
      id: funcionariosTable.id,
      nome: funcionariosTable.nome,
      cpf: funcionariosTable.cpf,
      empresa: funcionariosTable.empresa,
      cargo: funcionariosTable.cargo,
      usinaId: funcionariosTable.usinaId,
      usinaNome: usinasTable.nome,
      telefone: funcionariosTable.telefone,
      fotoUrl: funcionariosTable.fotoUrl,
      status: funcionariosTable.status,
      createdAt: funcionariosTable.createdAt,
    })
    .from(funcionariosTable)
    .leftJoin(usinasTable, eq(funcionariosTable.usinaId, usinasTable.id))
    .where(eq(funcionariosTable.id, params.data.id));

  if (!funcionario) {
    res.status(404).json({ error: "Funcionário não encontrado" });
    return;
  }
  res.json({ ...funcionario, usinaNome: funcionario.usinaNome ?? null });
});

router.patch("/funcionarios/:id", authenticate, async (req: AuthRequest, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateFuncionarioParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateFuncionarioBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await db.update(funcionariosTable).set(parsed.data).where(eq(funcionariosTable.id, params.data.id));

  const [funcionario] = await db
    .select({
      id: funcionariosTable.id,
      nome: funcionariosTable.nome,
      cpf: funcionariosTable.cpf,
      empresa: funcionariosTable.empresa,
      cargo: funcionariosTable.cargo,
      usinaId: funcionariosTable.usinaId,
      usinaNome: usinasTable.nome,
      telefone: funcionariosTable.telefone,
      fotoUrl: funcionariosTable.fotoUrl,
      status: funcionariosTable.status,
      createdAt: funcionariosTable.createdAt,
    })
    .from(funcionariosTable)
    .leftJoin(usinasTable, eq(funcionariosTable.usinaId, usinasTable.id))
    .where(eq(funcionariosTable.id, params.data.id));

  if (!funcionario) {
    res.status(404).json({ error: "Funcionário não encontrado" });
    return;
  }

  await logAuditoria("UPDATE_FUNCIONARIO", "funcionario", { entidadeId: params.data.id, usuarioId: req.user!.id, usuarioNome: req.user!.nome, req });
  res.json({ ...funcionario, usinaNome: funcionario.usinaNome ?? null });
});

router.delete("/funcionarios/:id", authenticate, async (req: AuthRequest, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteFuncionarioParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(funcionariosTable).where(eq(funcionariosTable.id, params.data.id));
  await logAuditoria("DELETE_FUNCIONARIO", "funcionario", { entidadeId: params.data.id, usuarioId: req.user!.id, usuarioNome: req.user!.nome, req });
  res.sendStatus(204);
});

router.get("/funcionarios/:id/historico", authenticate, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetFuncionarioHistoricoParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { dataInicio, dataFim } = req.query as Record<string, string>;

  const conditions: ReturnType<typeof eq>[] = [eq(registrosTable.funcionarioId, params.data.id) as ReturnType<typeof eq>];
  if (dataInicio) conditions.push(gte(registrosTable.dataHoraEntrada, new Date(dataInicio)) as ReturnType<typeof eq>);
  if (dataFim) conditions.push(lte(registrosTable.dataHoraEntrada, new Date(dataFim)) as ReturnType<typeof eq>);

  const registros = await db
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
    .where(and(...(conditions as [typeof conditions[0], ...typeof conditions[]])))
    .orderBy(registrosTable.dataHoraEntrada);

  res.json(registros);
});

export default router;
