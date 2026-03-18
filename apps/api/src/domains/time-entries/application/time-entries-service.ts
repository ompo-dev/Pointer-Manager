import { PersonType, Prisma, type EntryOrigin, type TimeEntryStatus } from "@prisma/client";
import { prisma } from "@api/core/database/prisma-client";
import { OperationsHub } from "@api/core/realtime/operations-hub";
import { AuditService } from "@api/domains/audit/application/audit-service";
import type { AuthenticatedUser } from "@api/domains/auth/application/auth-service";
import { detectPlantNetwork } from "@api/domains/plants/domain/network-detection";
import {
  getAccessSubjectPolicy,
  listAccessSubjectPolicies,
  normalizeCpf,
  normalizeOptionalText,
} from "@api/domains/time-entries/domain/access-subject-policy";
import {
  evaluatePlantLocationAccess,
  evaluatePlantNetworkAccess,
  validatePlantAccess,
} from "@api/domains/time-entries/domain/access-validation";
import { DomainError } from "@api/shared/kernel/domain-error";

interface ListEntriesFilters {
  organizationId: string;
  plantId?: string;
  personId?: string;
  status?: TimeEntryStatus | "ALL";
  search?: string;
  from?: Date;
  to?: Date;
}

interface RegisterEntryInput {
  cpf: string;
  plantId?: string | null;
  fullName?: string | null;
  employer?: string | null;
  jobTitle?: string | null;
  personType?: PersonType;
  email?: string | null;
  phone?: string | null;
  photoUrl?: string | null;
  notes?: string | null;
  deviceIp?: string | null;
  deviceLabel?: string | null;
  wifiSsid?: string | null;
  wifiBssid?: string | null;
  selfieUrl?: string | null;
  geoLatitude?: number | null;
  geoLongitude?: number | null;
  browserIpCandidates?: string[];
  networkType?: string | null;
  networkEffectiveType?: string | null;
}

interface RegisterExitInput {
  cpf: string;
  plantId?: string | null;
  deviceIp?: string | null;
  wifiSsid?: string | null;
  wifiBssid?: string | null;
  selfieUrl?: string | null;
  geoLatitude?: number | null;
  geoLongitude?: number | null;
  browserIpCandidates?: string[];
  networkType?: string | null;
  networkEffectiveType?: string | null;
}

interface AdjustEntryInput {
  openedAt?: Date;
  closedAt?: Date | null;
  notes?: string | null;
  status?: TimeEntryStatus;
}

type AccessProfileSnapshot = {
  id: string;
  personId: string;
  organizationId: string;
  personType: PersonType;
  employer: string;
  jobTitle: string;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
  notes: string | null;
  status: string;
  person: {
    id: string;
    fullName: string;
    cpf: string;
  };
};

type TimeEntryRecord = {
  id: string;
  organizationId: string;
  accessProfileId: string;
  plantId: string;
  openedAt: Date;
  closedAt: Date | null;
  totalMinutes: number | null;
  status: string;
  origin: EntryOrigin;
  deviceIp: string | null;
  deviceLabel: string | null;
  wifiSsid: string | null;
  wifiBssid: string | null;
  selfieUrl: string | null;
  geoLatitude: number | null;
  geoLongitude: number | null;
  validationMode: string | null;
  validationNotes: string | null;
  notes: string | null;
  closedReason: string | null;
  adjustedByUserId: string | null;
  accessProfile: AccessProfileSnapshot;
  plant: {
    id: string;
    name: string;
    city: string;
    state: string;
  };
  adjustedByUser?: {
    id: string;
    name: string;
    email: string;
  } | null;
};

type PublicDeviceResolutionInput = Pick<
  RegisterEntryInput,
  | "deviceIp"
  | "wifiSsid"
  | "wifiBssid"
  | "browserIpCandidates"
  | "networkType"
>;

function isLoopbackIp(value?: string | null) {
  return value === "127.0.0.1" || value === "::1";
}

