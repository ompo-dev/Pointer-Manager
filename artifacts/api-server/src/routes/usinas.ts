import { Router, type IRouter } from "express";
import { eq, and, sql, count } from "drizzle-orm";
import { db, usinasTable, funcionariosTable, registrosTable } from "@workspace/db";
import { CreateUsinaBody, UpdateUsinaBody, GetUsinaParams, UpdateUsinaParams, DeleteUsinaParams, GetUsinaQrcodeParams, GetUsinaFuncionariosParams } from "@workspace/api-zod";
import { authenticate, type AuthRequest } from "../middlewares/authenticate.js";
import { logAuditoria } from "../lib/auditoria.js";
import crypto from "crypto";

const router: IRouter = Router();

function buildUsinaResponse(usina: typeof usinasTable.$inferSelect, funcionariosAtivos: number, totalFuncionarios: number) {
  return {
    id: usina.id,
    nome: usina.nome,
    cidade: usina.cidade,
    estado: usina.estado,
    wifiAutorizado: usina.wifiAutorizado,
    horarioInicio: usina.horarioInicio,
    horarioFim: usina.horarioFim,
    ativo: usina.ativo,
    createdAt: usina.createdAt,
    funcionariosAtivos,
    totalFuncionarios,
  };
}

router.get("/usinas", authenticate, async (req, res): Promise<void> => {
  const usinas = await db.select().from(usinasTable).orderBy(usinasTable.nome);

  const result = await Promise.all(usinas.map(async (usina) => {
    const [ativosResult] = await db
      .select({ count: count() })
      .from(registrosTable)
      .where(and(eq(registrosTable.usinaId, usina.id), eq(registrosTable.status, "aberto")));
    const [totalResult] = await db
      .select({ count: count() })
      .from(funcionariosTable)
      .where(eq(funcionariosTable.usinaId, usina.id));

    return buildUsinaResponse(usina, ativosResult?.count ?? 0, totalResult?.count ?? 0);
  }));

  res.json(result);
});

router.post("/usinas", authenticate, async (req: AuthRequest, res): Promise<void> => {
  const parsed = CreateUsinaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const token = crypto.randomUUID();
  const [usina] = await db.insert(usinasTable).values({ ...parsed.data, token }).returning();
  await logAuditoria("CREATE_USINA", "usina", { entidadeId: usina.id, usuarioId: req.user!.id, usuarioNome: req.user!.nome, req });

  res.status(201).json(buildUsinaResponse(usina, 0, 0));
});

router.get("/usinas/:id", authenticate, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetUsinaParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [usina] = await db.select().from(usinasTable).where(eq(usinasTable.id, params.data.id));
  if (!usina) {
    res.status(404).json({ error: "Usina não encontrada" });
    return;
  }

  const [ativosResult] = await db
    .select({ count: count() })
    .from(registrosTable)
    .where(and(eq(registrosTable.usinaId, usina.id), eq(registrosTable.status, "aberto")));
  const [totalResult] = await db
    .select({ count: count() })
    .from(funcionariosTable)
    .where(eq(funcionariosTable.usinaId, usina.id));

  res.json(buildUsinaResponse(usina, ativosResult?.count ?? 0, totalResult?.count ?? 0));
});

router.patch("/usinas/:id", authenticate, async (req: AuthRequest, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateUsinaParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateUsinaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [usina] = await db.update(usinasTable).set(parsed.data).where(eq(usinasTable.id, params.data.id)).returning();
  if (!usina) {
    res.status(404).json({ error: "Usina não encontrada" });
    return;
  }

  await logAuditoria("UPDATE_USINA", "usina", { entidadeId: usina.id, usuarioId: req.user!.id, usuarioNome: req.user!.nome, req });
  res.json(buildUsinaResponse(usina, 0, 0));
});

router.delete("/usinas/:id", authenticate, async (req: AuthRequest, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteUsinaParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(usinasTable).where(eq(usinasTable.id, params.data.id));
  await logAuditoria("DELETE_USINA", "usina", { entidadeId: params.data.id, usuarioId: req.user!.id, usuarioNome: req.user!.nome, req });
  res.sendStatus(204);
});

router.get("/usinas/:id/qrcode", authenticate, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetUsinaQrcodeParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [usina] = await db.select().from(usinasTable).where(eq(usinasTable.id, params.data.id));
  if (!usina) {
    res.status(404).json({ error: "Usina não encontrada" });
    return;
  }

  const url = `/ponto/${usina.token}`;

  res.json({
    usinaId: usina.id,
    token: usina.token,
    url,
    qrcodeData: url,
  });
});

router.get("/usinas/:id/funcionarios", authenticate, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetUsinaFuncionariosParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

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
    .where(and(eq(registrosTable.usinaId, params.data.id), eq(registrosTable.status, "aberto")));

  const now = new Date();
  res.json(ativos.map(r => ({
    ...r,
    minutosNoLocal: Math.floor((now.getTime() - r.dataHoraEntrada.getTime()) / 60000),
  })));
});

export default router;
