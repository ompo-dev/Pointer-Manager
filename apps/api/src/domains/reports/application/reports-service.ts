import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "@/core/database/prisma-client";
import { toCsv } from "@/shared/kernel/csv";

interface ReportFilters {
  organizationId: string;
  plantId?: string;
  from?: Date;
  to?: Date;
}

type ReportType = "hours-by-person" | "hours-by-plant" | "presence" | "overtime";
type ReportRow = Record<string, string | number | null | undefined>;

function calculateInclusiveDays(from: Date, to: Date) {
  const start = new Date(from);
  const end = new Date(to);

  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1);
}

function formatPeriodLabel(filters: ReportFilters) {
  if (!filters.from && !filters.to) {
    return "Periodo: geral";
  }

  const from = filters.from ? filters.from.toISOString().slice(0, 10) : "...";
  const to = filters.to ? filters.to.toISOString().slice(0, 10) : "...";
  return `Periodo: ${from} ate ${to}`;
}

function truncatePdfText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function buildEntryWhere(filters: ReportFilters) {
  return {
    organizationId: filters.organizationId,
    plantId: filters.plantId,
    openedAt:
      filters.from || filters.to
        ? {
            gte: filters.from,
            lte: filters.to,
          }
        : undefined,
  };
}

function buildAccessProfileWhere(filters: ReportFilters) {
  return {
    organizationId: filters.organizationId,
    status: "ACTIVE" as const,
    homePlantId: filters.plantId,
  };
}

export class ReportsService {
  private async resolveReportRows(reportType: ReportType, filters: ReportFilters): Promise<ReportRow[]> {
    switch (reportType) {
      case "hours-by-person":
        return this.hoursByPerson(filters);
      case "hours-by-plant":
        return this.hoursByPlant(filters);
      case "presence":
        return this.presence(filters);
      case "overtime":
        return this.overtime(filters);
      default:
        return [];
    }
  }

  private async buildPdfReport(
    reportType: ReportType,
    filters: ReportFilters,
    rows: ReportRow[],
  ) {
    const document = await PDFDocument.create();
    const regularFont = await document.embedFont(StandardFonts.Helvetica);
    const boldFont = await document.embedFont(StandardFonts.HelveticaBold);
    const pageWidth = 842;
    const pageHeight = 595;
    const margin = 36;
    const title = {
      "hours-by-person": "Relatorio de Horas por Pessoa",
      "hours-by-plant": "Relatorio de Horas por Usina",
      presence: "Relatorio de Presenca e Faltas",
      overtime: "Relatorio de Horas Extras",
    }[reportType];
    const normalizedRows =
      rows.length > 0
        ? rows
        : [
            {
              mensagem: "Nenhum dado encontrado para os filtros informados.",
            },
          ];
    const columns = Object.keys(normalizedRows[0]);
    const columnWidth = (pageWidth - margin * 2) / columns.length;
    const rowHeight = 20;
    const headerMetadata = [
      title,
      formatPeriodLabel(filters),
      `Usina: ${filters.plantId ?? "todas"}`,
    ];

    let page = document.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    const drawPageHeader = () => {
      y = pageHeight - margin;
      page.drawText(headerMetadata[0], {
        x: margin,
        y,
        size: 18,
        font: boldFont,
        color: rgb(0.08, 0.08, 0.1),
      });
      y -= 22;
      page.drawText(headerMetadata[1], {
        x: margin,
        y,
        size: 10,
        font: regularFont,
        color: rgb(0.35, 0.35, 0.4),
      });
      y -= 14;
      page.drawText(headerMetadata[2], {
        x: margin,
        y,
        size: 10,
        font: regularFont,
        color: rgb(0.35, 0.35, 0.4),
      });
      y -= 24;

      columns.forEach((column, index) => {
        page.drawText(truncatePdfText(column, 20), {
          x: margin + index * columnWidth + 4,
          y,
          size: 9,
          font: boldFont,
          color: rgb(0.12, 0.12, 0.14),
        });
      });

      y -= 12;
      page.drawLine({
        start: { x: margin, y },
        end: { x: pageWidth - margin, y },
        thickness: 1,
        color: rgb(0.82, 0.84, 0.88),
      });
      y -= 14;
    };

    drawPageHeader();

    for (const row of normalizedRows) {
      if (y < margin + rowHeight) {
        page = document.addPage([pageWidth, pageHeight]);
        drawPageHeader();
      }

      columns.forEach((column, index) => {
        const rawValue = row[column];
        const value =
          rawValue === null || rawValue === undefined
            ? "-"
            : typeof rawValue === "number"
              ? rawValue.toString()
              : String(rawValue);

        page.drawText(truncatePdfText(value, Math.max(12, Math.floor(columnWidth / 5.2))), {
          x: margin + index * columnWidth + 4,
          y,
          size: 9,
          font: regularFont,
          color: rgb(0.16, 0.16, 0.18),
        });
      });

      y -= rowHeight;
    }

    return document.save();
  }

