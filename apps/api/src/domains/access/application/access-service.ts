import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import type { UserRole } from "@api/domains/auth/domain/user-role";
import { defaultPermissionsByRole } from "@api/domains/auth/domain/user-role";
import { prisma } from "@api/core/database/prisma-client";
import { AuditService } from "@api/domains/audit/application/audit-service";
import { DomainError } from "@api/shared/kernel/domain-error";

interface CreateUserInput {
  organizationId: string;
  plantId?: string | null;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  status?: "ACTIVE" | "INACTIVE";
  modulePermissions?: string[];
}

interface UpdateUserInput {
  plantId?: string | null;
  name?: string;
  password?: string;
  role?: UserRole;
  status?: "ACTIVE" | "INACTIVE";
  modulePermissions?: string[];
}

interface AuditActorContext {
  userId: string;
  ipAddress?: string | null;
}

function serializeAccessUser(
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    plantId: string | null;
    modulePermissions: unknown;
    lastLoginAt?: Date | null;
    createdAt?: Date;
  },
) {
  const modulePermissions = Array.isArray(user.modulePermissions)
    ? user.modulePermissions.filter((value): value is string => typeof value === "string")
    : [];

  return {
    ...user,
    modulePermissions,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt?.toISOString(),
  };
}

export class AccessService {
  constructor(private readonly auditService: AuditService) {}

  async listUsers(organizationId: string) {
    const users = await prisma.user.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        plantId: true,
        modulePermissions: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return users.map(serializeAccessUser);
  }

  async createUser(input: CreateUserInput, actor: AuditActorContext) {
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });

    if (existing) {
      throw new DomainError("Ja existe um usuario com este e-mail.", 409);
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = await prisma.user.create({
      data: {
        organizationId: input.organizationId,
        plantId: input.plantId ?? null,
        name: input.name,
        email: input.email,
        emailVerified: true,
        passwordHash,
        role: input.role,
        status: input.status ?? "ACTIVE",
        modulePermissions: input.modulePermissions ?? defaultPermissionsByRole[input.role],
        accounts: {
          create: {
            id: randomUUID(),
            accountId: input.email,
            providerId: "credential",
            password: passwordHash,
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        plantId: true,
        modulePermissions: true,
      },
    });

    await this.auditService.record({
      organizationId: input.organizationId,
      actorUserId: actor.userId,
      action: "ACCESS_USER.CREATED",
      entity: "User",
      entityId: user.id,
      ipAddress: actor.ipAddress ?? null,
      metadata: {
        after: serializeAccessUser(user),
      },
    });

    return serializeAccessUser(user);
  }

  async updateUser(
    organizationId: string,
    userId: string,
    input: UpdateUserInput,
    actor: AuditActorContext,
  ) {
    const existing = await prisma.user.findFirst({
      where: {
        id: userId,
        organizationId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        plantId: true,
        modulePermissions: true,
      },
    });

    if (!existing) {
      throw new DomainError("Usuario nao encontrado.", 404);
    }

    const passwordHash = input.password ? await bcrypt.hash(input.password, 12) : undefined;

    return prisma.$transaction(async (transaction) => {
      if (passwordHash) {
        await transaction.account.updateMany({
          where: {
            userId,
            providerId: "credential",
          },
          data: {
            password: passwordHash,
          },
        });
      }

      const user = await transaction.user.update({
        where: { id: userId },
        data: {
          plantId: input.plantId === undefined ? undefined : input.plantId,
          name: input.name,
          passwordHash,
          role: input.role,
          status: input.status,
          modulePermissions:
            input.modulePermissions ??
            (input.role ? defaultPermissionsByRole[input.role] : undefined),
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          plantId: true,
          modulePermissions: true,
          lastLoginAt: true,
        },
      });

      const serializedUser = serializeAccessUser(user);

      await this.auditService.record({
        organizationId,
        actorUserId: actor.userId,
        action: "ACCESS_USER.UPDATED",
        entity: "User",
        entityId: user.id,
        ipAddress: actor.ipAddress ?? null,
        metadata: {
          before: serializeAccessUser(existing),
          after: serializedUser,
        },
      });

      return serializedUser;
    });
  }
}
