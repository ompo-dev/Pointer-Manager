export const UserRoles = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  PLANT_SUPERVISOR: "PLANT_SUPERVISOR",
} as const;

export type UserRole = (typeof UserRoles)[keyof typeof UserRoles];

export const AppModules = [
  "dashboard",
  "plants",
  "people",
  "time-entries",
  "reports",
  "access",
  "audit",
] as const;

export type AppModule = (typeof AppModules)[number];

export const defaultPermissionsByRole: Record<UserRole, AppModule[]> = {
  SUPER_ADMIN: [...AppModules],
  ADMIN: ["dashboard", "plants", "people", "time-entries", "reports", "audit"],
  PLANT_SUPERVISOR: ["dashboard", "plants", "people", "time-entries", "reports"],
};
