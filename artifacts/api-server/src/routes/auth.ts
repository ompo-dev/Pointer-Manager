import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usuariosTable } from "@workspace/db";
import { LoginBody, CreateUsuarioBody, UpdateUsuarioBody, UpdateUsuarioParams, DeleteUsuarioParams } from "@workspace/api-zod";
import { hashPassword, comparePassword, signToken } from "../lib/auth.js";
import { authenticate, type AuthRequest } from "../middlewares/authenticate.js";
import { logAuditoria } from "../lib/auditoria.js";

const router: IRouter = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db.select().from(usuariosTable).where(eq(usuariosTable.email, parsed.data.email));
  if (!user || !user.ativo) {
    res.status(401).json({ error: "Email ou senha inválidos" });
    return;
  }

  if (!comparePassword(parsed.data.password, user.passwordHash)) {
    res.status(401).json({ error: "Email ou senha inválidos" });
    return;
  }

  const token = signToken({ id: user.id, email: user.email, perfil: user.perfil });
  res.cookie("token", token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });

  await logAuditoria("LOGIN", "usuario", { entidadeId: user.id, usuarioId: user.id, usuarioNome: user.nome, req });

  res.json({
    user: {
      id: user.id,
      nome: user.nome,
      email: user.email,
      perfil: user.perfil,
      usinaId: user.usinaId,
      ativo: user.ativo,
      createdAt: user.createdAt,
    },
    token,
  });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  res.clearCookie("token");
  res.json({ success: true });
});

router.get("/auth/me", authenticate, async (req: AuthRequest, res): Promise<void> => {
  const user = req.user!;
  const [dbUser] = await db.select().from(usuariosTable).where(eq(usuariosTable.id, user.id));
  if (!dbUser) {
    res.status(401).json({ error: "Usuário não encontrado" });
    return;
  }
  res.json({
    id: dbUser.id,
    nome: dbUser.nome,
    email: dbUser.email,
    perfil: dbUser.perfil,
    usinaId: dbUser.usinaId,
    ativo: dbUser.ativo,
    createdAt: dbUser.createdAt,
  });
});

router.get("/usuarios", authenticate, async (_req, res): Promise<void> => {
  const users = await db.select().from(usuariosTable).orderBy(usuariosTable.nome);
  res.json(users.map(u => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    perfil: u.perfil,
    usinaId: u.usinaId,
    ativo: u.ativo,
    createdAt: u.createdAt,
  })));
});

router.post("/usuarios", authenticate, async (req: AuthRequest, res): Promise<void> => {
  const parsed = CreateUsuarioBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { password, ...rest } = parsed.data;
  const passwordHash = hashPassword(password);

  const [user] = await db.insert(usuariosTable).values({ ...rest, passwordHash, usinaId: rest.usinaId ?? null }).returning();
  await logAuditoria("CREATE_USUARIO", "usuario", { entidadeId: user.id, usuarioId: req.user!.id, usuarioNome: req.user!.nome, req });

  res.status(201).json({
    id: user.id,
    nome: user.nome,
    email: user.email,
    perfil: user.perfil,
    usinaId: user.usinaId,
    ativo: user.ativo,
    createdAt: user.createdAt,
  });
});

router.patch("/usuarios/:id", authenticate, async (req: AuthRequest, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateUsuarioParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateUsuarioBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { password, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = { ...rest };
  if (password) {
    updateData.passwordHash = hashPassword(password);
  }

  const [user] = await db.update(usuariosTable).set(updateData).where(eq(usuariosTable.id, params.data.id)).returning();
  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }

  await logAuditoria("UPDATE_USUARIO", "usuario", { entidadeId: user.id, usuarioId: req.user!.id, usuarioNome: req.user!.nome, req });

  res.json({
    id: user.id,
    nome: user.nome,
    email: user.email,
    perfil: user.perfil,
    usinaId: user.usinaId,
    ativo: user.ativo,
    createdAt: user.createdAt,
  });
});

router.delete("/usuarios/:id", authenticate, async (req: AuthRequest, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteUsuarioParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(usuariosTable).where(eq(usuariosTable.id, params.data.id));
  await logAuditoria("DELETE_USUARIO", "usuario", { entidadeId: params.data.id, usuarioId: req.user!.id, usuarioNome: req.user!.nome, req });

  res.sendStatus(204);
});

export default router;
