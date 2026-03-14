import { auth } from "@point-manager/auth/server";
import { createLocalJWKSet, jwtVerify, type JSONWebKeySet } from "jose";
import { env } from "@/core/config/env";
import { prisma } from "@/core/database/prisma-client";
import {
  AppModules,
  defaultPermissionsByRole,
  type AppModule,
  type UserRole,
} from "@/domains/auth/domain/user-role";
import { DomainError } from "@/shared/kernel/domain-error";

export interface AuthenticatedUser {
  id: string;
  organizationId: string;
  plantId: string | null;
  name: string;
  email: string;
  role: UserRole;
  status: string;
  modulePermissions: AppModule[];
}

let cachedJwks:
  | {
      keySet: ReturnType<typeof createLocalJWKSet>;
      expiresAt: number;
    }
  | undefined;

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function getSetCookieHeaders(headers: Headers) {
  const typedHeaders = headers as Headers & {
    getSetCookie?: () => string[];
  };

  const setCookies = typedHeaders.getSetCookie?.();
  if (setCookies?.length) {
    return setCookies;
  }

  const rawCookie = headers.get("set-cookie");
  return rawCookie ? [rawCookie] : [];
}

function buildCookieHeader(headers: Headers) {
  return getSetCookieHeaders(headers)
    .map((cookie) => cookie.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

async function getLocalJwkSet() {
  if (cachedJwks && cachedJwks.expiresAt > Date.now()) {
    return cachedJwks.keySet;
  }

  const response = await auth.handler(
    new Request(`${env.BETTER_AUTH_URL}/api/auth/jwks`, {
      method: "GET",
    }),
  );

  if (!response.ok) {
    throw new DomainError("Nao foi possivel carregar as chaves do auth.", 500);
  }

  const jwks = await readJson<JSONWebKeySet>(response);
  if (!jwks) {
    throw new DomainError("Resposta invalida ao carregar as chaves do auth.", 500);
  }

  const keySet = createLocalJWKSet(jwks);
  cachedJwks = {
    keySet,
    expiresAt: Date.now() + 5 * 60 * 1000,
  };

  return keySet;
}

function normalizeModulePermissions(
  role: UserRole,
  modulePermissions: unknown,
): AppModule[] {
  if (!Array.isArray(modulePermissions)) {
    return defaultPermissionsByRole[role];
  }

  const normalized = modulePermissions.filter((value): value is AppModule =>
    typeof value === "string" && AppModules.includes(value as AppModule),
  );

  return normalized.length > 0 ? normalized : defaultPermissionsByRole[role];
}

export class AuthService {
  async login(input: { email: string; password: string; ipAddress?: string | null }) {
    const signInHeaders = new Headers({
      "content-type": "application/json",
      accept: "application/json",
    });

    if (input.ipAddress) {
      signInHeaders.set("x-forwarded-for", input.ipAddress);
    }

    const signInResponse = await auth.handler(
      new Request(`${env.BETTER_AUTH_URL}/api/auth/sign-in/email`, {
        method: "POST",
        headers: signInHeaders,
        body: JSON.stringify({
          email: input.email,
          password: input.password,
          rememberMe: true,
        }),
      }),
    );

    const signInPayload = await readJson<{
      user?: {
        id: string;
        name: string;
        email: string;
        role?: string | null;
        plantId?: string | null;
      };
      message?: string;
    }>(signInResponse);

    if (!signInResponse.ok || !signInPayload?.user) {
      const status = signInResponse.status || 401;
      throw new DomainError(
        status === 401 ? "Credenciais inválidas." : signInPayload?.message ?? "Falha ao autenticar.",
        status,
      );
    }

    const cookieHeader = buildCookieHeader(signInResponse.headers);
    if (!cookieHeader) {
      throw new DomainError("Nao foi possivel abrir a sessao administrativa.", 500);
    }

    const tokenResponse = await auth.handler(
      new Request(`${env.BETTER_AUTH_URL}/api/auth/token`, {
        method: "GET",
        headers: new Headers({
          cookie: cookieHeader,
        }),
      }),
    );

    const tokenPayload = await readJson<{ token?: string; message?: string }>(tokenResponse);
    if (!tokenResponse.ok || !tokenPayload?.token) {
      throw new DomainError(
        tokenPayload?.message ?? "Nao foi possivel emitir o token do painel.",
        tokenResponse.status || 500,
      );
    }

    return {
      token: tokenPayload.token,
      user: {
        id: signInPayload.user.id,
        name: signInPayload.user.name,
        email: signInPayload.user.email,
        role: (signInPayload.user.role as UserRole | undefined) ?? "ADMIN",
        plantId: signInPayload.user.plantId ?? null,
      },
    };
  }

  async requireUser(authorizationHeader?: string) {
    if (!authorizationHeader?.startsWith("Bearer ")) {
      throw new DomainError("Token não informado.", 401);
    }

    const token = authorizationHeader.slice("Bearer ".length);

    try {
      const jwkSet = await getLocalJwkSet();
      const { payload } = await jwtVerify(token, jwkSet, {
        issuer: env.BETTER_AUTH_URL,
        audience: env.BETTER_AUTH_AUDIENCE,
      });
      const userId = payload.sub;

      if (typeof userId !== "string") {
        throw new DomainError("Token invalido.", 401);
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user || user.status !== "ACTIVE") {
        throw new DomainError("Usuario nao autorizado.", 401);
      }

      return {
        id: user.id,
        organizationId: user.organizationId,
        plantId: user.plantId,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        modulePermissions: normalizeModulePermissions(user.role, user.modulePermissions),
      } satisfies AuthenticatedUser;
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }

      throw new DomainError("Token invalido ou expirado.", 401);
    }
  }

  requireModuleAccess(user: AuthenticatedUser, module: AppModule) {
    if (!user.modulePermissions.includes(module)) {
      throw new DomainError("Usuario sem permissao para este modulo.", 403);
    }

    return user;
  }

  requireRole(user: AuthenticatedUser, allowedRoles: UserRole[]) {
    if (!allowedRoles.includes(user.role)) {
      throw new DomainError("Usuario sem permissao para esta operacao.", 403);
    }

    return user;
  }

  requirePlantScope(user: AuthenticatedUser, plantId?: string | null) {
    if (user.role === "PLANT_SUPERVISOR" && user.plantId && plantId && user.plantId !== plantId) {
      throw new DomainError("Supervisor sem permissao para esta usina.", 403);
    }

    return user;
  }
}
