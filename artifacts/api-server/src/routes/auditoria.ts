import { Router, type IRouter } from "express";
import { eq, count, desc } from "drizzle-orm";
import { db, auditoriaTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate.js";

const router: IRouter = Router();

router.get("/auditoria", authenticate, async (req, res): Promise<void> => {
  const { page: pageStr, limit: limitStr, acao } = req.query as Record<string, string>;
  const page = parseInt(pageStr ?? "1");
  const limit = parseInt(limitStr ?? "50");
  const offset = (page - 1) * limit;

  const whereClause = acao ? eq(auditoriaTable.acao, acao) : undefined;

  const [{ total }] = await db.select({ total: count() }).from(auditoriaTable).where(whereClause);

  const data = await db
    .select()
    .from(auditoriaTable)
    .where(whereClause)
    .orderBy(desc(auditoriaTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json({ data, total, page, limit });
});

export default router;
