import { mysqlTable, text, serial, timestamp, int, boolean } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usuariosTable = mysqlTable("usuarios", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  perfil: text("perfil").notNull().default("supervisor"),
  usinaId: int("usina_id"),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { fsp: 3 })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertUsuarioSchema = createInsertSchema(usuariosTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUsuario = z.infer<typeof insertUsuarioSchema>;
export type Usuario = typeof usuariosTable.$inferSelect;
