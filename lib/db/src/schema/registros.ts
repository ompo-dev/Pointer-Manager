import { mysqlTable, text, serial, timestamp, int } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const registrosTable = mysqlTable("registros", {
  id: serial("id").primaryKey(),
  funcionarioId: int("funcionario_id").notNull(),
  usinaId: int("usina_id").notNull(),
  dataHoraEntrada: timestamp("data_hora_entrada", { fsp: 3 }).notNull().defaultNow(),
  dataHoraSaida: timestamp("data_hora_saida", { fsp: 3 }),
  totalMinutos: int("total_minutos"),
  ip: text("ip"),
  dispositivo: text("dispositivo"),
  status: text("status").notNull().default("aberto"),
  observacoes: text("observacoes"),
  fotoSelfieUrl: text("foto_selfie_url"),
  ajustadoPorId: int("ajustado_por_id"),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { fsp: 3 })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertRegistroSchema = createInsertSchema(registrosTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRegistro = z.infer<typeof insertRegistroSchema>;
export type Registro = typeof registrosTable.$inferSelect;
