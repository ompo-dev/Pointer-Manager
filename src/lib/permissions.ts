export type AppModule =
  | "dashboard"
  | "plants"
  | "people"
  | "time-entries"
  | "reports"
  | "access"
  | "audit";

const defaultRoleModules: Record<string, AppModule[]> = {
  SUPER_ADMIN: ["dashboard", "plants", "people", "time-entries", "reports", "access", "audit"],
  ADMIN: ["dashboard", "plants", "people", "time-entries", "reports", "audit"],
  PLANT_SUPERVISOR: ["dashboard", "plants", "people", "time-entries", "reports"],
};

export function resolveAllowedModules(user?: {
  role?: string | null;
  modulePermissions?: string[] | null;
} | null): AppModule[] {
  if (!user) {
    return [];
  }

  const directPermissions = (user.modulePermissions ?? [])
    .filter((module): module is AppModule =>
      [
        "dashboard",
        "plants",
        "people",
        "time-entries",
        "reports",
        "access",
        "audit",
      ].includes(module),
    );

  if (directPermissions.length > 0) {
    return directPermissions;
  }

  return defaultRoleModules[user.role ?? ""] ?? [];
}
