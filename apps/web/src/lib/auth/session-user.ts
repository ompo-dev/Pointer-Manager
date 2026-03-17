import type { SessionUser } from "@/store/session-store";

export function toSessionUser(user: {
  id: string;
  name: string;
  email: string;
  role?: string | null;
  plantId?: string | null;
  status?: string | null;
  modulePermissions?: string[] | null;
}): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role ?? "ADMIN",
    plantId: user.plantId ?? null,
    status: user.status ?? "ACTIVE",
    modulePermissions: user.modulePermissions ?? [],
  };
}
