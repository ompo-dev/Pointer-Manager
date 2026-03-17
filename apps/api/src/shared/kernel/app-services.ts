import { AccessService } from "@/domains/access/application/access-service";
import { OperationsHub } from "@/core/realtime/operations-hub";
import { AuditService } from "@/domains/audit/application/audit-service";
import { AuthService } from "@/domains/auth/application/auth-service";
import { DashboardService } from "@/domains/dashboard/application/dashboard-service";
import { PeopleService } from "@/domains/people/application/people-service";
import { PlantsService } from "@/domains/plants/application/plants-service";
import { ReportsService } from "@/domains/reports/application/reports-service";
import { TimeEntriesService } from "@/domains/time-entries/application/time-entries-service";

const operationsHub = new OperationsHub();
const audit = new AuditService();

export const appServices = {
  operationsHub,
  audit,
  auth: new AuthService(),
  access: new AccessService(audit),
  dashboard: new DashboardService(),
  people: new PeopleService(audit),
  plants: new PlantsService(audit),
  reports: new ReportsService(),
  timeEntries: new TimeEntriesService(operationsHub, audit),
};

export type AppServices = typeof appServices;