function calculateElapsedMinutes(openedAt: Date, totalMinutes?: number | null, closedAt?: Date | null) {
  if (typeof totalMinutes === "number") {
    return totalMinutes;
  }

  const end = closedAt ?? new Date();
  return Math.max(0, Math.round((end.getTime() - openedAt.getTime()) / 60000));
}

function buildEntrySearchFilters(filters: ListEntriesFilters): Prisma.TimeEntryWhereInput {
  return {
    organizationId: filters.organizationId,
    plantId: filters.plantId,
    accessProfileId: filters.personId,
    status:
      filters.status && filters.status !== "ALL"
        ? filters.status
        : undefined,
    openedAt:
      filters.from || filters.to
        ? {
            gte: filters.from,
            lte: filters.to,
          }
        : undefined,
    OR: filters.search
      ? [
          {
            accessProfile: {
              is: {
                person: {
                  is: {
                    fullName: {
                      contains: filters.search,
                      mode: "insensitive",
                    },
                  },
                },
              },
            },
          },
          {
            accessProfile: {
              is: {
                person: {
                  is: {
                    cpf: {
                      contains: filters.search,
                      mode: "insensitive",
                    },
                  },
                },
              },
            },
          },
          {
            plant: {
              is: {
                name: {
                  contains: filters.search,
                  mode: "insensitive",
                },
              },
            },
          },
        ]
      : undefined,
  };
}

function buildValidationNotes(
  validationNote: string,
  input: Pick<RegisterEntryInput, "networkType" | "networkEffectiveType">,
) {
  const evidence: string[] = [];

  if (input.networkType) {
    evidence.push(`networkType=${input.networkType}`);
  }

  if (input.networkEffectiveType) {
    evidence.push(`effectiveType=${input.networkEffectiveType}`);
  }

  return evidence.length > 0 ? `${validationNote} [${evidence.join(", ")}]` : validationNote;
}

function resolveOptionalProfileField(value: string | null | undefined, fallback?: string | null) {
  if (value === undefined) {
    return fallback ?? undefined;
  }

  return normalizeOptionalText(value) ?? null;
}

function serializeAccessPerson(accessProfile: AccessProfileSnapshot) {
  return {
    id: accessProfile.id,
    personId: accessProfile.person.id,
    fullName: accessProfile.person.fullName,
    cpf: accessProfile.person.cpf,
    personType: accessProfile.personType,
    employer: accessProfile.employer,
    jobTitle: accessProfile.jobTitle,
    status: accessProfile.status,
  };
}

function serializeTimeEntry(entry: TimeEntryRecord) {
  return {
    id: entry.id,
    openedAt: entry.openedAt.toISOString(),
    closedAt: entry.closedAt?.toISOString() ?? null,
    totalMinutes: entry.totalMinutes,
    elapsedMinutes: calculateElapsedMinutes(entry.openedAt, entry.totalMinutes, entry.closedAt),
    status: entry.status,
    origin: entry.origin,
    deviceIp: entry.deviceIp,
    deviceLabel: entry.deviceLabel,
    wifiSsid: entry.wifiSsid,
    wifiBssid: entry.wifiBssid,
    selfieUrl: entry.selfieUrl,
    geoLatitude: entry.geoLatitude,
    geoLongitude: entry.geoLongitude,
    validationMode: entry.validationMode,
    validationNotes: entry.validationNotes,
    notes: entry.notes,
    closedReason: entry.closedReason,
    person: serializeAccessPerson(entry.accessProfile),
    plant: entry.plant,
    adjustedByUser: entry.adjustedByUser ?? null,
  };
}

export class TimeEntriesService {
  constructor(
    private readonly operationsHub: OperationsHub,
    private readonly auditService: AuditService,
  ) {}

