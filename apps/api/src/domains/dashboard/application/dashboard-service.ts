import { prisma } from "@/core/database/prisma-client";

export class DashboardService {
  async getOverview(organizationId: string, plantId?: string) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [openEntries, recordsToday, plantsOnline, liveEntries, closedTodayByPlant] =
      await Promise.all([
        prisma.timeEntry.findMany({
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
        }),
        prisma.timeEntry.count({
          where: {
            organizationId,
            plantId: plantId ?? undefined,
            openedAt: {
              gte: startOfToday,
            },
          },
        }),
        prisma.plant.count({
          where: {
            organizationId,
            status: "ACTIVE",
          },
        }),
        prisma.timeEntry.findMany({
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
          take: 8,
        }),
        prisma.timeEntry.groupBy({
          by: ["plantId"],
          where: {
            organizationId,
            plantId: plantId ?? undefined,
            openedAt: {
              gte: startOfToday,
            },
          },
          _sum: {
            totalMinutes: true,
          },
          _count: {
            _all: true,
          },
        }),
      ]);

    const plantIds = closedTodayByPlant.map((item) => item.plantId);
    const plants = plantIds.length
      ? await prisma.plant.findMany({
          where: {
            id: { in: plantIds },
          },
          select: {
            id: true,
            name: true,
          },
        })
      : [];

    const plantNames = new Map(plants.map((plant) => [plant.id, plant.name]));
    const activePeople = new Set(openEntries.map((entry) => entry.employeeId)).size;
    const now = Date.now();

    const overtimeAlerts = openEntries
      .filter((entry) => {
        const lateMinutes = entry.plant.lateAlertMinutes;
        return now - entry.openedAt.getTime() > lateMinutes * 60 * 1000;
      })
      .map((entry) => ({
        id: entry.id,
        employeeName: entry.employee.fullName,
        plantName: entry.plant.name,
        minutesOpen: Math.round((now - entry.openedAt.getTime()) / 60000),
      }));

    const hoursByPlantToday = closedTodayByPlant.map((item) => ({
      plantId: item.plantId,
      plantName: plantNames.get(item.plantId) ?? item.plantId,
      totalMinutes: item._sum.totalMinutes ?? 0,
      records: item._count._all,
    }));

    const presenceRanking = [...hoursByPlantToday].sort((left, right) => {
      if (right.records !== left.records) {
        return right.records - left.records;
      }

      return right.totalMinutes - left.totalMinutes;
    });

    return {
      activeEmployees: activePeople,
      openEntries: openEntries.length,
      recordsToday,
      plantsOnline,
      employeesWithoutExit: openEntries.length,
      hoursByPlantToday,
      presenceRanking,
      overtimeAlerts,
      liveEntries: liveEntries.map((entry) => ({
        id: entry.id,
        employeeName: entry.employee.fullName,
        personType: entry.employee.personType,
        plantName: entry.plant.name,
        openedAt: entry.openedAt.toISOString(),
        status: entry.status,
      })),
    };
  }
}
