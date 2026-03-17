import { Elysia, t } from "elysia";
import { UserStatus } from "@prisma/client";
import { AppModules, UserRoles, type AppModule, type UserRole } from "@/domains/auth/domain/user-role";
import { appServices } from "@/shared/kernel/app-services";
import { DomainError } from "@/shared/kernel/domain-error";
import { handleDomainError } from "@/shared/http/handle-domain-error";
import { readClientIp } from "@/shared/http/read-client-ip";
import { accessUserSchema, commonErrorResponses } from "@/shared/http/response-schemas";

function parseUserRole(value: string): UserRole {
  if (Object.values(UserRoles).includes(value as UserRole)) {
    return value as UserRole;
  }

  throw new DomainError("Perfil de usuario invalido.", 422);
}

function parseModulePermissions(value?: string[]): AppModule[] | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.filter((module): module is AppModule =>
    AppModules.includes(module as AppModule),
  );

  if (normalized.length !== value.length) {
    throw new DomainError("Permissoes de modulo invalidas.", 422);
  }

  return normalized;
}

function parseUserStatus(value?: string) {
  if (!value) {
    return undefined;
  }

  if (Object.values(UserStatus).includes(value as UserStatus)) {
    return value as UserStatus;
  }

  throw new DomainError("Status de usuario invalido.", 422);
}

export const accessRoutes = new Elysia({ prefix: "/access" })
  .get(
    "/users",
    async ({ headers, set }) => {
      try {
        const user = await appServices.auth.requireUser(headers.authorization);
        appServices.auth.requireModuleAccess(user, "access");
        appServices.auth.requireRole(user, ["SUPER_ADMIN"]);

        return await appServices.access.listUsers(user.organizationId);
      } catch (error) {
        return handleDomainError(set, error);
      }
    },
    {
      response: {
        200: t.Array(accessUserSchema),
        ...commonErrorResponses,
      },
    },
  )
  .post(
    "/users",
    async ({ headers, body, request, server, set }) => {
      try {
        const user = await appServices.auth.requireUser(headers.authorization);
        appServices.auth.requireModuleAccess(user, "access");
        appServices.auth.requireRole(user, ["SUPER_ADMIN"]);

        return await appServices.access.createUser({
          organizationId: user.organizationId,
          plantId: body.plantId ?? undefined,
          name: body.name,
          email: body.email,
          password: body.password,
          role: parseUserRole(body.role),
          status: parseUserStatus(body.status),
          modulePermissions: parseModulePermissions(body.modulePermissions),
        }, {
          userId: user.id,
          ipAddress: readClientIp(request.headers, request, server) ?? null,
        });
      } catch (error) {
        return handleDomainError(set, error);
      }
    },
    {
      body: t.Object({
        plantId: t.Optional(t.Union([t.String(), t.Null()])),
        name: t.String(),
        email: t.String({ format: "email" }),
        password: t.String({ minLength: 6 }),
        role: t.String(),
        status: t.Optional(t.String()),
        modulePermissions: t.Optional(t.Array(t.String())),
      }),
      response: {
        200: accessUserSchema,
        ...commonErrorResponses,
      },
    },
  )
  .patch(
    "/users/:userId",
    async ({ headers, params, body, request, server, set }) => {
      try {
        const user = await appServices.auth.requireUser(headers.authorization);
        appServices.auth.requireModuleAccess(user, "access");
        appServices.auth.requireRole(user, ["SUPER_ADMIN"]);

        return await appServices.access.updateUser(user.organizationId, params.userId, {
          plantId: body.plantId ?? undefined,
          name: body.name,
          password: body.password,
          role: body.role ? parseUserRole(body.role) : undefined,
          status: parseUserStatus(body.status),
          modulePermissions: parseModulePermissions(body.modulePermissions),
        }, {
          userId: user.id,
          ipAddress: readClientIp(request.headers, request, server) ?? null,
        });
      } catch (error) {
        return handleDomainError(set, error);
      }
    },
    {
      body: t.Object({
        plantId: t.Optional(t.Union([t.String(), t.Null()])),
        name: t.Optional(t.String()),
        password: t.Optional(t.String({ minLength: 6 })),
        role: t.Optional(t.String()),
        status: t.Optional(t.String()),
        modulePermissions: t.Optional(t.Array(t.String())),
      }),
      response: {
        200: accessUserSchema,
        ...commonErrorResponses,
      },
    },
  );
