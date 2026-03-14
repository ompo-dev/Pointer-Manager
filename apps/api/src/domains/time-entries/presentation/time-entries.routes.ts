import { Elysia, t } from "elysia";
import { PersonType, TimeEntryStatus } from "@prisma/client";
import { appServices } from "@/shared/kernel/app-services";
import { DomainError } from "@/shared/kernel/domain-error";
import { handleDomainError } from "@/shared/http/handle-domain-error";
import { readClientIp } from "@/shared/http/read-client-ip";
import {
  accessIntakeSchema,
  accessNetworkStatusSchema,
  autoCloseResponseSchema,
  commonErrorResponses,
  timeEntrySchema,
} from "@/shared/http/response-schemas";

function parseDate(value: unknown) {
  return typeof value === "string" && value ? new Date(value) : undefined;
}

function parsePersonType(value?: string) {
  if (!value) {
    return undefined;
  }

  if (Object.values(PersonType).includes(value as PersonType)) {
    return value as PersonType;
  }

  throw new DomainError("Tipo de pessoa invalido.", 422);
}

function parseTimeEntryStatus(value?: string) {
  if (!value) {
    return undefined;
  }

  if (Object.values(TimeEntryStatus).includes(value as TimeEntryStatus)) {
    return value as TimeEntryStatus;
  }

  throw new DomainError("Status de registro invalido.", 422);
}

