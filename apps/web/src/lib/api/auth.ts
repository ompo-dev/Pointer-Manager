import { publicHttpClient } from "./http-client";

export interface AuthenticatedUser {
  id: string;
  organizationId: string;
  plantId: string | null;
  name: string;
  email: string;
  role: string;
  status: string;
  modulePermissions: string[];
}

export async function fetchAuthenticatedUser(token: string) {
  const response = await publicHttpClient.get<AuthenticatedUser>("/auth/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.data;
}
