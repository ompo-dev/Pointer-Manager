import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { Elysia } from "elysia";
import { env } from "./core/config/env";
import { expandLocalOrigins } from "./core/network/local-network";
import { appServices } from "./shared/kernel/app-services";
import { authRoutes } from "./domains/auth/presentation/auth.routes";
import { accessRoutes } from "./domains/access/presentation/access.routes";
import { plantsRoutes } from "./domains/plants/presentation/plants.routes";
import { peopleRoutes } from "./domains/people/presentation/people.routes";
import { reportsRoutes } from "./domains/reports/presentation/reports.routes";
import { timeEntriesRoutes } from "./domains/time-entries/presentation/time-entries.routes";
import { dashboardRoutes } from "./domains/dashboard/presentation/dashboard.routes";
import { auditRoutes } from "./domains/audit/presentation/audit.routes";
import { healthResponseSchema } from "./shared/http/response-schemas";

const allowedCorsOrigins =
  env.NODE_ENV === "development" ? true : expandLocalOrigins(env.CORS_ORIGIN);

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
  .use(peopleRoutes)
  .use(reportsRoutes)
  .use(timeEntriesRoutes)
  .use(dashboardRoutes)
  .use(auditRoutes);

export const app = new Elysia()
  .decorate("services", appServices)
  .use(
    cors({
      origin: allowedCorsOrigins,
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      exposeHeaders: ["Content-Disposition", "Content-Type", "X-Exporter-IP"],
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
  .use(api);
