import { PlantStatus, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "@/core/database/prisma-client";
import { AuditService } from "@/domains/audit/application/audit-service";
import {
  detectPlantNetwork,
  type DetectPlantNetworkInput,
} from "@/domains/plants/domain/network-detection";
import { DomainError } from "@/shared/kernel/domain-error";

interface ListPlantsFilters {
  search?: string;
  status?: PlantStatus | "ALL";
  plantId?: string;
}

interface UpsertPlantInput {
  organizationId: string;
  code?: string;
  name: string;
  city: string;
  state: string;
  timezone?: string;
  openingHour: string;
  closingHour: string;
  qrToken?: string;
  status?: PlantStatus;
  requireWifiMatch?: boolean;
  requireSelfie?: boolean;
  autoCloseLimitHours?: number;
  lateAlertMinutes?: number;
  geofenceLatitude?: number | null;
  geofenceLongitude?: number | null;
  geofenceRadiusMeters?: number | null;
  authorizedNetworks?: Array<{
    name: string;
    ssid?: string | null;
    bssid?: string | null;
    ipv4Cidr?: string | null;
    notes?: string | null;
  }>;
}

interface AuditActorContext {
  userId: string;
  ipAddress?: string | null;
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);
}

function buildGeneratedPlantCode(name: string, city: string) {
  const base = slugify(name) || slugify(city) || "usina";
  return `${base}-${randomUUID().slice(0, 8)}`;
}

interface PlantHistoryFilters {
  from?: Date;
  to?: Date;
  status?: string;
}

function buildPlantFilters(organizationId: string, filters?: ListPlantsFilters): Prisma.PlantWhereInput {
  return {
    organizationId,
    id: filters?.plantId,
    status:
      filters?.status && filters.status !== "ALL"
        ? filters.status
        : undefined,
    OR: filters?.search
      ? [
          { name: { contains: filters.search, mode: "insensitive" } },
          { city: { contains: filters.search, mode: "insensitive" } },
          { state: { contains: filters.search, mode: "insensitive" } },
          { code: { contains: filters.search, mode: "insensitive" } },
        ]
      : undefined,
  };
}

function serializePlantPresentEntry(
  entry: {
    id: string;
    openedAt: Date;
    accessProfile: {
      id: string;
      person: {
        id: string;
        fullName: string;
        cpf: string;
      };
      personType: string;
    };
  },
) {
  return {
    id: entry.id,
    openedAt: entry.openedAt.toISOString(),
    person: {
      id: entry.accessProfile.id,
      personId: entry.accessProfile.person.id,
      fullName: entry.accessProfile.person.fullName,
      cpf: entry.accessProfile.person.cpf,
      personType: entry.accessProfile.personType,
    },
  };
}

function serializePlantHistoryEntry(
  entry: {
    id: string;
    openedAt: Date;
    closedAt: Date | null;
    status: string;
    totalMinutes: number | null;
    accessProfile: {
      id: string;
      person: {
        id: string;
        fullName: string;
        cpf: string;
      };
      personType: string;
    };
  },
) {
  return {
    id: entry.id,
    openedAt: entry.openedAt.toISOString(),
    closedAt: entry.closedAt?.toISOString() ?? null,
    status: entry.status,
    totalMinutes: entry.totalMinutes,
    person: {
      id: entry.accessProfile.id,
      personId: entry.accessProfile.person.id,
      fullName: entry.accessProfile.person.fullName,
      cpf: entry.accessProfile.person.cpf,
      personType: entry.accessProfile.personType,
    },
  };
}

function serializePlantListItem(
  plant: {
    id: string;
    code: string;
    name: string;
    city: string;
    state: string;
    timezone: string;
    openingHour: string;
    closingHour: string;
    qrToken: string;
    status: string;
    requireWifiMatch: boolean;
    requireSelfie: boolean;
    autoCloseLimitHours: number;
    lateAlertMinutes: number;
    geofenceLatitude: number | null;
    geofenceLongitude: number | null;
    geofenceRadiusMeters: number | null;
    authorizedNetworks: Array<{
      id: string;
      name: string;
      ssid: string | null;
      bssid: string | null;
      ipv4Cidr: string | null;
      notes: string | null;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
      plantId: string;
    }>;
    _count?: {
      homeAccessProfiles: number;
      timeEntries: number;
    };
  },
) {
  return {
    id: plant.id,
    code: plant.code,
    name: plant.name,
    city: plant.city,
    state: plant.state,
    timezone: plant.timezone,
    openingHour: plant.openingHour,
    closingHour: plant.closingHour,
    qrToken: plant.qrToken,
    status: plant.status,
    requireWifiMatch: plant.requireWifiMatch,
    requireSelfie: plant.requireSelfie,
    autoCloseLimitHours: plant.autoCloseLimitHours,
    lateAlertMinutes: plant.lateAlertMinutes,
    geofenceLatitude: plant.geofenceLatitude,
    geofenceLongitude: plant.geofenceLongitude,
    geofenceRadiusMeters: plant.geofenceRadiusMeters,
    authorizedNetworks: plant.authorizedNetworks,
    _count: plant._count
      ? {
          people: plant._count.homeAccessProfiles,
          timeEntries: plant._count.timeEntries,
        }
      : undefined,
  };
}

