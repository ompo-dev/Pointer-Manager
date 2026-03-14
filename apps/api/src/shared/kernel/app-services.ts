import { AccessService } from "@/domains/access/application/access-service";
import { OperationsHub } from "@/core/realtime/operations-hub";
import { AuditService } from "@/domains/audit/application/audit-service";
import { AuthService } from "@/domains/auth/application/auth-service";
import { DashboardService } from "@/domains/dashboard/application/dashboard-service";
import { EmployeesService } from "@/domains/employees/application/employees-service";
import { PlantsService } from "@/domains/plants/application/plants-service";
import { ReportsService } from "@/domains/reports/application/reports-service";
import { TimeEntriesService } from "@/domains/time-entries/application/time-entries-service";

const operationsHub = new OperationsHub();
const audit = new AuditService();

export const appServices = {
  operationsHub,
  audit,
  auth: new AuthService(),
  access: new AccessService(),
  dashboard: new DashboardService(),
  employees: new EmployeesService(),
  plants: new PlantsService(),
  reports: new ReportsService(),
  timeEntries: new TimeEntriesService(operationsHub, audit),
};

export type AppServices = typeof appServices;
