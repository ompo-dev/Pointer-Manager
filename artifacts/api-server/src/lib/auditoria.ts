import { db, auditoriaTable } from "@workspace/db";
import type { Request } from "express";

export async function logAuditoria(
  acao: string,
  entidade: string,
  options: {
    entidadeId?: number;
    usuarioId?: number;
    usuarioNome?: string;
    detalhes?: string;
    req?: Request;
  } = {}
) {
  try {
    const ip = options.req
      ? (options.req.headers["x-forwarded-for"] as string) || options.req.socket.remoteAddress || null
      : null;

    await db.insert(auditoriaTable).values({
      acao,
      entidade,
      entidadeId: options.entidadeId ?? null,
      usuarioId: options.usuarioId ?? null,
      usuarioNome: options.usuarioNome ?? null,
      detalhes: options.detalhes ?? null,
      ip,
    });
  } catch (err) {
    console.error("Auditoria error:", err);
  }
}
