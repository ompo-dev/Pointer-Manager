import { httpClient, publicHttpClient } from "./http-client";
import { fetchWithQueryCache, invalidateQueryCache, normalizeQueryParams } from "./query-cache";

function omitNilValues<T extends object>(payload: T) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== null && value !== undefined),
  ) as Partial<T>;
}

export interface TimeEntryRecord {
  id: string;
  openedAt: string;
  closedAt?: string | null;
  totalMinutes?: number | null;
  elapsedMinutes: number;
  status: string;
  origin: string;
  deviceIp?: string | null;
  deviceLabel?: string | null;
  wifiSsid?: string | null;
  wifiBssid?: string | null;
  selfieUrl?: string | null;
  geoLatitude?: number | null;
  geoLongitude?: number | null;
  validationMode?: string | null;
  validationNotes?: string | null;
  notes?: string | null;
  closedReason?: string | null;
  person: {
    id: string;
    personId: string;
    fullName: string;
    cpf: string;
    personType: string;
    employer: string;
    jobTitle: string;
  };
  plant: {
    id: string;
    name: string;
    city: string;
    state: string;
  };
  adjustedByUser?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface AccessPayload {
  cpf: string;
  plantToken: string;
  fullName?: string;
  employer?: string;
  jobTitle?: string;
  personType?: string;
  email?: string | null;
  phone?: string | null;
  photoUrl?: string | null;
  notes?: string | null;
  deviceIp?: string | null;
  deviceLabel?: string | null;
  wifiSsid?: string | null;
  wifiBssid?: string | null;
  selfieUrl?: string | null;
  geoLatitude?: number | null;
  geoLongitude?: number | null;
  browserIpCandidates?: string[];
  networkType?: string | null;
  networkEffectiveType?: string | null;
}

export interface AccessRequiredFieldDefinition {
  name: "fullName" | "employer" | "jobTitle";
  label: string;
  placeholder: string;
}

export interface AccessIntakeContext {
  plant: {
    id: string;
    name: string;
    city: string;
    state: string;
    requireWifiMatch: boolean;
    requireSelfie: boolean;
    requireGeolocation: boolean;
  };
  person: {
    id: string;
    personId: string;
    fullName: string;
    cpf: string;
    personType: string;
    employer: string;
    jobTitle: string;
    status: string;
  } | null;
  openEntry: {
    id: string;
    openedAt: string;
    plantId: string;
    plantName: string;
    samePlant: boolean;
  } | null;
  suggestedMode: "ENTRY" | "EXIT" | "BLOCKED";
  blockedReason: string | null;
  personTypePolicies: Array<{
    personType: string;
    label: string;
    description: string;
    requiredFields: AccessRequiredFieldDefinition[];
  }>;
}

export interface AccessNetworkStatus {
  plant: {
    id: string;
    name: string;
    city: string;
    state: string;
    requireWifiMatch: boolean;
    requireSelfie: boolean;
    requireGeolocation: boolean;
  };
  network: {
    status: "AUTHORIZED" | "BLOCKED" | "OPEN";
    reason: "authorized" | "network" | "cellular" | "open";
    message: string;
    observedIp: string | null;
    currentNetworkName: string | null;
    matched: boolean;
    matchedBy: "ssid" | "bssid" | "cidr" | null;
    matchedNetworkName: string | null;
    browserHintIgnored: boolean;
  };
  location: {
    status: "AUTHORIZED" | "BLOCKED" | "OPEN" | "PENDING";
    reason: "authorized" | "geofence" | "open" | "pending";
    message: string;
    required: boolean;
    observedLatitude: number | null;
    observedLongitude: number | null;
    distanceMeters: number | null;
    radiusMeters: number | null;
  };
  ready: boolean;
}

export async function fetchTimeEntries(params?: {
  search?: string;
  plantId?: string;
  personId?: string;
  status?: string;
  from?: string;
  to?: string;
}) {
  const normalizedParams = normalizeQueryParams(params);

  return fetchWithQueryCache(["time-entries", normalizedParams ?? {}], async () => {
    const response = await httpClient.get<TimeEntryRecord[]>("/time-entries", {
      params: normalizedParams,
    });
    return response.data;
  }, { ttlMs: 3000 });
}

export async function fetchLiveTimeEntries(plantId?: string) {
  const normalizedParams = normalizeQueryParams({
    plantId: plantId && plantId !== "all" ? plantId : undefined,
  });

  return fetchWithQueryCache(["live-time-entries", normalizedParams ?? {}], async () => {
    const response = await httpClient.get<TimeEntryRecord[]>("/time-entries/live", {
      params: normalizedParams,
    });
    return response.data;
  }, { ttlMs: 1500 });
}

export async function fetchAccessIntake(payload: {
  cpf: string;
  plantToken: string;
}) {
  const response = await publicHttpClient.post<AccessIntakeContext>(
    "/time-entries/intake",
    omitNilValues(payload),
  );
  return response.data;
}

export async function fetchAccessNetworkStatus(payload: {
  plantToken: string;
  geoLatitude?: number | null;
  geoLongitude?: number | null;
  browserIpCandidates?: string[];
  networkType?: string | null;
  networkEffectiveType?: string | null;
}) {
  const response = await publicHttpClient.post<AccessNetworkStatus>(
    "/time-entries/network-status",
    omitNilValues(payload),
  );
  return response.data;
}

export async function registerAccessEntry(payload: AccessPayload) {
  const response = await publicHttpClient.post<TimeEntryRecord>(
    "/time-entries/entry",
    omitNilValues(payload),
  );
  invalidateQueryCache(["time-entries", "live-time-entries", "dashboard-overview", "reports-summary", "audit"]);
  return response.data;
}

export async function registerAccessExit(
  payload: Omit<
    AccessPayload,
    "fullName" | "employer" | "jobTitle" | "personType" | "email" | "phone" | "photoUrl" | "notes" | "deviceLabel"
  >,
) {
  const response = await publicHttpClient.post<TimeEntryRecord>(
    "/time-entries/exit",
    omitNilValues(payload),
  );
  invalidateQueryCache(["time-entries", "live-time-entries", "dashboard-overview", "reports-summary", "audit"]);
  return response.data;
}

export async function manualCloseEntry(entryId: string, notes?: string) {
  const response = await httpClient.post<TimeEntryRecord>(`/time-entries/${entryId}/close`, {
    notes,
  });
  invalidateQueryCache(["time-entries", "live-time-entries", "dashboard-overview", "reports-summary", "audit"]);
  return response.data;
}

export async function adjustEntry(
  entryId: string,
  payload: {
    openedAt?: string;
    closedAt?: string | null;
    notes?: string | null;
    status?: string;
  },
) {
  const response = await httpClient.post<TimeEntryRecord>(`/time-entries/${entryId}/adjust`, payload);
  invalidateQueryCache(["time-entries", "live-time-entries", "dashboard-overview", "reports-summary", "audit"]);
  return response.data;
}

export async function runAutoClose(plantId?: string) {
  const response = await httpClient.post<{ closedEntryIds: string[] }>("/time-entries/auto-close/run", null, {
    params: {
      plantId,
    },
  });
  invalidateQueryCache(["time-entries", "live-time-entries", "dashboard-overview", "reports-summary", "audit"]);
  return response.data;
}
