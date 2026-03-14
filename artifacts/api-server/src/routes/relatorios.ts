import { Router, type IRouter } from "express";
import { eq, and, gte, lte, sql, count } from "drizzle-orm";
import { db, registrosTable, funcionariosTable, usinasTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate.js";

const router: IRouter = Router();

router.get("/relatorios/horas-funcionario", authenticate, async (req, res): Promise<void> => {
  const { dataInicio, dataFim, usinaId } = req.query as Record<string, string>;

  if (!dataInicio || !dataFim) {
    res.status(400).json({ error: "dataInicio e dataFim são obrigatórios" });
    return;
  }

  const conditions = [
    gte(registrosTable.dataHoraEntrada, new Date(dataInicio)),
    lte(registrosTable.dataHoraEntrada, new Date(dataFim)),
  ];
  if (usinaId) conditions.push(eq(registrosTable.usinaId, parseInt(usinaId)) as typeof conditions[0]);

  const data = await db
    .select({
      funcionarioId: funcionariosTable.id,
      funcionarioNome: funcionariosTable.nome,
      empresa: funcionariosTable.empresa,
      cargo: funcionariosTable.cargo,
      usinaNome: usinasTable.nome,
      totalMinutos: sql<number>`COALESCE(SUM(${registrosTable.totalMinutos}), 0)`,
      totalRegistros: count(registrosTable.id),
      diasTrabalhados: sql<number>`COUNT(DISTINCT DATE(${registrosTable.dataHoraEntrada}))`,
    })
    .from(registrosTable)
    .innerJoin(funcionariosTable, eq(registrosTable.funcionarioId, funcionariosTable.id))
    .innerJoin(usinasTable, eq(registrosTable.usinaId, usinasTable.id))
    .where(and(...(conditions as [typeof conditions[0], ...typeof conditions[]])))
    .groupBy(funcionariosTable.id, funcionariosTable.nome, funcionariosTable.empresa, funcionariosTable.cargo, usinasTable.nome)
    .orderBy(funcionariosTable.nome);

  res.json(data.map(d => ({
    ...d,
    totalHoras: (d.totalMinutos ?? 0) / 60,
  })));
});

router.get("/relatorios/horas-usina", authenticate, async (req, res): Promise<void> => {
  const { dataInicio, dataFim } = req.query as Record<string, string>;

  if (!dataInicio || !dataFim) {
    res.status(400).json({ error: "dataInicio e dataFim são obrigatórios" });
    return;
  }

  const data = await db
    .select({
      usinaId: usinasTable.id,
      usinaNome: usinasTable.nome,
      cidade: usinasTable.cidade,
      estado: usinasTable.estado,
      totalMinutos: sql<number>`COALESCE(SUM(${registrosTable.totalMinutos}), 0)`,
      totalRegistros: count(registrosTable.id),
      totalFuncionarios: sql<number>`COUNT(DISTINCT ${registrosTable.funcionarioId})`,
    })
    .from(registrosTable)
    .innerJoin(usinasTable, eq(registrosTable.usinaId, usinasTable.id))
    .where(and(
      gte(registrosTable.dataHoraEntrada, new Date(dataInicio)),
      lte(registrosTable.dataHoraEntrada, new Date(dataFim))
    ))
    .groupBy(usinasTable.id, usinasTable.nome, usinasTable.cidade, usinasTable.estado)
    .orderBy(usinasTable.nome);

  res.json(data.map(d => ({
    ...d,
    totalHoras: (d.totalMinutos ?? 0) / 60,
  })));
});

router.get("/relatorios/presenca", authenticate, async (req, res): Promise<void> => {
  const { dataInicio, dataFim, usinaId, funcionarioId } = req.query as Record<string, string>;

  if (!dataInicio || !dataFim) {
    res.status(400).json({ error: "dataInicio e dataFim são obrigatórios" });
    return;
  }

  const conditions = [
    gte(registrosTable.dataHoraEntrada, new Date(dataInicio)),
    lte(registrosTable.dataHoraEntrada, new Date(dataFim)),
  ];
  if (usinaId) conditions.push(eq(registrosTable.usinaId, parseInt(usinaId)) as typeof conditions[0]);
  if (funcionarioId) conditions.push(eq(registrosTable.funcionarioId, parseInt(funcionarioId)) as typeof conditions[0]);

  const data = await db
    .select({
      funcionarioId: funcionariosTable.id,
      funcionarioNome: funcionariosTable.nome,
      data: sql<string>`DATE(${registrosTable.dataHoraEntrada})`,
      usinaNome: usinasTable.nome,
      totalMinutos: sql<number>`COALESCE(SUM(${registrosTable.totalMinutos}), 0)`,
    })
    .from(registrosTable)
    .innerJoin(funcionariosTable, eq(registrosTable.funcionarioId, funcionariosTable.id))
    .innerJoin(usinasTable, eq(registrosTable.usinaId, usinasTable.id))
    .where(and(...(conditions as [typeof conditions[0], ...typeof conditions[]])))
    .groupBy(funcionariosTable.id, funcionariosTable.nome, sql`DATE(${registrosTable.dataHoraEntrada})`, usinasTable.nome)
    .orderBy(funcionariosTable.nome, sql`DATE(${registrosTable.dataHoraEntrada})`);

  res.json(data.map(d => ({
    funcionarioId: d.funcionarioId,
    funcionarioNome: d.funcionarioNome,
    data: d.data,
    presente: true,
    horasTrabalhadas: (d.totalMinutos ?? 0) / 60,
    usinaNome: d.usinaNome,
  })));
});

export default router;