  private resolvePublicDeviceContext(input: PublicDeviceResolutionInput) {
    const networkDetection = detectPlantNetwork({
      requestIp: input.deviceIp,
      browserIpCandidates: input.browserIpCandidates,
      browserConnectionType: input.networkType,
    });

    const resolvedDeviceIp =
      input.deviceIp && !isLoopbackIp(input.deviceIp)
        ? input.deviceIp
        : networkDetection.ipAddress ?? input.deviceIp ?? null;
    const resolvedWifiSsid = input.wifiSsid ?? networkDetection.ssid ?? null;
    const resolvedWifiBssid = input.wifiBssid ?? networkDetection.bssid ?? null;
    const resolvedCurrentNetworkName =
      networkDetection.ssid ??
      networkDetection.candidates.find((candidate) => candidate.isCurrent)?.label ??
      null;

    return {
      deviceIp: resolvedDeviceIp,
      wifiSsid: resolvedWifiSsid,
      wifiBssid: resolvedWifiBssid,
      currentNetworkName: resolvedCurrentNetworkName,
    };
  }

  private async resolvePublicPlant(reference: { plantId?: string | null }) {
    if (!reference.plantId?.trim()) {
      throw new DomainError("Usina nao informada para o registro.", 422);
    }

    return prisma.plant.findUnique({
      where: { id: reference.plantId.trim() },
      include: {
        authorizedNetworks: true,
      },
    });
  }

  private async publishOperationalEvent(
    type: "entry.created" | "entry.closed" | "entry.adjusted",
    entry: Pick<
      TimeEntryRecord,
      "id" | "organizationId" | "plantId" | "openedAt" | "closedAt" | "totalMinutes" | "status"
    > & {
      accessProfile: {
        personType: PersonType;
        person: {
          fullName: string;
        };
      };
      plant: {
        name: string;
      };
    },
  ) {
    const payload =
      type === "entry.closed"
        ? {
            entryId: entry.id,
            personName: entry.accessProfile.person.fullName,
            personType: entry.accessProfile.personType,
            plantName: entry.plant.name,
            totalMinutes: entry.totalMinutes ?? 0,
            status: entry.status ?? "CLOSED",
            closedAt: entry.closedAt?.toISOString() ?? new Date().toISOString(),
          }
        : type === "entry.adjusted"
          ? {
              entryId: entry.id,
              personName: entry.accessProfile.person.fullName,
              personType: entry.accessProfile.personType,
              plantName: entry.plant.name,
              openedAt: entry.openedAt?.toISOString(),
              closedAt: entry.closedAt?.toISOString() ?? null,
              totalMinutes: entry.totalMinutes ?? null,
              status: entry.status ?? "ADJUSTED",
              isCurrentlyOpen: entry.status === "OPEN",
            }
          : {
              entryId: entry.id,
              personName: entry.accessProfile.person.fullName,
              personType: entry.accessProfile.personType,
              plantName: entry.plant.name,
              openedAt: entry.openedAt?.toISOString(),
              status: entry.status ?? "OPEN",
            };

    await prisma.realtimeEvent.create({
      data: {
        organizationId: entry.organizationId,
        plantId: entry.plantId,
        channel: "operations",
        type,
        payload,
      },
    });

    this.operationsHub.publish({
      type,
      plantId: entry.plantId,
      payload,
      createdAt: new Date().toISOString(),
    });
  }

  private buildNormalizedPersonData(
    input: RegisterEntryInput,
    existing?: {
      fullName?: string;
      personType?: PersonType;
      employer?: string;
      jobTitle?: string;
      email?: string | null;
      phone?: string | null;
      photoUrl?: string | null;
      notes?: string | null;
    },
  ) {
    const personType = input.personType ?? existing?.personType ?? "VISITOR";
    const policy = getAccessSubjectPolicy(personType);
    const normalized = {
      fullName: normalizeOptionalText(input.fullName) ?? existing?.fullName,
      employer:
        normalizeOptionalText(input.employer) ??
        existing?.employer ??
        policy.defaults.employer,
      jobTitle:
        normalizeOptionalText(input.jobTitle) ??
        existing?.jobTitle ??
        policy.defaults.jobTitle,
      personType,
      email: resolveOptionalProfileField(input.email, existing?.email),
      phone: resolveOptionalProfileField(input.phone, existing?.phone),
      photoUrl: resolveOptionalProfileField(input.photoUrl, existing?.photoUrl),
      notes: resolveOptionalProfileField(input.notes, existing?.notes),
    };

    const missingFields = policy.requiredFields.filter((field) => {
      if (field.name === "fullName") {
        return !normalized.fullName;
      }

      if (field.name === "employer") {
        return !normalized.employer;
      }

      return !normalized.jobTitle;
    });

    if (missingFields.length > 0) {
      throw new DomainError(
        `Preencha ${missingFields.map((field) => field.label.toLowerCase()).join(" e ")} para liberar o acesso.`,
        422,
      );
    }

    return normalized;
  }

