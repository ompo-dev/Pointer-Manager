import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const funcionariosTable = pgTable("funcionarios", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  cpf: text("cpf").notNull().unique(),
  empresa: text("empresa").notNull(),
  cargo: text("cargo").notNull(),
  usinaId: integer("usina_id"),
  telefone: text("telefone"),
  fotoUrl: text("foto_url"),
  status: text("status").notNull().default("ativo"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertFuncionarioSchema = createInsertSchema(funcionariosTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFuncionario = z.infer<typeof insertFuncionarioSchema>;
export type Funcionario = typeof funcionariosTable.$inferSelect;