export const timeEntriesRoutes = new Elysia({ prefix: "/time-entries" })
  .get(
    "/",
    async ({ headers, query, set }) => {
      try {
        const user = await appServices.auth.requireUser(headers.authorization);
        appServices.auth.requireModuleAccess(user, "time-entries");
        appServices.auth.requirePlantScope(
          user,
          typeof query.plantId === "string" ? query.plantId : undefined,
        );

        return await appServices.timeEntries.listEntries({
          organizationId: user.organizationId,
          plantId:
            user.role === "PLANT_SUPERVISOR" && user.plantId
              ? user.plantId
              : typeof query.plantId === "string"
                ? query.plantId
                : undefined,
          employeeId: typeof query.employeeId === "string" ? query.employeeId : undefined,
          status: typeof query.status === "string" ? (query.status as never) : "ALL",
          search: typeof query.search === "string" ? query.search : undefined,
          from: parseDate(query.from),
          to: parseDate(query.to),
        });
      } catch (error) {
        return handleDomainError(set, error);
      }
    },
    {
      response: {
        200: t.Array(timeEntrySchema),
        ...commonErrorResponses,
      },
    },
  )
  .get(
    "/live",
    async ({ headers, query, set }) => {
      try {
        const user = await appServices.auth.requireUser(headers.authorization);
        appServices.auth.requireModuleAccess(user, "time-entries");

        const plantId =
          user.role === "PLANT_SUPERVISOR" && user.plantId
            ? user.plantId
            : typeof query.plantId === "string"
              ? query.plantId
              : undefined;

        appServices.auth.requirePlantScope(user, plantId);

        return await appServices.timeEntries.listLiveEntries(user.organizationId, plantId);
      } catch (error) {
        return handleDomainError(set, error);
      }
    },
    {
      response: {
        200: t.Array(timeEntrySchema),
        ...commonErrorResponses,
      },
    },
  )
  .post(
    "/network-status",
    async ({ body, request, server, set }) => {
      try {
        return await appServices.timeEntries.getPublicNetworkStatus({
          plantToken: body.plantToken,
          deviceIp: readClientIp(request.headers, request, server),
          wifiSsid: body.wifiSsid,
          wifiBssid: body.wifiBssid,
          geoLatitude: body.geoLatitude,
          geoLongitude: body.geoLongitude,
          browserIpCandidates: body.browserIpCandidates,
          networkType: body.networkType,
          networkEffectiveType: body.networkEffectiveType,
        });
      } catch (error) {
        return handleDomainError(set, error);
      }
    },
    {
      body: t.Object({
        plantToken: t.Optional(t.String()),
        plantId: t.Optional(t.String()),
        wifiSsid: t.Optional(t.String()),
        wifiBssid: t.Optional(t.String()),
        geoLatitude: t.Optional(t.Number()),
        geoLongitude: t.Optional(t.Number()),
        browserIpCandidates: t.Optional(t.Array(t.String())),
        networkType: t.Optional(t.String()),
        networkEffectiveType: t.Optional(t.String()),
      }),
      response: {
        200: accessNetworkStatusSchema,
        ...commonErrorResponses,
      },
    },
  )
  .post(
    "/intake",
    async ({ body, set }) => {
      try {
        return await appServices.timeEntries.getAccessIntakeContext(body);
      } catch (error) {
        return handleDomainError(set, error);
      }
    },
    {
      body: t.Object({
        cpf: t.String({ minLength: 11 }),
        plantToken: t.Optional(t.String()),
        plantId: t.Optional(t.String()),
      }),
      response: {
        200: accessIntakeSchema,
        ...commonErrorResponses,
      },
    },
  )
  .post(
    "/entry",
    async ({ body, request, server, set }) => {
      try {
        return await appServices.timeEntries.registerEntry({
          ...body,
          deviceIp: body.deviceIp ?? readClientIp(request.headers, request, server),
          personType: parsePersonType(body.personType),
        });
      } catch (error) {
        return handleDomainError(set, error);
      }
    },
    {
      body: t.Object({
        cpf: t.String({ minLength: 11 }),
        plantToken: t.Optional(t.String()),
        plantId: t.Optional(t.String()),
        fullName: t.Optional(t.String()),
        employer: t.Optional(t.String()),
        jobTitle: t.Optional(t.String()),
        personType: t.Optional(t.String()),
        email: t.Optional(t.Union([t.String(), t.Null()])),
        phone: t.Optional(t.Union([t.String(), t.Null()])),
        photoUrl: t.Optional(t.Union([t.String(), t.Null()])),
        notes: t.Optional(t.Union([t.String(), t.Null()])),
        deviceIp: t.Optional(t.String()),
        deviceLabel: t.Optional(t.String()),
        wifiSsid: t.Optional(t.String()),
        wifiBssid: t.Optional(t.String()),
        selfieUrl: t.Optional(t.String()),
        geoLatitude: t.Optional(t.Number()),
        geoLongitude: t.Optional(t.Number()),
        networkType: t.Optional(t.String()),
        networkEffectiveType: t.Optional(t.String()),
        browserIpCandidates: t.Optional(t.Array(t.String())),
      }),
      response: {
        200: timeEntrySchema,
        ...commonErrorResponses,
      },
    },
  )
  .post(
    "/exit",
    async ({ body, request, server, set }) => {
      try {
        return await appServices.timeEntries.registerExit({
          ...body,
          deviceIp: body.deviceIp ?? readClientIp(request.headers, request, server),
        });
      } catch (error) {
        return handleDomainError(set, error);
      }
    },
    {
      body: t.Object({
        cpf: t.String({ minLength: 11 }),
        plantToken: t.Optional(t.String()),
        plantId: t.Optional(t.String()),
        deviceIp: t.Optional(t.String()),
        wifiSsid: t.Optional(t.String()),
        wifiBssid: t.Optional(t.String()),
        selfieUrl: t.Optional(t.String()),
        geoLatitude: t.Optional(t.Number()),
        geoLongitude: t.Optional(t.Number()),
        networkType: t.Optional(t.String()),
        networkEffectiveType: t.Optional(t.String()),
        browserIpCandidates: t.Optional(t.Array(t.String())),
      }),
      response: {
        200: timeEntrySchema,
        ...commonErrorResponses,
      },
    },
  )
  .post(
    "/:entryId/close",
    async ({ headers, params, body, set }) => {
      try {
        const user = await appServices.auth.requireUser(headers.authorization);
        appServices.auth.requireModuleAccess(user, "time-entries");
        appServices.auth.requireRole(user, ["SUPER_ADMIN", "ADMIN", "PLANT_SUPERVISOR"]);

        return await appServices.timeEntries.closeManually(
          user,
          params.entryId,
          body.notes ?? undefined,
        );
      } catch (error) {
        return handleDomainError(set, error);
      }
    },
    {
      body: t.Object({
        notes: t.Optional(t.String()),
      }),
      response: {
        200: timeEntrySchema,
        ...commonErrorResponses,
      },
    },
  )
  .post(
    "/:entryId/adjust",
    async ({ headers, params, body, set }) => {
      try {
        const user = await appServices.auth.requireUser(headers.authorization);
        appServices.auth.requireModuleAccess(user, "time-entries");
        appServices.auth.requireRole(user, ["SUPER_ADMIN", "ADMIN", "PLANT_SUPERVISOR"]);

        return await appServices.timeEntries.adjustEntry(user, params.entryId, {
          openedAt: body.openedAt ? new Date(body.openedAt) : undefined,
          closedAt:
            body.closedAt === undefined
              ? undefined
              : body.closedAt === null
                ? null
                : new Date(body.closedAt),
          notes: body.notes ?? undefined,
          status: parseTimeEntryStatus(body.status),
        });
      } catch (error) {
        return handleDomainError(set, error);
      }
    },
    {
      body: t.Object({
        openedAt: t.Optional(t.String()),
        closedAt: t.Optional(t.Union([t.String(), t.Null()])),
        notes: t.Optional(t.Union([t.String(), t.Null()])),
        status: t.Optional(t.String()),
      }),
      response: {
        200: timeEntrySchema,
        ...commonErrorResponses,
      },
    },
  )
  .post(
    "/auto-close/run",
    async ({ headers, query, set }) => {
      try {
        const user = await appServices.auth.requireUser(headers.authorization);
        appServices.auth.requireModuleAccess(user, "time-entries");
        appServices.auth.requireRole(user, ["SUPER_ADMIN", "ADMIN", "PLANT_SUPERVISOR"]);

        const plantId =
          user.role === "PLANT_SUPERVISOR" && user.plantId
            ? user.plantId
            : typeof query.plantId === "string"
              ? query.plantId
              : undefined;

        return {
          closedEntryIds: await appServices.timeEntries.runAutoClose(user.organizationId, plantId),
        };
      } catch (error) {
        return handleDomainError(set, error);
      }
    },
    {
      response: {
        200: autoCloseResponseSchema,
        ...commonErrorResponses,
      },
    },
  );
