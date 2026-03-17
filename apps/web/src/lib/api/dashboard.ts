import { httpClient } from "./http-client";
import { fetchWithQueryCache, normalizeQueryParams } from "./query-cache";

export interface DashboardOverview {
  activePeople: number;
  openEntries: number;
  recordsToday: number;
  plantsWithActivityToday: number;
  peopleWithoutExit: number;
  hoursByPlantToday: Array<{
    plantId: string;
    plantName: string;
    totalMinutes: number;
    records: number;
  }>;
  presenceRanking: Array<{
    plantId: string;
    plantName: string;
    totalMinutes: number;
    records: number;
  }>;
  overtimeAlerts: Array<{
    id: string;
    personName: string;
    plantName: string;
    minutesOpen: number;
  }>;
  liveEntries: Array<{
    id: string;
    personName: string;
    personType: string;
    plantName: string;
    openedAt: string;
    elapsedMinutes: number;
    status: "OPEN" | "CLOSED" | "ADJUSTED" | "AUTO_CLOSED";
  }>;
}

export async function fetchDashboardOverview(plantId?: string) {
  const normalizedParams = normalizeQueryParams({
    plantId: plantId && plantId !== "all" ? plantId : undefined,
  });

  return fetchWithQueryCache(
    ["dashboard-overview", normalizedParams ?? {}],
    async () => {
      const response = await httpClient.get<DashboardOverview>("/dashboard/overview", {
        params: normalizedParams,
      });

      return response.data;
    },
    { ttlMs: 1500 },
  );
}
