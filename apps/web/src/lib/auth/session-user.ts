import type { AuthenticatedUser } from "@/lib/api/auth";
import type { SessionUser } from "@/store/session-store";

type SessionLikeUser = Omit<AuthenticatedUser, "plantId" | "modulePermissions"> & {
  plantId?: string | null;
  modulePermissions?: string[] | null;
};

export function toSessionUser(user: SessionLikeUser): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    plantId: user.plantId ?? null,
    status: user.status,
    modulePermissions: user.modulePermissions ?? [],
  };
}
