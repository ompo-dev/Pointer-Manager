import { PersonType, Prisma, type TimeEntry, type TimeEntryStatus } from "@prisma/client";
import { prisma } from "@/core/database/prisma-client";
import { OperationsHub } from "@/core/realtime/operations-hub";
import { detectPlantNetwork } from "@/domains/plants/domain/network-detection";
import { AuditService } from "@/domains/audit/application/audit-service";
import {
  getAccessSubjectPolicy,
  listAccessSubjectPolicies,
  normalizeCpf,
  normalizeOptionalText,
} from "@/domains/time-entries/domain/access-subject-policy";
import type { AuthenticatedUser } from "@/domains/auth/application/auth-service";
import {
  evaluatePlantNetworkAccess,
  evaluatePlantLocationAccess,
  validatePlantAccess,
} from "@/domains/time-entries/domain/access-validation";
import { DomainError } from "@/shared/kernel/domain-error";

interface ListEntriesFilters {
  organizationId: string;
  plantId?: string;
  employeeId?: string;
  status?: TimeEntryStatus | "ALL";
  search?: string;
  from?: Date;
  to?: Date;
}

interface RegisterEntryInput {
  cpf: string;
  plantToken?: string | null;
  plantId?: string | null;
  fullName?: string;
  employer?: string;
  jobTitle?: string;
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
  plantToken?: string | null;
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

interface AccessPersonSnapshot {
  id: string;
  fullName: string;
  cpf: string;
  personType: string;
  employer: string;
  jobTitle: string;
  status: string;
}

type PublicDeviceResolutionInput = Pick<
  RegisterEntryInput,
  | "deviceIp"
  | "wifiSsid"
  | "wifiBssid"
  | "browserIpCandidates"
  | "networkType"
>;

type PublicPlantReference = {
  plantId?: string | null;
  plantToken?: string | null;
};

function isLoopbackIp(value?: string | null) {
  return value === "127.0.0.1" || value === "::1";
}

function buildEntrySearchFilters(filters: ListEntriesFilters): Prisma.TimeEntryWhereInput {
  return {
    organizationId: filters.organizationId,
    plantId: filters.plantId,
    employeeId: filters.employeeId,
    status:
      filters.status && filters.status !== "ALL"
        ? filters.status
        : undefined,
    openedAt: filters.from || filters.to
      ? {
          gte: filters.from,
          lte: filters.to,
        }
      : undefined,
    OR: filters.search
      ? [
          {
            employee: {
              is: {
                fullName: { contains: filters.search, mode: "insensitive" },
              },
            },
          },
          {
            employee: {
              is: {
                cpf: { contains: filters.search, mode: "insensitive" },
              },
            },
          },
          {
            plant: {
              is: {
                name: { contains: filters.search, mode: "insensitive" },
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

function serializeAccessPerson(person: AccessPersonSnapshot) {
  return {
    id: person.id,
    fullName: person.fullName,
    cpf: person.cpf,
    personType: person.personType,
    employer: person.employer,
    jobTitle: person.jobTitle,
    status: person.status,
  };
}

function serializeTimeEntry(
  entry: TimeEntry & {
    employee: {
      id: string;
      fullName: string;
      cpf: string;
      personType: string;
      employer: string;
    };
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
  },
) {
  return {
    ...entry,
    openedAt: entry.openedAt.toISOString(),
    closedAt: entry.closedAt?.toISOString() ?? null,
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

  private async resolvePublicPlant(reference: PublicPlantReference) {
    if (reference.plantId) {
      return await prisma.plant.findUnique({
        where: { id: reference.plantId },
        include: {
          authorizedNetworks: true,
        },
      });
    }

    if (reference.plantToken) {
      return await prisma.plant.findUnique({
        where: { qrToken: reference.plantToken },
        include: {
          authorizedNetworks: true,
        },
      });
    }

    throw new DomainError("Identificador publico da usina nao informado.", 422);
  }

  private async publishOperationalEvent(
    type: "entry.created" | "entry.closed" | "entry.adjusted",
    entry: {
      id: string;
      organizationId: string;
      plantId: string;
      openedAt?: Date;
      totalMinutes?: number | null;
      status?: string;
      employee: { fullName: string };
      plant: { name: string };
    },
  ) {
    const payload =
      type === "entry.closed"
        ? {
            entryId: entry.id,
            personName: entry.employee.fullName,
            plantName: entry.plant.name,
            totalMinutes: entry.totalMinutes ?? 0,
            status: entry.status ?? "CLOSED",
          }
        : {
            entryId: entry.id,
            personName: entry.employee.fullName,
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
      fullName: string;
      employer: string;
      jobTitle: string;
      personType: PersonType;
      email: string | null;
      phone: string | null;
      photoUrl: string | null;
      notes: string | null;
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
      email: normalizeOptionalText(input.email) ?? existing?.email ?? undefined,
      phone: normalizeOptionalText(input.phone) ?? existing?.phone ?? undefined,
      photoUrl: normalizeOptionalText(input.photoUrl) ?? existing?.photoUrl ?? undefined,
      notes: normalizeOptionalText(input.notes) ?? existing?.notes ?? undefined,
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

  private async ensurePersonForAccess(input: RegisterEntryInput, organizationId: string, plantId: string) {
    const normalizedCpf = normalizeCpf(input.cpf);
    if (normalizedCpf.length !== 11) {
      throw new DomainError("Informe um CPF valido para registrar o acesso.", 422);
    }

    const existing = await prisma.employee.findUnique({
      where: { cpf: normalizedCpf },
    });

    const normalizedPersonData = this.buildNormalizedPersonData(
      {
        ...input,
        cpf: normalizedCpf,
      },
      existing
        ? {
            fullName: existing.fullName,
            employer: existing.employer,
            jobTitle: existing.jobTitle,
            personType: existing.personType,
            email: existing.email,
            phone: existing.phone,
            photoUrl: existing.photoUrl,
            notes: existing.notes,
          }
        : undefined,
    );

    if (existing) {
      return prisma.employee.update({
        where: { id: existing.id },
        data: {
          primaryPlantId: existing.primaryPlantId ?? plantId,
          fullName: normalizedPersonData.fullName ?? existing.fullName,
          employer: normalizedPersonData.employer ?? existing.employer,
          jobTitle: normalizedPersonData.jobTitle ?? existing.jobTitle,
          personType: normalizedPersonData.personType ?? existing.personType,
          email: input.email === undefined ? existing.email : normalizedPersonData.email ?? null,
          phone: input.phone === undefined ? existing.phone : normalizedPersonData.phone ?? null,
          photoUrl: input.photoUrl === undefined ? existing.photoUrl : normalizedPersonData.photoUrl ?? null,
          notes: input.notes === undefined ? existing.notes : normalizedPersonData.notes ?? null,
          status: existing.status === "INACTIVE" ? "ACTIVE" : existing.status,
        },
      });
    }

    return prisma.employee.create({
      data: {
        organizationId,
        primaryPlantId: plantId,
        fullName: normalizedPersonData.fullName!,
        cpf: normalizedCpf,
        employer: normalizedPersonData.employer,
        jobTitle: normalizedPersonData.jobTitle,
        personType: normalizedPersonData.personType,
        email: normalizedPersonData.email ?? null,
        phone: normalizedPersonData.phone ?? null,
        photoUrl: normalizedPersonData.photoUrl ?? null,
        notes: normalizedPersonData.notes ?? null,
        status: "ACTIVE",
      },
    });
  }

  private async finalizeEntry(
    entry: TimeEntry & {
      employee: { fullName: string };
      plant: { name: string };
    },
    data: {
      status: TimeEntryStatus;
      deviceIp?: string | null;
      closedReason: string;
      notes?: string | null;
      adjustedByUserId?: string | null;
      origin?: "QR_CODE" | "PANEL" | "MANUAL_ADJUSTMENT" | "AUTO_CLOSED";
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
        employee: true,
        plant: true,
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
        employeeId: updated.employeeId,
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
        employee: true,
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
        employee: true,
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
        employee: true,
        plant: true,
      },
      orderBy: { openedAt: "desc" },
    });

    return entries.map(serializeTimeEntry);
  }

  async getAccessIntakeContext(input: { cpf: string; plantToken?: string | null; plantId?: string | null }) {
    const normalizedCpf = normalizeCpf(input.cpf);
    if (normalizedCpf.length !== 11) {
      throw new DomainError("Informe um CPF valido para consultar o acesso.", 422);
    }

    const plant = await this.resolvePublicPlant(input);

    if (!plant || plant.status !== "ACTIVE") {
      throw new DomainError("Usina indisponivel para registros.", 404);
    }

    const person = await prisma.employee.findUnique({
      where: { cpf: normalizedCpf },
    });

    const openEntry = person
      ? await prisma.timeEntry.findFirst({
          where: {
            employeeId: person.id,
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
      person: person ? serializeAccessPerson(person) : null,
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
    plantToken?: string | null;
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
      ready: evaluation.status !== "BLOCKED" && location.status !== "BLOCKED" && location.status !== "PENDING",
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

    const person = await this.ensurePersonForAccess(
      {
        ...input,
        cpf: normalizedCpf,
      },
      plant.organizationId,
      plant.id,
    );

    if (person.status !== "ACTIVE") {
      throw new DomainError("Pessoa sem autorizacao para entrada.", 403);
    }

    const hasOpenEntry = await prisma.timeEntry.findFirst({
      where: {
        employeeId: person.id,
        status: "OPEN",
      },
    });

    if (hasOpenEntry) {
      throw new DomainError("Ja existe um acesso em aberto para esta pessoa.", 409);
    }

    const entry = await prisma.timeEntry.create({
      data: {
        organizationId: plant.organizationId,
        employeeId: person.id,
        plantId: plant.id,
        origin: "QR_CODE",
        deviceIp: deviceContext.deviceIp ?? null,
        deviceLabel: input.deviceLabel ?? null,
        wifiSsid: deviceContext.wifiSsid ?? null,
        wifiBssid: deviceContext.wifiBssid ?? null,
        selfieUrl: input.selfieUrl ?? null,
        geoLatitude: input.geoLatitude ?? null,
        geoLongitude: input.geoLongitude ?? null,
        validationMode: validation.mode,
        validationNotes,
        notes: input.notes ?? null,
      },
      include: {
        employee: true,
        plant: true,
      },
    });

    await this.auditService.record({
      organizationId: plant.organizationId,
      action: "TIME_ENTRY.OPENED",
      entity: "TimeEntry",
      entityId: entry.id,
      ipAddress: deviceContext.deviceIp ?? null,
      metadata: {
        employeeId: person.id,
        plantId: plant.id,
        personType: person.personType,
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

    if (!plant) {
      throw new DomainError("Usina nao encontrada para este token.", 404);
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

    const person = await prisma.employee.findUnique({
      where: { cpf: normalizedCpf },
    });

    if (!person) {
      throw new DomainError("Pessoa nao encontrada.", 404);
    }

    const entry = await prisma.timeEntry.findFirst({
      where: {
        employeeId: person.id,
        plantId: plant.id,
        status: "OPEN",
      },
      include: {
        employee: true,
        plant: true,
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

  async closeManually(user: AuthenticatedUser, entryId: string, notes?: string) {
    const entry = await prisma.timeEntry.findFirst({
      where: {
        id: entryId,
        organizationId: user.organizationId,
      },
      include: {
        employee: true,
        plant: true,
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
    });
  }

  async adjustEntry(user: AuthenticatedUser, entryId: string, input: AdjustEntryInput) {
    const entry = await prisma.timeEntry.findFirst({
      where: {
        id: entryId,
        organizationId: user.organizationId,
      },
      include: {
        employee: true,
        plant: true,
      },
    });

    if (!entry) {
      throw new DomainError("Registro nao encontrado.", 404);
    }

    const closedAt = input.closedAt === undefined ? entry.closedAt : input.closedAt;
    const totalMinutes =
      closedAt !== null
        ? Math.max(
            0,
            Math.round(
              (closedAt.getTime() - (input.openedAt ?? entry.openedAt).getTime()) / 60000,
            ),
          )
        : null;

    const updated = await prisma.timeEntry.update({
      where: { id: entryId },
      data: {
        openedAt: input.openedAt ?? entry.openedAt,
        closedAt,
        totalMinutes,
        notes: input.notes ?? entry.notes,
        status: input.status ?? "ADJUSTED",
        adjustedByUserId: user.id,
        origin: "MANUAL_ADJUSTMENT",
        closedReason: closedAt ? entry.closedReason ?? "ADJUSTED" : null,
      },
      include: {
        employee: true,
        plant: true,
      },
    });

    await this.auditService.record({
      organizationId: user.organizationId,
      actorUserId: user.id,
      action: "TIME_ENTRY.ADJUSTED",
      entity: "TimeEntry",
      entityId: updated.id,
      metadata: {
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
