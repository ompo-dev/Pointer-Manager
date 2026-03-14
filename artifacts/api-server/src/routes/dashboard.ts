import { Router, type IRouter } from "express";
import { eq, and, gte, count, sql } from "drizzle-orm";
import { db, registrosTable, funcionariosTable, usinasTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate.js";

const router: IRouter = Router();

router.get("/dashboard", authenticate, async (_req, res): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [{ funcionariosAtivos }] = await db
    .select({ funcionariosAtivos: count() })
    .from(registrosTable)
    .where(eq(registrosTable.status, "aberto"));

  const [{ registrosHoje }] = await db
    .select({ registrosHoje: count() })
    .from(registrosTable)
    .where(gte(registrosTable.dataHoraEntrada, today));

  const [{ semSaida }] = await db
    .select({ semSaida: count() })
    .from(registrosTable)
    .where(eq(registrosTable.status, "aberto"));

  const [{ totalUsinas }] = await db
    .select({ totalUsinas: count() })
    .from(usinasTable)
    .where(eq(usinasTable.ativo, true));

  const usinas = await db.select().from(usinasTable).where(eq(usinasTable.ativo, true));

  const usinaStats = await Promise.all(usinas.map(async (usina) => {
    const [{ funcionariosAtivosUsina }] = await db
      .select({ funcionariosAtivosUsina: count() })
      .from(registrosTable)
      .where(and(eq(registrosTable.usinaId, usina.id), eq(registrosTable.status, "aberto")));

    const [{ totalRegistrosHoje }] = await db
      .select({ totalRegistrosHoje: count() })
      .from(registrosTable)
      .where(and(eq(registrosTable.usinaId, usina.id), gte(registrosTable.dataHoraEntrada, today)));

    const horasResult = await db
      .select({ totalMinutos: sql<number>`COALESCE(SUM(${registrosTable.totalMinutos}), 0)` })
      .from(registrosTable)
      .where(and(eq(registrosTable.usinaId, usina.id), gte(registrosTable.dataHoraEntrada, today)));

    return {
      usinaId: usina.id,
      usinaNome: usina.nome,
      funcionariosAtivos: funcionariosAtivosUsina,
      horasTrabalhadasHoje: (horasResult[0]?.totalMinutos ?? 0) / 60,
      totalRegistrosHoje,
    };
  }));

  const alertasRaw = await db
    .select({
      registroId: registrosTable.id,
      funcionarioNome: funcionariosTable.nome,
      usinaNome: usinasTable.nome,
      dataHoraEntrada: registrosTable.dataHoraEntrada,
    })
    .from(registrosTable)
    .innerJoin(funcionariosTable, eq(registrosTable.funcionarioId, funcionariosTable.id))
    .innerJoin(usinasTable, eq(registrosTable.usinaId, usinasTable.id))
    .where(eq(registrosTable.status, "aberto"));

  const now = new Date();
  const alertas = alertasRaw
    .filter(r => (now.getTime() - r.dataHoraEntrada.getTime()) > 9 * 60 * 60 * 1000)
    .map(r => ({
      tipo: "ponto_em_aberto",
      mensagem: `${r.funcionarioNome} está há mais de 9h sem registrar saída`,
      funcionarioNome: r.funcionarioNome,
      usinaNome: r.usinaNome,
      registroId: r.registroId,
      horasNoLocal: (now.getTime() - r.dataHoraEntrada.getTime()) / 3600000,
    }));

  const recenteRegistros = await db
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
    .where(eq(registrosTable.status, "aberto"))
    .limit(10);

  res.json({
    funcionariosAtivos,
    registrosHoje,
    semSaida,
    totalUsinas,
    usinaStats,
    alertas,
    recenteRegistros: recenteRegistros.map(r => ({
      ...r,
      minutosNoLocal: Math.floor((now.getTime() - r.dataHoraEntrada.getTime()) / 60000),
    })),
  });
});

export default router;
