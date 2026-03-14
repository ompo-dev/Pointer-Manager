import { httpClient } from "./http-client";
import { fetchWithQueryCache, normalizeQueryParams } from "./query-cache";

export interface ReportsSummary {
  hoursByPerson: Array<{
    employeeId: string;
    fullName: string;
    cpf: string;
    employer: string;
    totalMinutes: number;
    records: number;
  }>;
  hoursByPlant: Array<{
    plantId: string;
    plantName: string;
    totalMinutes: number;
    records: number;
  }>;
  presence: Array<{
    employeeId: string;
    fullName: string;
    cpf: string;
    presentDays: number;
    absences: number;
  }>;
  overtime: Array<{
    entryId: string;
    fullName: string;
    plantName: string;
    totalMinutes: number;
    extraMinutes: number;
  }>;
}

export async function fetchReportsSummary(params?: {
  plantId?: string;
  from?: string;
  to?: string;
}) {
  const normalizedParams = normalizeQueryParams(params);

  return fetchWithQueryCache(["reports-summary", normalizedParams ?? {}], async () => {
    const response = await httpClient.get<ReportsSummary>("/reports/summary", {
      params: normalizedParams,
    });
    return response.data;
  }, { ttlMs: 3000 });
}

export function buildReportExportUrl(params?: {
  type?: "hours-by-person" | "hours-by-plant" | "presence" | "overtime";
  format?: "csv" | "pdf";
  plantId?: string;
  from?: string;
  to?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.type) searchParams.set("type", params.type);
  if (params?.format) searchParams.set("format", params.format);
  if (params?.plantId) searchParams.set("plantId", params.plantId);
  if (params?.from) searchParams.set("from", params.from);
  if (params?.to) searchParams.set("to", params.to);
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:4000";
  return `${base}/api/v1/reports/export?${searchParams.toString()}`;
}
