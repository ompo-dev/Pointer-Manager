import { EmployeeStatus, PersonType, Prisma } from "@prisma/client";
import { prisma } from "@/core/database/prisma-client";
import { toCsv } from "@/shared/kernel/csv";
import { DomainError } from "@/shared/kernel/domain-error";

interface ListPeopleFilters {
  search?: string;
  status?: EmployeeStatus | "ALL";
  personType?: PersonType | "ALL";
  plantId?: string;
}

interface UpsertPersonInput {
  organizationId: string;
  primaryPlantId?: string | null;
  fullName: string;
  cpf: string;
  personType?: PersonType;
  employer: string;
  jobTitle: string;
  email?: string | null;
  phone?: string | null;
  photoUrl?: string | null;
  notes?: string | null;
  status?: EmployeeStatus;
}

interface HistoryFilters {
  from?: Date;
  to?: Date;
  status?: string;
}

function buildPeopleFilters(organizationId: string, filters?: ListPeopleFilters): Prisma.EmployeeWhereInput {
  return {
    organizationId,
    primaryPlantId: filters?.plantId,
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
          { fullName: { contains: filters.search, mode: "insensitive" } },
          { cpf: { contains: filters.search, mode: "insensitive" } },
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

export class EmployeesService {
  async list(organizationId: string, filters?: ListPeopleFilters) {
    return prisma.employee.findMany({
      where: buildPeopleFilters(organizationId, filters),
      include: {
        primaryPlant: true,
        _count: {
          select: {
            timeEntries: {
              where: { status: "OPEN" },
            },
          },
        },
      },
      orderBy: { fullName: "asc" },
    });
  }

  async getById(organizationId: string, personId: string) {
    const person = await prisma.employee.findFirst({
      where: {
        id: personId,
        organizationId,
      },
      include: {
        primaryPlant: true,
      },
    });

    if (!person) {
      throw new DomainError("Pessoa nao encontrada.", 404);
    }

    const history = await prisma.timeEntry.findMany({
      where: {
        organizationId,
        employeeId: personId,
      },
      include: {
        plant: true,
      },
      orderBy: { openedAt: "desc" },
      take: 100,
    });

    const totalMinutes = history.reduce((accumulator, entry) => {
      return accumulator + (entry.totalMinutes ?? 0);
    }, 0);

    return {
      ...person,
      history: history.map(serializePersonHistoryEntry),
      totalMinutes,
    };
  }

  async create(input: UpsertPersonInput) {
    return prisma.employee.create({
      data: {
        organizationId: input.organizationId,
        primaryPlantId: input.primaryPlantId ?? null,
        fullName: input.fullName,
        cpf: input.cpf,
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
        primaryPlant: true,
      },
    });
  }

  async update(organizationId: string, personId: string, input: Partial<UpsertPersonInput>) {
    const existing = await prisma.employee.findFirst({
      where: {
        id: personId,
        organizationId,
      },
    });

    if (!existing) {
      throw new DomainError("Pessoa nao encontrada.", 404);
    }

    return prisma.employee.update({
      where: { id: personId },
      data: {
        primaryPlantId:
          input.primaryPlantId === undefined ? undefined : input.primaryPlantId,
        fullName: input.fullName,
        cpf: input.cpf,
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
        primaryPlant: true,
      },
    });
  }

  async listHistory(organizationId: string, personId: string, filters?: HistoryFilters) {
    const history = await prisma.timeEntry.findMany({
      where: {
        organizationId,
        employeeId: personId,
        status: filters?.status ? (filters.status as never) : undefined,
        openedAt: filters?.from || filters?.to
          ? {
              gte: filters.from,
              lte: filters.to,
            }
          : undefined,
      },
      include: {
        plant: true,
      },
      orderBy: { openedAt: "desc" },
      take: 200,
    });

    return history.map(serializePersonHistoryEntry);
  }

  async exportHistory(organizationId: string, personId: string, filters?: HistoryFilters) {
    const history = await prisma.timeEntry.findMany({
      where: {
        organizationId,
        employeeId: personId,
        status: filters?.status ? (filters.status as never) : undefined,
        openedAt: filters?.from || filters?.to
          ? {
              gte: filters.from,
              lte: filters.to,
            }
          : undefined,
      },
      include: {
        plant: true,
      },
      orderBy: { openedAt: "desc" },
      take: 200,
    });

    return toCsv(
      history.map((entry) => ({
        person: entry.employeeId,
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
