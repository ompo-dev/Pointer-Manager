import { httpClient } from "./http-client";
import { fetchWithQueryCache, invalidateQueryCache, normalizeQueryParams } from "./query-cache";

export interface Person {
  id: string;
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
  primaryPlantId?: string | null;
  primaryPlant?: {
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
    const response = await httpClient.get<Person[]>("/employees", { params: normalizedParams });
    return response.data;
  });
}

export async function fetchPerson(personId: string) {
  return fetchWithQueryCache(["person", personId], async () => {
    const response = await httpClient.get<PersonDetails>(`/employees/${personId}`);
    return response.data;
  });
}

export async function createPerson(payload: Omit<Person, "id" | "primaryPlant" | "_count">) {
  const response = await httpClient.post<Person>("/employees", payload);
  invalidateQueryCache(["people", "person", "time-entries", "dashboard-overview", "reports-summary"]);
  return response.data;
}

export async function updatePerson(
  personId: string,
  payload: Partial<Omit<Person, "id" | "primaryPlant" | "_count">>,
) {
  const response = await httpClient.patch<Person>(`/employees/${personId}`, payload);
  invalidateQueryCache(["people", "person", "time-entries", "dashboard-overview", "reports-summary"]);
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
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:4000";
  return `${base}/api/v1/employees/${personId}/export${query ? `?${query}` : ""}`;
}
