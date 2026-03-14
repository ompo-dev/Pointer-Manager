import { httpClient } from "./http-client";
import { fetchWithQueryCache, invalidateQueryCache } from "./query-cache";

export interface AccessUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  plantId?: string | null;
  modulePermissions?: string[] | null;
  lastLoginAt?: string | null;
  createdAt?: string;
}

export async function fetchAccessUsers() {
  return fetchWithQueryCache(["access-users"], async () => {
    const response = await httpClient.get<AccessUser[]>("/access/users");
    return response.data;
  });
}

export async function createAccessUser(payload: {
  plantId?: string | null;
  name: string;
  email: string;
  password: string;
  role: string;
  status?: string;
  modulePermissions?: string[];
}) {
  const response = await httpClient.post<AccessUser>("/access/users", payload);
  invalidateQueryCache(["access-users", "audit"]);
  return response.data;
}

export async function updateAccessUser(
  userId: string,
  payload: {
    plantId?: string | null;
    name?: string;
    password?: string;
    role?: string;
    status?: string;
    modulePermissions?: string[];
  },
) {
  const response = await httpClient.patch<AccessUser>(`/access/users/${userId}`, payload);
  invalidateQueryCache(["access-users", "audit"]);
  return response.data;
}
