import { httpClient } from "./http-client";
import { downloadAuthenticatedFile } from "./file-download";
import { fetchWithQueryCache, invalidateQueryCache, normalizeQueryParams } from "./query-cache";
import { resolveApiOrigin } from "@/lib/network/runtime-url";

export interface Person {
  id: string;
  personId: string;
  fullName: string;
  cpf: string;
  personType: string;
  employer: string;
  jobTitle: string;
  email?: string | null;
  phone?: string | null;
  photoUrl?: string | null;
  notes?: string | null;
  status: string;
  homePlantId?: string | null;
  homePlant?: {
    id: string;
    name: string;
  } | null;
  _count?: {
    timeEntries: number;
  };
}

export interface PersonDetails extends Person {
  history: Array<{
    id: string;
    openedAt: string;
    closedAt?: string | null;
    totalMinutes?: number | null;
    status: string;
    plant: {
      id: string;
      name: string;
    };
  }>;
  totalMinutes: number;
}

export async function fetchPeople(params?: {
  search?: string;
  status?: string;
  personType?: string;
  plantId?: string;
}) {
  const normalizedParams = normalizeQueryParams(params);

  return fetchWithQueryCache(["people", normalizedParams ?? {}], async () => {
    const response = await httpClient.get<Person[]>("/people", { params: normalizedParams });
    return response.data;
  });
}

export async function fetchPerson(personId: string) {
  return fetchWithQueryCache(["person", personId], async () => {
    const response = await httpClient.get<PersonDetails>(`/people/${personId}`);
    return response.data;
  });
}

export async function createPerson(payload: Omit<Person, "id" | "personId" | "homePlant" | "_count">) {
  const response = await httpClient.post<Person>("/people", payload);
  invalidateQueryCache(["people", "person", "time-entries", "live-time-entries", "dashboard-overview", "reports-summary"]);
  return response.data;
}

export async function updatePerson(
  personId: string,
  payload: Partial<Omit<Person, "id" | "personId" | "homePlant" | "_count">>,
) {
  const response = await httpClient.patch<Person>(`/people/${personId}`, payload);
  invalidateQueryCache(["people", "person", "time-entries", "live-time-entries", "dashboard-overview", "reports-summary"]);
  return response.data;
}

export function buildPersonHistoryExportUrl(personId: string, params?: {
  from?: string;
  to?: string;
  status?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.from) searchParams.set("from", params.from);
  if (params?.to) searchParams.set("to", params.to);
  if (params?.status && params.status !== "ALL") searchParams.set("status", params.status);
  const query = searchParams.toString();
  const base = resolveApiOrigin();
  return `${base}/api/v1/people/${personId}/export${query ? `?${query}` : ""}`;
}

export async function downloadPersonHistoryExport(personId: string, params?: {
  from?: string;
  to?: string;
  status?: string;
}) {
  return downloadAuthenticatedFile(`/people/${personId}/export`, {
    params: {
      from: params?.from,
      to: params?.to,
      status: params?.status && params.status !== "ALL" ? params.status : undefined,
    },
    fallbackFileName: `person-${personId}-history.csv`,
  });
}
