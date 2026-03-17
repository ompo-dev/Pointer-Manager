import { PersonType, Prisma, type AccessProfileStatus } from "@prisma/client";
import { prisma } from "@api/core/database/prisma-client";
import { AuditService } from "@api/domains/audit/application/audit-service";
import { normalizeCpf } from "@api/domains/time-entries/domain/access-subject-policy";
import { toCsv } from "@api/shared/kernel/csv";
import { DomainError } from "@api/shared/kernel/domain-error";

interface ListPeopleFilters {
  search?: string;
  status?: AccessProfileStatus | "ALL";
  personType?: PersonType | "ALL";
  plantId?: string;
}

interface UpsertPersonInput {
  organizationId: string;
  homePlantId?: string | null;
  fullName: string;
  cpf: string;
  personType?: PersonType;
  employer: string;
  jobTitle: string;
  email?: string | null;
  phone?: string | null;
  photoUrl?: string | null;
  notes?: string | null;
  status?: AccessProfileStatus;
}

interface HistoryFilters {
  from?: Date;
  to?: Date;
  status?: string;
  plantId?: string;
}

interface AuditActorContext {
  userId: string;
  ipAddress?: string | null;
}

function buildPeopleFilters(
  organizationId: string,
  filters?: ListPeopleFilters,
): Prisma.AccessProfileWhereInput {
  return {
    organizationId,
    homePlantId: filters?.plantId,
    status:
      filters?.status && filters.status !== "ALL"
        ? filters.status
        : undefined,
    personType:
      filters?.personType && filters.personType !== "ALL"
        ? filters.personType
        : undefined,
    OR: filters?.search
      ? [
          {
            person: {
              is: {
                fullName: {
                  contains: filters.search,
                  mode: "insensitive",
                },
              },
            },
          },
          {
            person: {
              is: {
                cpf: {
                  contains: filters.search,
                  mode: "insensitive",
                },
              },
            },
          },
          { employer: { contains: filters.search, mode: "insensitive" } },
          { jobTitle: { contains: filters.search, mode: "insensitive" } },
        ]
      : undefined,
  };
}

function serializePersonHistoryEntry(
  entry: {
    id: string;
    openedAt: Date;
    closedAt: Date | null;
    totalMinutes: number | null;
    status: string;
    plant: {
      id: string;
      name: string;
    };
  },
) {
  return {
    ...entry,
    openedAt: entry.openedAt.toISOString(),
    closedAt: entry.closedAt?.toISOString() ?? null,
  };
}

function serializePerson(
  accessProfile: {
    id: string;
    personType: string;
    employer: string;
    jobTitle: string;
    email: string | null;
    phone: string | null;
    photoUrl: string | null;
    notes: string | null;
    status: string;
    homePlantId: string | null;
    person: {
      id: string;
      fullName: string;
      cpf: string;
    };
    homePlant?: {
      id: string;
      name: string;
    } | null;
    _count?: {
      timeEntries: number;
    };
  },
) {
  return {
    id: accessProfile.id,
    fullName: accessProfile.person.fullName,
    cpf: accessProfile.person.cpf,
    personType: accessProfile.personType,
    employer: accessProfile.employer,
    jobTitle: accessProfile.jobTitle,
    email: accessProfile.email,
    phone: accessProfile.phone,
    photoUrl: accessProfile.photoUrl,
    notes: accessProfile.notes,
    status: accessProfile.status,
    homePlantId: accessProfile.homePlantId,
    personId: accessProfile.person.id,
    homePlant: accessProfile.homePlant ?? null,
    _count: accessProfile._count,
  };
}

function toAuditPayload(
  accessProfile: {
    id: string;
    organizationId: string;
    personType: string;
    employer: string;
    jobTitle: string;
    email: string | null;
    phone: string | null;
    photoUrl: string | null;
    notes: string | null;
    status: string;
    homePlantId: string | null;
    person: {
      id: string;
      fullName: string;
      cpf: string;
    };
  },
) {
  return {
    personId: accessProfile.person.id,
    fullName: accessProfile.person.fullName,
    cpf: accessProfile.person.cpf,
    personType: accessProfile.personType,
    employer: accessProfile.employer,
    jobTitle: accessProfile.jobTitle,
    email: accessProfile.email,
    phone: accessProfile.phone,
    photoUrl: accessProfile.photoUrl,
    notes: accessProfile.notes,
    status: accessProfile.status,
    homePlantId: accessProfile.homePlantId,
  };
}

