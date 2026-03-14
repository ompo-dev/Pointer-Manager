import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usinasTable = pgTable("usinas", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  cidade: text("cidade").notNull(),
  estado: text("estado").notNull(),
  wifiAutorizado: text("wifi_autorizado").notNull(),
  horarioInicio: text("horario_inicio").notNull().default("07:00"),
  horarioFim: text("horario_fim").notNull().default("18:00"),
  token: text("token").notNull().unique(),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUsinaSchema = createInsertSchema(usinasTable).omit({ id: true, createdAt: true, updatedAt: true, token: true });
export type InsertUsina = z.infer<typeof insertUsinaSchema>;
export type Usina = typeof usinasTable.$inferSelect;
