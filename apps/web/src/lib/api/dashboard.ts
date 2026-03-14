import { httpClient } from "./http-client";
import { fetchWithQueryCache, normalizeQueryParams } from "./query-cache";

export interface DashboardOverview {
  activeEmployees: number;
  openEntries: number;
  recordsToday: number;
  plantsOnline: number;
  employeesWithoutExit: number;
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
    employeeName: string;
    plantName: string;
    minutesOpen: number;
  }>;
  liveEntries: Array<{
    id: string;
    employeeName: string;
    personType: string;
    plantName: string;
    openedAt: string;
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
