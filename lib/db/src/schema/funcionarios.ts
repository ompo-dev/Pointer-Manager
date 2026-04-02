import { mysqlTable, text, serial, timestamp, int } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const funcionariosTable = mysqlTable("funcionarios", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  cpf: text("cpf").notNull().unique(),
  empresa: text("empresa").notNull(),
  cargo: text("cargo").notNull(),
  usinaId: int("usina_id"),
  telefone: text("telefone"),
  fotoUrl: text("foto_url"),
  status: text("status").notNull().default("ativo"),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { fsp: 3 })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertFuncionarioSchema = createInsertSchema(funcionariosTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFuncionario = z.infer<typeof insertFuncionarioSchema>;
export type Funcionario = typeof funcionariosTable.$inferSelect;
