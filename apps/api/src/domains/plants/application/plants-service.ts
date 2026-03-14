import { PlantStatus, Prisma } from "@prisma/client";
import { prisma } from "@/core/database/prisma-client";
import {
  detectPlantNetwork,
  type DetectPlantNetworkInput,
} from "@/domains/plants/domain/network-detection";
import { DomainError } from "@/shared/kernel/domain-error";

interface ListPlantsFilters {
  search?: string;
  status?: PlantStatus | "ALL";
}

interface UpsertPlantInput {
  organizationId: string;
  code: string;
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

interface PlantHistoryFilters {
  from?: Date;
  to?: Date;
  status?: string;
}

function buildPlantFilters(organizationId: string, filters?: ListPlantsFilters): Prisma.PlantWhereInput {
  return {
    organizationId,
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
    employee: {
      id: string;
      fullName: string;
      cpf: string;
      personType: string;
    };
  },
) {
  return {
    ...entry,
    openedAt: entry.openedAt.toISOString(),
  };
}

function serializePlantHistoryEntry(
  entry: {
    id: string;
    openedAt: Date;
    closedAt: Date | null;
    status: string;
    totalMinutes: number | null;
    employee: {
      id: string;
      fullName: string;
      cpf: string;
      personType: string;
    };
  },
) {
  return {
    ...entry,
    openedAt: entry.openedAt.toISOString(),
    closedAt: entry.closedAt?.toISOString() ?? null,
  };
}

export class PlantsService {
  detectCurrentNetwork(input: DetectPlantNetworkInput) {
    return detectPlantNetwork(input);
  }

  async list(organizationId: string, filters?: ListPlantsFilters) {
    return prisma.plant.findMany({
      where: buildPlantFilters(organizationId, filters),
      include: {
        authorizedNetworks: {
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
        },
        _count: {
          select: {
            employees: true,
            timeEntries: {
              where: { status: "OPEN" },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });
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
          employee: true,
        },
        orderBy: { openedAt: "desc" },
      }),
      prisma.timeEntry.findMany({
        where: {
          organizationId,
          plantId,
        },
        include: {
          employee: true,
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

  async create(input: UpsertPlantInput) {
    return prisma.plant.create({
      data: {
        organizationId: input.organizationId,
        code: input.code,
        name: input.name,
        city: input.city,
        state: input.state,
        timezone: input.timezone ?? "America/Sao_Paulo",
        openingHour: input.openingHour,
        closingHour: input.closingHour,
        qrToken: input.qrToken ?? `${input.code}-qr-token`,
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
  }

  async update(organizationId: string, plantId: string, input: Partial<UpsertPlantInput>) {
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

      return transaction.plant.update({
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
        employee: true,
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
        employee: true,
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
