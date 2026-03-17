import { Elysia, t } from "elysia";
import { appServices } from "@api/shared/kernel/app-services";
import { handleDomainError } from "@api/shared/http/handle-domain-error";
import { auditLogSchema, commonErrorResponses } from "@api/shared/http/response-schemas";

export const auditRoutes = new Elysia({ prefix: "/audit" }).get(
  "/",
  async ({ headers, query, set }) => {
    try {
      const user = await appServices.auth.requireUser(headers.authorization);
      appServices.auth.requireModuleAccess(user, "audit");
      return await appServices.audit.list(user.organizationId, {
        action: typeof query.action === "string" ? query.action : undefined,
        entity: typeof query.entity === "string" ? query.entity : undefined,
        search: typeof query.search === "string" ? query.search : undefined,
        actorUserId: typeof query.actorUserId === "string" ? query.actorUserId : undefined,
      });
    } catch (error) {
      return handleDomainError(set, error);
    }
  },
  {
    response: {
      200: t.Array(auditLogSchema),
      ...commonErrorResponses,
    },
  },
);
