import { httpClient } from "./http-client";
import { fetchWithQueryCache, normalizeQueryParams } from "./query-cache";

export interface AuditLogEntry {
  id: string;
  action: string;
  entity: string;
  entityId?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  actorUser?: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
}

export async function fetchAuditLogs(params?: {
  action?: string;
  entity?: string;
  search?: string;
  actorUserId?: string;
}) {
  const normalizedParams = normalizeQueryParams(params);

  return fetchWithQueryCache(["audit", normalizedParams ?? {}], async () => {
    const response = await httpClient.get<AuditLogEntry[]>("/audit", {
      params: normalizedParams,
    });
    return response.data;
  }, { ttlMs: 3000 });
}