  private async resolveScopedAccessProfileByCpf(
    organizationId: string,
    cpf: string,
  ) {
    return prisma.accessProfile.findFirst({
      where: {
        organizationId,
        person: {
          is: {
            cpf,
          },
        },
      },
      include: {
        person: true,
      },
    });
  }

  private async ensureAccessProfileForAccess(
    input: RegisterEntryInput,
    plant: {
      id: string;
      organizationId: string;
    },
  ) {
    const normalizedCpf = normalizeCpf(input.cpf);

    if (normalizedCpf.length !== 11) {
      throw new DomainError("Informe um CPF valido para registrar o acesso.", 422);
    }

    return prisma.$transaction(async (transaction: Prisma.TransactionClient) => {
      const existingPerson = await transaction.person.findUnique({
        where: { cpf: normalizedCpf },
      });

      const existingAccessProfile = existingPerson
        ? await transaction.accessProfile.findFirst({
            where: {
              organizationId: plant.organizationId,
              personId: existingPerson.id,
            },
            include: {
              person: true,
            },
          })
        : null;

      const normalizedPersonData = this.buildNormalizedPersonData(
        {
          ...input,
          cpf: normalizedCpf,
        },
        {
          fullName: existingPerson?.fullName,
          personType: existingAccessProfile?.personType,
          employer: existingAccessProfile?.employer,
          jobTitle: existingAccessProfile?.jobTitle,
          email: existingAccessProfile?.email,
          phone: existingAccessProfile?.phone,
          photoUrl: existingAccessProfile?.photoUrl,
          notes: existingAccessProfile?.notes,
        },
      );

      const person = existingPerson
        ? await transaction.person.update({
            where: { id: existingPerson.id },
            data: {
              fullName: normalizedPersonData.fullName!,
            },
          })
        : await transaction.person.create({
            data: {
              cpf: normalizedCpf,
              fullName: normalizedPersonData.fullName!,
            },
          });

      if (existingAccessProfile) {
        return transaction.accessProfile.update({
          where: { id: existingAccessProfile.id },
          data: {
            homePlantId: existingAccessProfile.homePlantId ?? plant.id,
            personType: normalizedPersonData.personType,
            employer: normalizedPersonData.employer!,
            jobTitle: normalizedPersonData.jobTitle!,
            email:
              normalizedPersonData.email === undefined
                ? existingAccessProfile.email
                : normalizedPersonData.email,
            phone:
              normalizedPersonData.phone === undefined
                ? existingAccessProfile.phone
                : normalizedPersonData.phone,
            photoUrl:
              normalizedPersonData.photoUrl === undefined
                ? existingAccessProfile.photoUrl
                : normalizedPersonData.photoUrl,
            notes:
              normalizedPersonData.notes === undefined
                ? existingAccessProfile.notes
                : normalizedPersonData.notes,
            status: existingAccessProfile.status === "INACTIVE" ? "ACTIVE" : existingAccessProfile.status,
          },
          include: {
            person: true,
          },
        });
      }

      return transaction.accessProfile.create({
        data: {
          organizationId: plant.organizationId,
          personId: person.id,
          homePlantId: plant.id,
          personType: normalizedPersonData.personType,
          employer: normalizedPersonData.employer!,
          jobTitle: normalizedPersonData.jobTitle!,
          email: normalizedPersonData.email ?? null,
          phone: normalizedPersonData.phone ?? null,
          photoUrl: normalizedPersonData.photoUrl ?? null,
          notes: normalizedPersonData.notes ?? null,
          status: "ACTIVE",
        },
        include: {
          person: true,
        },
      });
    });
  }