  async hoursByPerson(filters: ReportFilters) {
    const entries = await prisma.timeEntry.findMany({
      where: buildEntryWhere(filters),
      include: {
        accessProfile: {
          include: {
            person: true,
          },
        },
      },
    });

    const grouped = new Map<string, {
      personId: string;
      fullName: string;
      cpf: string;
      employer: string;
      totalMinutes: number;
      records: number;
    }>();

    for (const entry of entries) {
      const current = grouped.get(entry.accessProfileId) ?? {
        personId: entry.accessProfileId,
        fullName: entry.accessProfile.person.fullName,
        cpf: entry.accessProfile.person.cpf,
        employer: entry.accessProfile.employer,
        totalMinutes: 0,
        records: 0,
      };

      current.totalMinutes += entry.totalMinutes ?? 0;
      current.records += 1;
      grouped.set(entry.accessProfileId, current);
    }

    return [...grouped.values()].sort((left, right) => right.totalMinutes - left.totalMinutes);
  }

  async hoursByPlant(filters: ReportFilters) {
    const entries = await prisma.timeEntry.findMany({
      where: buildEntryWhere(filters),
      include: {
        plant: true,
      },
    });

    const grouped = new Map<string, {
      plantId: string;
      plantName: string;
      totalMinutes: number;
      records: number;
    }>();

    for (const entry of entries) {
      const current = grouped.get(entry.plantId) ?? {
        plantId: entry.plantId,
        plantName: entry.plant.name,
        totalMinutes: 0,
        records: 0,
      };

      current.totalMinutes += entry.totalMinutes ?? 0;
      current.records += 1;
      grouped.set(entry.plantId, current);
    }

    return [...grouped.values()].sort((left, right) => right.totalMinutes - left.totalMinutes);
  }

  async presence(filters: ReportFilters) {
    const [profiles, entries] = await Promise.all([
      prisma.accessProfile.findMany({
        where: buildAccessProfileWhere(filters),
        include: {
          person: true,
        },
        orderBy: {
          person: {
            fullName: "asc",
          },
        },
      }),
      prisma.timeEntry.findMany({
        where: buildEntryWhere(filters),
        include: {
          accessProfile: {
            include: {
              person: true,
            },
          },
        },
      }),
    ]);

    const grouped = new Map<string, Set<string>>();

    for (const entry of entries) {
      const dayKey = entry.openedAt.toISOString().slice(0, 10);
      const current = grouped.get(entry.accessProfileId) ?? new Set<string>();
      current.add(dayKey);
      grouped.set(entry.accessProfileId, current);
    }

    const totalPeriodDays =
      filters.from && filters.to ? calculateInclusiveDays(filters.from, filters.to) : null;

    return profiles.map((profile) => {
      const presentDays = grouped.get(profile.id)?.size ?? 0;

      return {
        personId: profile.id,
        fullName: profile.person.fullName,
        cpf: profile.person.cpf,
        presentDays,
        absences: totalPeriodDays === null ? 0 : Math.max(0, totalPeriodDays - presentDays),
      };
    });
  }

  async overtime(filters: ReportFilters) {
    const entries = await prisma.timeEntry.findMany({
      where: buildEntryWhere(filters),
      include: {
        accessProfile: {
          include: {
            person: true,
          },
        },
        plant: true,
      },
    });

    return entries
      .filter((entry) => (entry.totalMinutes ?? 0) > 8 * 60)
      .map((entry) => ({
        entryId: entry.id,
        fullName: entry.accessProfile.person.fullName,
        plantName: entry.plant.name,
        totalMinutes: entry.totalMinutes ?? 0,
        extraMinutes: (entry.totalMinutes ?? 0) - 8 * 60,
      }))
      .sort((left, right) => right.extraMinutes - left.extraMinutes);
  }

  async summary(filters: ReportFilters) {
    const [hoursByPerson, hoursByPlant, presence, overtime] = await Promise.all([
      this.hoursByPerson(filters),
      this.hoursByPlant(filters),
      this.presence(filters),
      this.overtime(filters),
    ]);

    return {
      hoursByPerson,
      hoursByPlant,
      presence,
      overtime,
    };
  }

  async exportCsv(reportType: ReportType, filters: ReportFilters) {
    return toCsv(await this.resolveReportRows(reportType, filters));
  }

  async exportPdf(reportType: ReportType, filters: ReportFilters) {
    return this.buildPdfReport(reportType, filters, await this.resolveReportRows(reportType, filters));
  }
}
