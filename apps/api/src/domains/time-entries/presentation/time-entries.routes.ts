import { Elysia, t } from "elysia";
import { PersonType, TimeEntryStatus } from "@prisma/client";
import { appServices } from "@api/shared/kernel/app-services";
import { DomainError } from "@api/shared/kernel/domain-error";
import { handleDomainError } from "@api/shared/http/handle-domain-error";
import { readClientIp } from "@api/shared/http/read-client-ip";
import {
  accessIntakeSchema,
  accessNetworkStatusSchema,
  autoCloseResponseSchema,
  commonErrorResponses,
  timeEntrySchema,
} from "@api/shared/http/response-schemas";

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
          personId: typeof query.personId === "string" ? query.personId : undefined,
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
          plantToken: body.plantToken ?? undefined,
          deviceIp: readClientIp(request.headers, request, server),
          wifiSsid: body.wifiSsid ?? undefined,
          wifiBssid: body.wifiBssid ?? undefined,
          geoLatitude: body.geoLatitude,
          geoLongitude: body.geoLongitude,
          browserIpCandidates: body.browserIpCandidates,
          networkType: body.networkType ?? undefined,
          networkEffectiveType: body.networkEffectiveType ?? undefined,
        });
      } catch (error) {
        return handleDomainError(set, error);
      }
    },
    {
      body: t.Object({
        plantToken: t.String(),
        wifiSsid: t.Optional(t.Union([t.String(), t.Null()])),
        wifiBssid: t.Optional(t.Union([t.String(), t.Null()])),
        geoLatitude: t.Optional(t.Number()),
        geoLongitude: t.Optional(t.Number()),
        browserIpCandidates: t.Optional(t.Array(t.String())),
        networkType: t.Optional(t.Union([t.String(), t.Null()])),
        networkEffectiveType: t.Optional(t.Union([t.String(), t.Null()])),
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
        return await appServices.timeEntries.getAccessIntakeContext({
          cpf: body.cpf,
          plantToken: body.plantToken ?? undefined,
        });
      } catch (error) {
        return handleDomainError(set, error);
      }
    },
    {
      body: t.Object({
        cpf: t.String({ minLength: 11 }),
        plantToken: t.String(),
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
          cpf: body.cpf,
          plantToken: body.plantToken ?? undefined,
          fullName: body.fullName ?? undefined,
          employer: body.employer ?? undefined,
          jobTitle: body.jobTitle ?? undefined,
          deviceIp: body.deviceIp ?? readClientIp(request.headers, request, server),
          email: body.email ?? undefined,
          phone: body.phone ?? undefined,
          photoUrl: body.photoUrl ?? undefined,
          notes: body.notes ?? undefined,
          deviceLabel: body.deviceLabel ?? undefined,
          wifiSsid: body.wifiSsid ?? undefined,
          wifiBssid: body.wifiBssid ?? undefined,
          selfieUrl: body.selfieUrl ?? undefined,
          geoLatitude: body.geoLatitude,
          geoLongitude: body.geoLongitude,
          networkType: body.networkType ?? undefined,
          networkEffectiveType: body.networkEffectiveType ?? undefined,
          browserIpCandidates: body.browserIpCandidates,
          personType: parsePersonType(body.personType ?? undefined),
        });
      } catch (error) {
        return handleDomainError(set, error);
      }
    },
    {
      body: t.Object({
        cpf: t.String({ minLength: 11 }),
        plantToken: t.String(),
        fullName: t.Optional(t.Union([t.String(), t.Null()])),
        employer: t.Optional(t.Union([t.String(), t.Null()])),
        jobTitle: t.Optional(t.Union([t.String(), t.Null()])),
        personType: t.Optional(t.Union([t.String(), t.Null()])),
        email: t.Optional(t.Union([t.String(), t.Null()])),
        phone: t.Optional(t.Union([t.String(), t.Null()])),
        photoUrl: t.Optional(t.Union([t.String(), t.Null()])),
        notes: t.Optional(t.Union([t.String(), t.Null()])),
        deviceIp: t.Optional(t.Union([t.String(), t.Null()])),
        deviceLabel: t.Optional(t.Union([t.String(), t.Null()])),
        wifiSsid: t.Optional(t.Union([t.String(), t.Null()])),
        wifiBssid: t.Optional(t.Union([t.String(), t.Null()])),
        selfieUrl: t.Optional(t.Union([t.String(), t.Null()])),
        geoLatitude: t.Optional(t.Number()),
        geoLongitude: t.Optional(t.Number()),
        networkType: t.Optional(t.Union([t.String(), t.Null()])),
        networkEffectiveType: t.Optional(t.Union([t.String(), t.Null()])),
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
          cpf: body.cpf,
          plantToken: body.plantToken ?? undefined,
          deviceIp: body.deviceIp ?? readClientIp(request.headers, request, server),
          wifiSsid: body.wifiSsid ?? undefined,
          wifiBssid: body.wifiBssid ?? undefined,
          selfieUrl: body.selfieUrl ?? undefined,
          geoLatitude: body.geoLatitude,
          geoLongitude: body.geoLongitude,
          networkType: body.networkType ?? undefined,
          networkEffectiveType: body.networkEffectiveType ?? undefined,
          browserIpCandidates: body.browserIpCandidates,
        });
      } catch (error) {
        return handleDomainError(set, error);
      }
    },
    {
      body: t.Object({
        cpf: t.String({ minLength: 11 }),
        plantToken: t.String(),
        deviceIp: t.Optional(t.Union([t.String(), t.Null()])),
        wifiSsid: t.Optional(t.Union([t.String(), t.Null()])),
        wifiBssid: t.Optional(t.Union([t.String(), t.Null()])),
        selfieUrl: t.Optional(t.Union([t.String(), t.Null()])),
        geoLatitude: t.Optional(t.Number()),
        geoLongitude: t.Optional(t.Number()),
        networkType: t.Optional(t.Union([t.String(), t.Null()])),
        networkEffectiveType: t.Optional(t.Union([t.String(), t.Null()])),
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
    async ({ headers, params, body, request, server, set }) => {
      try {
        const user = await appServices.auth.requireUser(headers.authorization);
        appServices.auth.requireModuleAccess(user, "time-entries");
        appServices.auth.requireRole(user, ["SUPER_ADMIN", "ADMIN", "PLANT_SUPERVISOR"]);

        return await appServices.timeEntries.closeManually(
          user,
          params.entryId,
          body.notes ?? undefined,
          readClientIp(request.headers, request, server),
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
    async ({ headers, params, body, request, server, set }) => {
      try {
        const user = await appServices.auth.requireUser(headers.authorization);
        appServices.auth.requireModuleAccess(user, "time-entries");
        appServices.auth.requireRole(user, ["SUPER_ADMIN", "ADMIN", "PLANT_SUPERVISOR"]);

        return await appServices.timeEntries.adjustEntry(
          user,
          params.entryId,
          {
            openedAt: body.openedAt ? new Date(body.openedAt) : undefined,
            closedAt:
              body.closedAt === undefined
                ? undefined
                : body.closedAt === null
                  ? null
                  : new Date(body.closedAt),
            notes: body.notes ?? undefined,
            status: parseTimeEntryStatus(body.status),
          },
          readClientIp(request.headers, request, server),
        );
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
