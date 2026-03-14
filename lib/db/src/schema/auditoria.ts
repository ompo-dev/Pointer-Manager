import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const auditoriaTable = pgTable("auditoria", {
  id: serial("id").primaryKey(),
  acao: text("acao").notNull(),
  entidade: text("entidade").notNull(),
  entidadeId: integer("entidade_id"),
  usuarioId: integer("usuario_id"),
  usuarioNome: text("usuario_nome"),
  detalhes: text("detalhes"),
  ip: text("ip"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAuditoriaSchema = createInsertSchema(auditoriaTable).omit({ id: true, createdAt: true });
export type InsertAuditoria = z.infer<typeof insertAuditoriaSchema>;
export type Auditoria = typeof auditoriaTable.$inferSelect;
