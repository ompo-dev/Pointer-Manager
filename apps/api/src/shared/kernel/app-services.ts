import { AccessService } from "@api/domains/access/application/access-service";
import { OperationsHub } from "@api/core/realtime/operations-hub";
import { AuditService } from "@api/domains/audit/application/audit-service";
import { AuthService } from "@api/domains/auth/application/auth-service";
import { DashboardService } from "@api/domains/dashboard/application/dashboard-service";
import { PeopleService } from "@api/domains/people/application/people-service";
import { PlantsService } from "@api/domains/plants/application/plants-service";
import { ReportsService } from "@api/domains/reports/application/reports-service";
import { TimeEntriesService } from "@api/domains/time-entries/application/time-entries-service";

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
