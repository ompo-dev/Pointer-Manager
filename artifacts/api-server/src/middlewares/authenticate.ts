import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/auth.js";
import { db, usuariosTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    perfil: string;
    nome: string;
    usinaId: number | null;
  };
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.token;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : cookieToken;

  if (!token) {
    res.status(401).json({ error: "Token não fornecido" });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Token inválido ou expirado" });
    return;
  }

  const [user] = await db.select().from(usuariosTable).where(eq(usuariosTable.id, payload.id));

  if (!user || !user.ativo) {
    res.status(401).json({ error: "Usuário não encontrado ou inativo" });
    return;
  }

  req.user = {
    id: user.id,
    email: user.email,
    perfil: user.perfil,
    nome: user.nome,
    usinaId: user.usinaId,
  };

  next();
}
