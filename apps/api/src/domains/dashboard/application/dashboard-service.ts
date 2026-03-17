import { prisma } from "@/core/database/prisma-client";

function calculateElapsedMinutes(openedAt: Date) {
  return Math.max(0, Math.round((Date.now() - openedAt.getTime()) / 60000));
}

export class DashboardService {
  async getOverview(organizationId: string, plantId?: string) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [openEntries, recordsToday, activityByPlantToday, liveEntries, closedTodayByPlant] =
      await Promise.all([
        prisma.timeEntry.findMany({
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
        prisma.timeEntry.groupBy({
          by: ["plantId"],
          where: {
            organizationId,
            plantId: plantId ?? undefined,
            openedAt: {
              gte: startOfToday,
            },
          },
        }),
        prisma.timeEntry.findMany({
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
    const activePeople = new Set(openEntries.map((entry) => entry.accessProfileId)).size;

    const overtimeAlerts = openEntries
      .filter((entry) => {
        const lateMinutes = entry.plant.lateAlertMinutes;
        return calculateElapsedMinutes(entry.openedAt) > lateMinutes;
      })
      .map((entry) => ({
        id: entry.id,
        personName: entry.accessProfile.person.fullName,
        plantName: entry.plant.name,
        minutesOpen: calculateElapsedMinutes(entry.openedAt),
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
      activePeople,
      openEntries: openEntries.length,
      recordsToday,
      plantsWithActivityToday: activityByPlantToday.length,
      peopleWithoutExit: openEntries.length,
      hoursByPlantToday,
      presenceRanking,
      overtimeAlerts,
      liveEntries: liveEntries.map((entry) => ({
        id: entry.id,
        personName: entry.accessProfile.person.fullName,
        personType: entry.accessProfile.personType,
        plantName: entry.plant.name,
        openedAt: entry.openedAt.toISOString(),
        elapsedMinutes: calculateElapsedMinutes(entry.openedAt),
        status: entry.status,
      })),
    };
  }
}