export class PeopleService {
  constructor(private readonly auditService: AuditService) {}

  private async resolvePersonForProfile(
    transaction: Prisma.TransactionClient,
    input: Pick<UpsertPersonInput, "cpf" | "fullName">,
  ) {
    const normalizedCpf = normalizeCpf(input.cpf);

    if (normalizedCpf.length !== 11) {
      throw new DomainError("Informe um CPF valido.", 422);
    }

    const existingPerson = await transaction.person.findUnique({
      where: { cpf: normalizedCpf },
    });

    if (existingPerson) {
      if (existingPerson.fullName !== input.fullName) {
        return transaction.person.update({
          where: { id: existingPerson.id },
          data: {
            fullName: input.fullName,
          },
        });
      }

      return existingPerson;
    }

    return transaction.person.create({
      data: {
        cpf: normalizedCpf,
        fullName: input.fullName,
      },
    });
  }

  async list(organizationId: string, filters?: ListPeopleFilters) {
    const accessProfiles = await prisma.accessProfile.findMany({
      where: buildPeopleFilters(organizationId, filters),
      include: {
        person: true,
        homePlant: true,
        _count: {
          select: {
            timeEntries: {
              where: {
                status: "OPEN",
              },
            },
          },
        },
      },
      orderBy: {
        person: {
          fullName: "asc",
        },
      },
    });

    return accessProfiles.map(serializePerson);
  }

  async getById(organizationId: string, personId: string, plantScopeId?: string | null) {
    const accessProfile = await prisma.accessProfile.findFirst({
      where: {
        id: personId,
        organizationId,
        homePlantId: plantScopeId ?? undefined,
      },
      include: {
        person: true,
        homePlant: true,
      },
    });

    if (!accessProfile) {
      throw new DomainError("Pessoa nao encontrada.", 404);
    }

    const history = await prisma.timeEntry.findMany({
      where: {
        organizationId,
        accessProfileId: personId,
        plantId: plantScopeId ?? undefined,
      },
      include: {
        plant: true,
      },
      orderBy: {
        openedAt: "desc",
      },
      take: 100,
    });

    const totalMinutes = history.reduce((accumulator, entry) => {
      return accumulator + (entry.totalMinutes ?? 0);
    }, 0);

    return {
      ...serializePerson(accessProfile),
      history: history.map(serializePersonHistoryEntry),
      totalMinutes,
    };
  }

  async create(input: UpsertPersonInput, actor: AuditActorContext) {
    return prisma.$transaction(async (transaction) => {
      const person = await this.resolvePersonForProfile(transaction, {
        cpf: input.cpf,
        fullName: input.fullName,
      });
      const existingProfile = await transaction.accessProfile.findFirst({
        where: {
          organizationId: input.organizationId,
          personId: person.id,
        },
      });

      if (existingProfile) {
        throw new DomainError("Ja existe uma pessoa cadastrada para este CPF neste cliente.", 409);
      }

      const accessProfile = await transaction.accessProfile.create({
        data: {
          organizationId: input.organizationId,
          personId: person.id,
          homePlantId: input.homePlantId ?? null,
          personType: input.personType ?? "EMPLOYEE",
          employer: input.employer,
          jobTitle: input.jobTitle,
          email: input.email ?? null,
          phone: input.phone ?? null,
          photoUrl: input.photoUrl ?? null,
          notes: input.notes ?? null,
          status: input.status ?? "ACTIVE",
        },
        include: {
          person: true,
          homePlant: true,
        },
      });

      await this.auditService.record({
        organizationId: input.organizationId,
        actorUserId: actor.userId,
        action: "PERSON.CREATED",
        entity: "AccessProfile",
        entityId: accessProfile.id,
        ipAddress: actor.ipAddress ?? null,
        metadata: {
          after: toAuditPayload(accessProfile),
        },
      });

      return serializePerson(accessProfile);
    });
  }

