import { Prisma } from "@prisma/client";
import { prisma } from "@/core/database/prisma-client";

function serializeAuditLog(
  log: {
    id: string;
    action: string;
    entity: string;
    entityId: string | null;
    ipAddress: string | null;
    metadata: Prisma.JsonValue | null;
    createdAt: Date;
    actorUser?: {
      id: string;
      name: string;
      email: string;
      role: string;
    } | null;
  },
) {
  const metadata =
    log.metadata && typeof log.metadata === "object" && !Array.isArray(log.metadata)
      ? (log.metadata as Record<string, unknown>)
      : null;

  return {
    ...log,
    metadata,
    createdAt: log.createdAt.toISOString(),
  };
}

export class AuditService {
  async list(
    organizationId: string,
    filters?: {
      action?: string;
      entity?: string;
      search?: string;
      actorUserId?: string;
    },
  ) {
    const logs = await prisma.auditLog.findMany({
      where: {
        organizationId,
        action: filters?.action,
        entity: filters?.entity,
        actorUserId: filters?.actorUserId,
        OR: filters?.search
          ? [
              { action: { contains: filters.search, mode: "insensitive" } },
              { entity: { contains: filters.search, mode: "insensitive" } },
            ]
          : undefined,
      },
      include: {
        actorUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return logs.map(serializeAuditLog);
  }

  async record(input: {
    organizationId: string;
    actorUserId?: string | null;
    action: string;
    entity: string;
    entityId?: string | null;
    ipAddress?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    return prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        ipAddress: input.ipAddress ?? null,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
