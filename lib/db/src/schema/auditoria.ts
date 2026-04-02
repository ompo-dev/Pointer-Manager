import { mysqlTable, text, serial, timestamp, int } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const auditoriaTable = mysqlTable("auditoria", {
  id: serial("id").primaryKey(),
  acao: text("acao").notNull(),
  entidade: text("entidade").notNull(),
  entidadeId: int("entidade_id"),
  usuarioId: int("usuario_id"),
  usuarioNome: text("usuario_nome"),
  detalhes: text("detalhes"),
  ip: text("ip"),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
});

export const insertAuditoriaSchema = createInsertSchema(auditoriaTable).omit({ id: true, createdAt: true });
export type InsertAuditoria = z.infer<typeof insertAuditoriaSchema>;
export type Auditoria = typeof auditoriaTable.$inferSelect;
