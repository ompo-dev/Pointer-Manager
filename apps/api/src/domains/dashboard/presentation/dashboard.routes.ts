import { Elysia } from "elysia";
import { appServices } from "@api/shared/kernel/app-services";
import { handleDomainError } from "@api/shared/http/handle-domain-error";
import { commonErrorResponses, dashboardOverviewSchema } from "@api/shared/http/response-schemas";

export const dashboardRoutes = new Elysia({ prefix: "/dashboard" }).get(
  "/overview",
  async ({ headers, query, set }) => {
    try {
      const user = await appServices.auth.requireUser(headers.authorization);
      appServices.auth.requireModuleAccess(user, "dashboard");
      const plantId =
        user.role === "PLANT_SUPERVISOR" && user.plantId
          ? user.plantId
          : typeof query.plantId === "string"
            ? query.plantId
            : undefined;
      appServices.auth.requirePlantScope(user, plantId);

      return await appServices.dashboard.getOverview(
        user.organizationId,
        plantId,
      );
    } catch (error) {
      return handleDomainError(set, error);
    }
  },
  {
    response: {
      200: dashboardOverviewSchema,
      ...commonErrorResponses,
    },
  },
);