  async update(
    organizationId: string,
    personId: string,
    input: Partial<UpsertPersonInput>,
    actor: AuditActorContext,
    plantScopeId?: string | null,
  ) {
    const existing = await prisma.accessProfile.findFirst({
      where: {
        id: personId,
        organizationId,
        homePlantId: plantScopeId ?? undefined,
      },
      include: {
        person: true,
        homePlant: true,
      },
    });

    if (!existing) {
      throw new DomainError("Pessoa nao encontrada.", 404);
    }

    return prisma.$transaction(async (transaction) => {
      const targetPerson =
        input.cpf || input.fullName
          ? await this.resolvePersonForProfile(transaction, {
              cpf: input.cpf ?? existing.person.cpf,
              fullName: input.fullName ?? existing.person.fullName,
            })
          : existing.person;

      const conflictingProfile = await transaction.accessProfile.findFirst({
        where: {
          organizationId,
          personId: targetPerson.id,
          NOT: {
            id: existing.id,
          },
        },
      });

      if (conflictingProfile) {
        throw new DomainError("Ja existe uma pessoa cadastrada para este CPF neste cliente.", 409);
      }

      const updated = await transaction.accessProfile.update({
        where: {
          id: existing.id,
        },
        data: {
          personId: targetPerson.id,
          homePlantId:
            input.homePlantId === undefined ? undefined : input.homePlantId,
          personType: input.personType,
          employer: input.employer,
          jobTitle: input.jobTitle,
          email: input.email === undefined ? undefined : input.email,
          phone: input.phone === undefined ? undefined : input.phone,
          photoUrl: input.photoUrl === undefined ? undefined : input.photoUrl,
          notes: input.notes === undefined ? undefined : input.notes,
          status: input.status,
        },
        include: {
          person: true,
          homePlant: true,
        },
      });

      await this.auditService.record({
        organizationId,
        actorUserId: actor.userId,
        action: "PERSON.UPDATED",
        entity: "AccessProfile",
        entityId: updated.id,
        ipAddress: actor.ipAddress ?? null,
        metadata: {
          before: toAuditPayload(existing),
          after: toAuditPayload(updated),
        },
      });

      return serializePerson(updated);
    });
  }

  async listHistory(organizationId: string, personId: string, filters?: HistoryFilters) {
    const history = await prisma.timeEntry.findMany({
      where: {
        organizationId,
        accessProfileId: personId,
        plantId: filters?.plantId,
        status: filters?.status ? (filters.status as never) : undefined,
        openedAt:
          filters?.from || filters?.to
            ? {
                gte: filters.from,
                lte: filters.to,
              }
            : undefined,
      },
      include: {
        plant: true,
      },
      orderBy: {
        openedAt: "desc",
      },
      take: 200,
    });

    return history.map(serializePersonHistoryEntry);
  }

  async exportHistory(organizationId: string, personId: string, filters?: HistoryFilters) {
    const history = await prisma.timeEntry.findMany({
      where: {
        organizationId,
        accessProfileId: personId,
        plantId: filters?.plantId,
        status: filters?.status ? (filters.status as never) : undefined,
        openedAt:
          filters?.from || filters?.to
            ? {
                gte: filters.from,
                lte: filters.to,
              }
            : undefined,
      },
      include: {
        plant: true,
        accessProfile: {
          include: {
            person: true,
          },
        },
      },
      orderBy: {
        openedAt: "desc",
      },
      take: 200,
    });

    return toCsv(
      history.map((entry) => ({
        person: entry.accessProfile.person.fullName,
        cpf: entry.accessProfile.person.cpf,
        plant: entry.plant.name,
        openedAt: entry.openedAt.toISOString(),
        closedAt: entry.closedAt?.toISOString() ?? "",
        totalMinutes: entry.totalMinutes ?? 0,
        status: entry.status,
        deviceIp: entry.deviceIp ?? "",
        deviceLabel: entry.deviceLabel ?? "",
      })),
    );
  }
}