  private async finalizeEntry(
    entry: TimeEntryRecord,
    data: {
      status: TimeEntryStatus;
      deviceIp?: string | null;
      closedReason: string;
      notes?: string | null;
      adjustedByUserId?: string | null;
      origin?: EntryOrigin;
      action: string;
      actorUserId?: string | null;
      ipAddress?: string | null;
    },
  ) {
    const closedAt = new Date();
    const totalMinutes = Math.max(
      0,
      Math.round((closedAt.getTime() - entry.openedAt.getTime()) / 60000),
    );

    const updated = await prisma.timeEntry.update({
      where: { id: entry.id },
      data: {
        closedAt,
        totalMinutes,
        status: data.status,
        deviceIp: data.deviceIp ?? entry.deviceIp,
        closedReason: data.closedReason,
        notes: data.notes ?? entry.notes,
        adjustedByUserId: data.adjustedByUserId ?? entry.adjustedByUserId,
        origin: data.origin ?? entry.origin,
      },
      include: {
        accessProfile: {
          include: {
            person: true,
          },
        },
        plant: true,
        adjustedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    await this.auditService.record({
      organizationId: entry.organizationId,
      actorUserId: data.actorUserId ?? null,
      action: data.action,
      entity: "TimeEntry",
      entityId: updated.id,
      ipAddress: data.ipAddress ?? null,
      metadata: {
        accessProfileId: updated.accessProfileId,
        personId: updated.accessProfile.person.id,
        plantId: updated.plantId,
        totalMinutes,
        closedReason: data.closedReason,
      },
    });

    await this.publishOperationalEvent("entry.closed", updated);

    return serializeTimeEntry(updated);
  }

  async runAutoClose(organizationId: string, plantId?: string) {
    const openEntries = await prisma.timeEntry.findMany({
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
        plant: true,
      },
      orderBy: { openedAt: "asc" },
    });

    const now = new Date();
    const autoClosedIds: string[] = [];

    for (const entry of openEntries) {
      const minutesOpen = Math.round((now.getTime() - entry.openedAt.getTime()) / 60000);
      const maxMinutes = entry.plant.autoCloseLimitHours * 60;
      const crossedDay = entry.openedAt.toDateString() !== now.toDateString();

      if (minutesOpen < maxMinutes && !crossedDay) {
        continue;
      }

      await this.finalizeEntry(entry, {
        status: "AUTO_CLOSED",
        closedReason: crossedDay ? "DAY_TURNOVER" : "LIMIT_REACHED",
        origin: "AUTO_CLOSED",
        action: "TIME_ENTRY.AUTO_CLOSED",
        notes: crossedDay
          ? "Ponto encerrado automaticamente na virada do dia."
          : "Ponto encerrado automaticamente por limite de permanencia.",
      });

      autoClosedIds.push(entry.id);
    }

    return autoClosedIds;
  }

  async listEntries(filters: ListEntriesFilters) {
    await this.runAutoClose(filters.organizationId, filters.plantId);

    const entries = await prisma.timeEntry.findMany({
      where: buildEntrySearchFilters(filters),
      include: {
        accessProfile: {
          include: {
            person: true,
          },
        },
        plant: true,
        adjustedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { openedAt: "desc" },
      take: 200,
    });

    return entries.map(serializeTimeEntry);
  }

  async listLiveEntries(organizationId: string, plantId?: string) {
    await this.runAutoClose(organizationId, plantId);

    const entries = await prisma.timeEntry.findMany({
      where: {
        organizationId,
        plantId: plantId ?? undefined,
        status: "OPEN",
      },
      include: {
        accessProfile: {
          include: {
            person: true,
          },
        },
        plant: true,
      },
      orderBy: { openedAt: "desc" },
    });

    return entries.map(serializeTimeEntry);
  }

  async getAccessIntakeContext(input: { cpf: string; plantId?: string | null }) {
    const normalizedCpf = normalizeCpf(input.cpf);

    if (normalizedCpf.length !== 11) {
      throw new DomainError("Informe um CPF valido para consultar o acesso.", 422);
    }

    const plant = await this.resolvePublicPlant(input);

    if (!plant || plant.status !== "ACTIVE") {
      throw new DomainError("Usina indisponivel para registros.", 404);
    }

    const accessProfile = await this.resolveScopedAccessProfileByCpf(
      plant.organizationId,
      normalizedCpf,
    );

    const openEntry = accessProfile
      ? await prisma.timeEntry.findFirst({
          where: {
            accessProfileId: accessProfile.id,
            status: "OPEN",
          },
          include: {
            plant: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            openedAt: "desc",
          },
        })
      : null;

    const suggestedMode =
      !openEntry
        ? "ENTRY"
        : openEntry.plantId === plant.id
          ? "EXIT"
          : "BLOCKED";

    const blockedReason =
      suggestedMode === "BLOCKED"
        ? `Ja existe um acesso em aberto na usina ${openEntry?.plant.name}. Encerre esse acesso antes de registrar uma nova entrada.`
        : null;

    return {
      plant: {
        id: plant.id,
        name: plant.name,
        city: plant.city,
        state: plant.state,
        requireWifiMatch: plant.requireWifiMatch,
        requireSelfie: plant.requireSelfie,
        requireGeolocation:
          plant.geofenceLatitude !== null &&
          plant.geofenceLongitude !== null &&
          plant.geofenceRadiusMeters !== null,
      },
      person: accessProfile ? serializeAccessPerson(accessProfile) : null,
      openEntry: openEntry
        ? {
            id: openEntry.id,
            openedAt: openEntry.openedAt.toISOString(),
            plantId: openEntry.plant.id,
            plantName: openEntry.plant.name,
            samePlant: openEntry.plantId === plant.id,
          }
        : null,
      suggestedMode,
      blockedReason,
      personTypePolicies: listAccessSubjectPolicies(),
    };
  }

  async getPublicNetworkStatus(input: {
    plantId?: string | null;
    deviceIp?: string | null;
    wifiSsid?: string | null;
    wifiBssid?: string | null;
    geoLatitude?: number | null;
    geoLongitude?: number | null;
    browserIpCandidates?: string[];
    networkType?: string | null;
    networkEffectiveType?: string | null;
  }) {
    const plant = await this.resolvePublicPlant(input);

    if (!plant || plant.status !== "ACTIVE") {
      throw new DomainError("Usina indisponivel para registros.", 404);
    }

    const deviceContext = this.resolvePublicDeviceContext(input);
    const evaluation = evaluatePlantNetworkAccess(plant, {
      ...input,
      deviceIp: deviceContext.deviceIp,
      wifiSsid: deviceContext.wifiSsid,
      wifiBssid: deviceContext.wifiBssid,
    });
    const location = evaluatePlantLocationAccess(plant, input);

    return {
      plant: {
        id: plant.id,
        name: plant.name,
        city: plant.city,
        state: plant.state,
        requireWifiMatch: plant.requireWifiMatch,
        requireSelfie: plant.requireSelfie,
        requireGeolocation:
          plant.geofenceLatitude !== null &&
          plant.geofenceLongitude !== null &&
          plant.geofenceRadiusMeters !== null,
      },
      network: {
        status: evaluation.status,
        reason: evaluation.reason,
        message: evaluation.message,
        observedIp: evaluation.observedIp,
        currentNetworkName: evaluation.currentNetworkName ?? deviceContext.currentNetworkName,
        matched: evaluation.matched,
        matchedBy: evaluation.matchedBy,
        matchedNetworkName: evaluation.matchedNetworkName,
        browserHintIgnored: evaluation.browserHintIgnored,
      },
      location,
      ready:
        evaluation.status !== "BLOCKED" &&
        location.status !== "BLOCKED" &&
        location.status !== "PENDING",
    };
  }

  async registerEntry(input: RegisterEntryInput) {
    const plant = await this.resolvePublicPlant(input);

    if (!plant || plant.status !== "ACTIVE") {
      throw new DomainError("Usina indisponivel para registros.", 404);
    }

    const normalizedCpf = normalizeCpf(input.cpf);

    if (normalizedCpf.length !== 11) {
      throw new DomainError("Informe um CPF valido para registrar o acesso.", 422);
    }

    const deviceContext = this.resolvePublicDeviceContext(input);
    const validation = validatePlantAccess(plant, {
      ...input,
      deviceIp: deviceContext.deviceIp,
      wifiSsid: deviceContext.wifiSsid,
      wifiBssid: deviceContext.wifiBssid,
    });

    if (!validation.valid) {
      throw new DomainError(validation.notes, 403);
    }

    const validationNotes = buildValidationNotes(validation.notes, input);
    const accessProfile = await this.ensureAccessProfileForAccess(
      {
        ...input,
        cpf: normalizedCpf,
      },
      plant,
    );

    if (accessProfile.status !== "ACTIVE") {
      throw new DomainError("Pessoa sem autorizacao para entrada.", 403);
    }

    const hasOpenEntry = await prisma.timeEntry.findFirst({
      where: {
        accessProfileId: accessProfile.id,
        status: "OPEN",
      },
    });

    if (hasOpenEntry) {
      throw new DomainError("Ja existe um acesso em aberto para esta pessoa.", 409);
    }

    const entry = await prisma.timeEntry.create({
      data: {
        organizationId: plant.organizationId,
        accessProfileId: accessProfile.id,
        plantId: plant.id,
        origin: "QR_CODE",
        deviceIp: deviceContext.deviceIp ?? null,
        deviceLabel: normalizeOptionalText(input.deviceLabel) ?? null,
        wifiSsid: deviceContext.wifiSsid ?? null,
        wifiBssid: deviceContext.wifiBssid ?? null,
        selfieUrl: normalizeOptionalText(input.selfieUrl) ?? null,
        geoLatitude: input.geoLatitude ?? null,
        geoLongitude: input.geoLongitude ?? null,
        validationMode: validation.mode,
        validationNotes,
        notes: normalizeOptionalText(input.notes) ?? null,
      },
      include: {
        accessProfile: {
          include: {
            person: true,
          },
        },
        plant: true,
        adjustedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    await this.auditService.record({
      organizationId: plant.organizationId,
      action: "TIME_ENTRY.OPENED",
      entity: "TimeEntry",
      entityId: entry.id,
      ipAddress: deviceContext.deviceIp ?? null,
      metadata: {
        accessProfileId: accessProfile.id,
        personId: accessProfile.person.id,
        plantId: plant.id,
        personType: accessProfile.personType,
        validationMode: validation.mode,
        validationNotes,
        networkType: input.networkType ?? null,
        networkEffectiveType: input.networkEffectiveType ?? null,
      },
    });

    await this.publishOperationalEvent("entry.created", entry);

    return serializeTimeEntry(entry);
  }

  async registerExit(input: RegisterExitInput) {
    const plant = await this.resolvePublicPlant(input);

    if (!plant || plant.status !== "ACTIVE") {
      throw new DomainError("Usina indisponivel para registros.", 404);
    }

    const normalizedCpf = normalizeCpf(input.cpf);

    if (normalizedCpf.length !== 11) {
      throw new DomainError("Informe um CPF valido para registrar a saida.", 422);
    }

    const deviceContext = this.resolvePublicDeviceContext(input);
    const validation = validatePlantAccess(plant, {
      ...input,
      deviceIp: deviceContext.deviceIp,
      wifiSsid: deviceContext.wifiSsid,
      wifiBssid: deviceContext.wifiBssid,
    });

    if (!validation.valid) {
      throw new DomainError(validation.notes, 403);
    }

    const validationNotes = buildValidationNotes(validation.notes, input);
    const accessProfile = await this.resolveScopedAccessProfileByCpf(
      plant.organizationId,
      normalizedCpf,
    );

    if (!accessProfile) {
      throw new DomainError("Pessoa nao encontrada.", 404);
    }

    const entry = await prisma.timeEntry.findFirst({
      where: {
        accessProfileId: accessProfile.id,
        plantId: plant.id,
        status: "OPEN",
      },
      include: {
        accessProfile: {
          include: {
            person: true,
          },
        },
        plant: true,
        adjustedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!entry) {
      throw new DomainError("Nenhum acesso em aberto para encerrar.", 404);
    }

    return this.finalizeEntry(entry, {
      status: "CLOSED",
      deviceIp: deviceContext.deviceIp ?? null,
      closedReason: "QR_EXIT",
      action: "TIME_ENTRY.CLOSED",
      ipAddress: deviceContext.deviceIp ?? null,
      notes: validationNotes,
    });
  }

  async closeManually(
    user: AuthenticatedUser,
    entryId: string,
    notes?: string,
    ipAddress?: string | null,
  ) {
    const entry = await prisma.timeEntry.findFirst({
      where: {
        id: entryId,
        organizationId: user.organizationId,
        plantId: user.role === "PLANT_SUPERVISOR" ? user.plantId ?? undefined : undefined,
      },
      include: {
        accessProfile: {
          include: {
            person: true,
          },
        },
        plant: true,
        adjustedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!entry) {
      throw new DomainError("Registro nao encontrado.", 404);
    }

    if (entry.status !== "OPEN") {
      throw new DomainError("Somente registros em aberto podem ser encerrados manualmente.", 409);
    }

    return this.finalizeEntry(entry, {
      status: "CLOSED",
      closedReason: "MANUAL_PANEL",
      action: "TIME_ENTRY.MANUAL_CLOSE",
      actorUserId: user.id,
      adjustedByUserId: user.id,
      notes: notes ?? "Registro encerrado manualmente pelo painel.",
      origin: "PANEL",
      ipAddress: ipAddress ?? null,
    });
  }

  async adjustEntry(
    user: AuthenticatedUser,
    entryId: string,
    input: AdjustEntryInput,
    ipAddress?: string | null,
  ) {
    const entry = await prisma.timeEntry.findFirst({
      where: {
        id: entryId,
        organizationId: user.organizationId,
        plantId: user.role === "PLANT_SUPERVISOR" ? user.plantId ?? undefined : undefined,
      },
      include: {
        accessProfile: {
          include: {
            person: true,
          },
        },
        plant: true,
        adjustedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!entry) {
      throw new DomainError("Registro nao encontrado.", 404);
    }

    const nextOpenedAt = input.openedAt ?? entry.openedAt;
    const nextClosedAt = input.closedAt === undefined ? entry.closedAt : input.closedAt;
    const totalMinutes =
      nextClosedAt !== null
        ? Math.max(0, Math.round((nextClosedAt.getTime() - nextOpenedAt.getTime()) / 60000))
        : null;

    const updated = await prisma.timeEntry.update({
      where: { id: entryId },
      data: {
        openedAt: nextOpenedAt,
        closedAt: nextClosedAt,
        totalMinutes,
        notes: input.notes ?? entry.notes,
        status: input.status ?? "ADJUSTED",
        adjustedByUserId: user.id,
        origin: "MANUAL_ADJUSTMENT",
        closedReason: nextClosedAt ? entry.closedReason ?? "ADJUSTED" : null,
      },
      include: {
        accessProfile: {
          include: {
            person: true,
          },
        },
        plant: true,
        adjustedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    await this.auditService.record({
      organizationId: user.organizationId,
      actorUserId: user.id,
      action: "TIME_ENTRY.ADJUSTED",
      entity: "TimeEntry",
      entityId: updated.id,
      ipAddress: ipAddress ?? null,
      metadata: {
        accessProfileId: updated.accessProfileId,
        personId: updated.accessProfile.person.id,
        plantId: updated.plantId,
        openedAt: updated.openedAt.toISOString(),
        closedAt: updated.closedAt?.toISOString() ?? null,
        totalMinutes: updated.totalMinutes,
        notes: updated.notes,
      },
    });

    await this.publishOperationalEvent("entry.adjusted", updated);

    return serializeTimeEntry(updated);
  }
}
