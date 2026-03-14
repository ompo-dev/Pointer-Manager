import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const registrosTable = pgTable("registros", {
  id: serial("id").primaryKey(),
  funcionarioId: integer("funcionario_id").notNull(),
  usinaId: integer("usina_id").notNull(),
  dataHoraEntrada: timestamp("data_hora_entrada", { withTimezone: true }).notNull().defaultNow(),
  dataHoraSaida: timestamp("data_hora_saida", { withTimezone: true }),
  totalMinutos: integer("total_minutos"),
  ip: text("ip"),
  dispositivo: text("dispositivo"),
  status: text("status").notNull().default("aberto"),
  observacoes: text("observacoes"),
  fotoSelfieUrl: text("foto_selfie_url"),
  ajustadoPorId: integer("ajustado_por_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertRegistroSchema = createInsertSchema(registrosTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRegistro = z.infer<typeof insertRegistroSchema>;
export type Registro = typeof registrosTable.$inferSelect;
