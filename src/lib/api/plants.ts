import { fetchWithQueryCache, invalidateQueryCache, normalizeQueryParams } from "./query-cache";
import { httpClient, publicHttpClient } from "./http-client";

export interface AuthorizedNetwork {
  id?: string;
  name: string;
  publicIpv4Cidr?: string | null;
  localIpv4Cidr?: string | null;
  ssid?: string | null;
  bssid?: string | null;
  notes?: string | null;
}

export interface DetectedPlantNetwork {
  observedPublicIp: string | null;
  suggestedPublicIpv4Cidr: string | null;
  selectedCandidateId: string | null;
  localIpAddress: string | null;
  localIpv4Cidr: string | null;
  interfaceName: string | null;
  connectionKind: string | null;
  ssid: string | null;
  bssid: string | null;
  source: string | null;
  confidence: "high" | "medium" | "low";
  canAutoReadWifiIdentity: boolean;
  notes: string;
  localCandidates: Array<{
    id: string;
    label: string;
    connectionKind: string;
    interfaceName: string | null;
    localIpAddress: string | null;
    localIpv4Cidr: string | null;
    ssid: string | null;
    bssid: string | null;
    source: string;
    isCurrent: boolean;
    notes: string | null;
  }>;
}

export interface PlantPersonSummary {
  id: string;
  personId: string;
  fullName: string;
  cpf: string;
  personType: string;
}

export interface Plant {
  id: string;
  code: string;
  name: string;
  city: string;
  state: string;
  timezone: string;
  openingHour: string;
  closingHour: string;
  qrToken: string;
  status: string;
  requireWifiMatch: boolean;
  requireSelfie: boolean;
  autoCloseLimitHours: number;
  lateAlertMinutes: number;
  geofenceLatitude?: number | null;
  geofenceLongitude?: number | null;
  geofenceRadiusMeters?: number | null;
  authorizedNetworks: AuthorizedNetwork[];
  _count?: {
    people: number;
    timeEntries: number;
  };
}

export interface PlantDetails extends Plant {
  presentPeople: Array<{
    id: string;
    openedAt: string;
    person: PlantPersonSummary;
  }>;
  history: Array<{
    id: string;
    openedAt: string;
    closedAt?: string | null;
    status: string;
    totalMinutes?: number | null;
    person: PlantPersonSummary;
  }>;
}

export async function fetchPlants(params?: { search?: string; status?: string }) {
  const normalizedParams = normalizeQueryParams(params);

  return fetchWithQueryCache(["plants", normalizedParams ?? {}], async () => {
    const response = await httpClient.get<Plant[]>("/plants", { params: normalizedParams });
    return response.data;
  });
}

export async function fetchPlant(plantId: string) {
  return fetchWithQueryCache(["plant", plantId], async () => {
    const response = await httpClient.get<PlantDetails>(`/plants/${plantId}`);
    return response.data;
  });
}

export async function detectCurrentPlantNetwork(payload?: {
  browserIpCandidates?: string[];
  browserConnectionType?: string | null;
}) {
  const response = await httpClient.post<DetectedPlantNetwork>(
    "/plants/detect-network",
    payload ?? {},
  );
  return response.data;
}

export interface PlantUpsertPayload {
  code?: string;
  name: string;
  city: string;
  state: string;
  timezone?: string;
  openingHour: string;
  closingHour: string;
  qrToken?: string;
  status?: string;
  requireWifiMatch?: boolean;
  requireSelfie?: boolean;
  autoCloseLimitHours?: number;
  lateAlertMinutes?: number;
  geofenceLatitude?: number | null;
  geofenceLongitude?: number | null;
  geofenceRadiusMeters?: number | null;
  authorizedNetworks: AuthorizedNetwork[];
}

export async function createPlant(payload: PlantUpsertPayload) {
  const response = await httpClient.post<Plant>("/plants", payload);
  invalidateQueryCache(["plants", "plant", "dashboard-overview", "reports-summary"]);
  return response.data;
}

export async function updatePlant(
  plantId: string,
  payload: Partial<PlantUpsertPayload>,
) {
  const response = await httpClient.patch<Plant>(`/plants/${plantId}`, payload);
  invalidateQueryCache(["plants", "plant", "dashboard-overview", "reports-summary"]);
  return response.data;
}

export async function fetchPublicPlant(plantId: string) {
  const response = await publicHttpClient.get<Plant>(`/plants/public/id/${plantId}`);
  return response.data;
}

export async function fetchPublicPlantByToken(qrToken: string) {
  const response = await publicHttpClient.get<Plant>(`/plants/public/token/${qrToken}`);
  return response.data;
}