export class PlantsService {
  constructor(private readonly auditService: AuditService) {}

  detectCurrentNetwork(input: DetectPlantNetworkInput) {
    return detectPlantNetwork(input);
  }

  async list(organizationId: string, filters?: ListPlantsFilters) {
    const plants = await prisma.plant.findMany({
      where: buildPlantFilters(organizationId, filters),
      include: {
        authorizedNetworks: {
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
        },
        _count: {
          select: {
            homeAccessProfiles: true,
            timeEntries: {
              where: { status: "OPEN" },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return plants.map(serializePlantListItem);
  }

  async getById(organizationId: string, plantId: string) {
    const plant = await prisma.plant.findFirst({
      where: {
        id: plantId,
        organizationId,
      },
      include: {
        authorizedNetworks: {
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!plant) {
      throw new DomainError("Usina nao encontrada.", 404);
    }

    const [presentPeople, history] = await Promise.all([
      prisma.timeEntry.findMany({
        where: {
          organizationId,
          plantId,
          status: "OPEN",
        },
        include: {
          accessProfile: {
            include: {
              person: true,
            },
          },
        },
        orderBy: { openedAt: "desc" },
      }),
      prisma.timeEntry.findMany({
        where: {
          organizationId,
          plantId,
        },
        include: {
          accessProfile: {
            include: {
              person: true,
            },
          },
        },
        orderBy: { openedAt: "desc" },
        take: 20,
      }),
    ]);

    return {
      ...plant,
      presentPeople: presentPeople.map(serializePlantPresentEntry),
      history: history.map(serializePlantHistoryEntry),
    };
  }

  async create(input: UpsertPlantInput, actor: AuditActorContext) {
    const code = input.code?.trim() || buildGeneratedPlantCode(input.name, input.city);

    const plant = await prisma.plant.create({
      data: {
        organizationId: input.organizationId,
        code,
        name: input.name,
        city: input.city,
        state: input.state,
        timezone: input.timezone ?? "America/Sao_Paulo",
        openingHour: input.openingHour,
        closingHour: input.closingHour,
        qrToken: input.qrToken?.trim() || randomUUID(),
        status: input.status ?? "ACTIVE",
        requireWifiMatch: input.requireWifiMatch ?? true,
        requireSelfie: input.requireSelfie ?? false,
        autoCloseLimitHours: input.autoCloseLimitHours ?? 12,
        lateAlertMinutes: input.lateAlertMinutes ?? 540,
        geofenceLatitude: input.geofenceLatitude ?? null,
        geofenceLongitude: input.geofenceLongitude ?? null,
        geofenceRadiusMeters: input.geofenceRadiusMeters ?? null,
        authorizedNetworks: input.authorizedNetworks?.length
          ? {
              create: input.authorizedNetworks.map((network) => ({
                name: network.name,
                ssid: network.ssid ?? null,
                bssid: network.bssid ?? null,
                ipv4Cidr: network.ipv4Cidr ?? null,
                notes: network.notes ?? null,
              })),
            }
          : undefined,
      },
      include: {
        authorizedNetworks: true,
      },
    });

    await this.auditService.record({
      organizationId: input.organizationId,
      actorUserId: actor.userId,
      action: "PLANT.CREATED",
      entity: "Plant",
      entityId: plant.id,
      ipAddress: actor.ipAddress ?? null,
      metadata: {
        after: {
          id: plant.id,
          code: plant.code,
          name: plant.name,
          city: plant.city,
          state: plant.state,
          openingHour: plant.openingHour,
          closingHour: plant.closingHour,
          requireWifiMatch: plant.requireWifiMatch,
          requireSelfie: plant.requireSelfie,
          autoCloseLimitHours: plant.autoCloseLimitHours,
          lateAlertMinutes: plant.lateAlertMinutes,
          geofenceLatitude: plant.geofenceLatitude,
          geofenceLongitude: plant.geofenceLongitude,
          geofenceRadiusMeters: plant.geofenceRadiusMeters,
          authorizedNetworks: plant.authorizedNetworks,
        },
      },
    });

    return plant;
  }

  async update(
    organizationId: string,
    plantId: string,
    input: Partial<UpsertPlantInput>,
    actor: AuditActorContext,
  ) {
    const existing = await prisma.plant.findFirst({
      where: {
        id: plantId,
        organizationId,
      },
      include: {
        authorizedNetworks: true,
      },
    });

    if (!existing) {
      throw new DomainError("Usina nao encontrada.", 404);
    }

    return prisma.$transaction(async (transaction) => {
      if (input.authorizedNetworks) {
        await transaction.authorizedNetwork.deleteMany({
          where: { plantId },
        });
      }

      const updated = await transaction.plant.update({
        where: { id: plantId },
        data: {
          code: input.code,
          name: input.name,
          city: input.city,
          state: input.state,
          timezone: input.timezone,
          openingHour: input.openingHour,
          closingHour: input.closingHour,
          status: input.status,
          requireWifiMatch: input.requireWifiMatch,
          requireSelfie: input.requireSelfie,
          autoCloseLimitHours: input.autoCloseLimitHours,
          lateAlertMinutes: input.lateAlertMinutes,
          geofenceLatitude:
            input.geofenceLatitude === undefined ? undefined : input.geofenceLatitude,
          geofenceLongitude:
            input.geofenceLongitude === undefined ? undefined : input.geofenceLongitude,
          geofenceRadiusMeters:
            input.geofenceRadiusMeters === undefined
              ? undefined
              : input.geofenceRadiusMeters,
          authorizedNetworks: input.authorizedNetworks
            ? {
                create: input.authorizedNetworks.map((network) => ({
                  name: network.name,
                  ssid: network.ssid ?? null,
                  bssid: network.bssid ?? null,
                  ipv4Cidr: network.ipv4Cidr ?? null,
                  notes: network.notes ?? null,
                })),
              }
            : undefined,
        },
        include: {
          authorizedNetworks: {
            where: { isActive: true },
            orderBy: { createdAt: "asc" },
          },
        },
      });

      await this.auditService.record({
        organizationId,
        actorUserId: actor.userId,
        action: "PLANT.UPDATED",
        entity: "Plant",
        entityId: updated.id,
        ipAddress: actor.ipAddress ?? null,
        metadata: {
          before: {
            id: existing.id,
            code: existing.code,
            name: existing.name,
            city: existing.city,
            state: existing.state,
            openingHour: existing.openingHour,
            closingHour: existing.closingHour,
            requireWifiMatch: existing.requireWifiMatch,
            requireSelfie: existing.requireSelfie,
            autoCloseLimitHours: existing.autoCloseLimitHours,
            lateAlertMinutes: existing.lateAlertMinutes,
            geofenceLatitude: existing.geofenceLatitude,
            geofenceLongitude: existing.geofenceLongitude,
            geofenceRadiusMeters: existing.geofenceRadiusMeters,
            authorizedNetworks: existing.authorizedNetworks,
          },
          after: {
            id: updated.id,
            code: updated.code,
            name: updated.name,
            city: updated.city,
            state: updated.state,
            openingHour: updated.openingHour,
            closingHour: updated.closingHour,
            requireWifiMatch: updated.requireWifiMatch,
            requireSelfie: updated.requireSelfie,
            autoCloseLimitHours: updated.autoCloseLimitHours,
            lateAlertMinutes: updated.lateAlertMinutes,
            geofenceLatitude: updated.geofenceLatitude,
            geofenceLongitude: updated.geofenceLongitude,
            geofenceRadiusMeters: updated.geofenceRadiusMeters,
            authorizedNetworks: updated.authorizedNetworks,
          },
        },
      });

      return updated;
    });
  }

  async listPresentPeople(organizationId: string, plantId: string) {
    const presentPeople = await prisma.timeEntry.findMany({
      where: {
        organizationId,
        plantId,
        status: "OPEN",
      },
      include: {
        accessProfile: {
          include: {
            person: true,
          },
        },
      },
      orderBy: { openedAt: "desc" },
    });

    return presentPeople.map(serializePlantPresentEntry);
  }

  async listHistory(organizationId: string, plantId: string, filters?: PlantHistoryFilters) {
    const history = await prisma.timeEntry.findMany({
      where: {
        organizationId,
        plantId,
        status: filters?.status ? (filters.status as never) : undefined,
        openedAt: filters?.from || filters?.to
          ? {
              gte: filters.from,
              lte: filters.to,
            }
          : undefined,
      },
      include: {
        accessProfile: {
          include: {
            person: true,
          },
        },
      },
      orderBy: { openedAt: "desc" },
      take: 100,
    });

    return history.map(serializePlantHistoryEntry);
  }

  async getByQrToken(qrToken: string) {
    const plant = await prisma.plant.findUnique({
      where: { qrToken },
      include: {
        authorizedNetworks: {
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!plant) {
      throw new DomainError("QRCode de usina invalido.", 404);
    }

    return plant;
  }

  async getPublicById(plantId: string) {
    const plant = await prisma.plant.findUnique({
      where: { id: plantId },
      include: {
        authorizedNetworks: {
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!plant || plant.status !== "ACTIVE") {
      throw new DomainError("Usina indisponivel para registros.", 404);
    }

    return plant;
  }
}
