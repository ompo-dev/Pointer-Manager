import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { Elysia } from "elysia";
import { env } from "./core/config/env";
import { appServices } from "./shared/kernel/app-services";
import { authRoutes } from "./domains/auth/presentation/auth.routes";
import { accessRoutes } from "./domains/access/presentation/access.routes";
import { plantsRoutes } from "./domains/plants/presentation/plants.routes";
import { employeesRoutes } from "./domains/employees/presentation/employees.routes";
import { reportsRoutes } from "./domains/reports/presentation/reports.routes";
import { timeEntriesRoutes } from "./domains/time-entries/presentation/time-entries.routes";
import { dashboardRoutes } from "./domains/dashboard/presentation/dashboard.routes";
import { auditRoutes } from "./domains/audit/presentation/audit.routes";
import { healthResponseSchema } from "./shared/http/response-schemas";

const api = new Elysia({ prefix: "/api/v1" })
  .decorate("services", appServices)
  .get(
    "/health",
    () => ({
      status: "ok",
      service: "point-manager-api",
    }),
    {
      response: {
        200: healthResponseSchema,
      },
    },
  )
  .use(authRoutes)
  .use(accessRoutes)
  .use(plantsRoutes)
  .use(employeesRoutes)
  .use(reportsRoutes)
  .use(timeEntriesRoutes)
  .use(dashboardRoutes)
  .use(auditRoutes);

export const app = new Elysia()
  .decorate("services", appServices)
  .use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    }),
  )
  .use(
    swagger({
      path: "/docs",
      documentation: {
        info: {
          title: "Point Manager API",
          version: "1.0.0",
          description:
            "API HTTP + tempo real para operação de ponto em usinas solares.",
        },
      },
    }),
  )
  .use(api)
  .ws("/realtime", {
    open(socket) {
      appServices.operationsHub.connect(socket as never);
      socket.send(
        JSON.stringify({
          type: "presence.snapshot",
          payload: {
            connected: true,
          },
          createdAt: new Date().toISOString(),
        }),
      );
    },
    close(socket) {
      appServices.operationsHub.disconnect(socket as never);
    },
  });
