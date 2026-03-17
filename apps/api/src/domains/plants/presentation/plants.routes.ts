import { Elysia, t } from "elysia";
import { PlantStatus } from "@prisma/client";
import { appServices } from "@/shared/kernel/app-services";
import { DomainError } from "@/shared/kernel/domain-error";
import { handleDomainError } from "@/shared/http/handle-domain-error";
import {
  commonErrorResponses,
  detectedPlantNetworkSchema,
  plantDetailSchema,
  plantSchema,
} from "@/shared/http/response-schemas";
import { readClientIp } from "@/shared/http/read-client-ip";

function parseDate(value: unknown) {
  return typeof value === "string" && value ? new Date(value) : undefined;
}

function parsePlantStatus(value?: string) {
  if (!value) {
    return undefined;
  }

  if (Object.values(PlantStatus).includes(value as PlantStatus)) {
    return value as PlantStatus;
  }

  throw new DomainError("Status de usina invalido.", 422);
}

export const plantsRoutes = new Elysia({ prefix: "/plants" })
  .get(
    "/",
    async ({ headers, query, set }) => {
      try {
        const user = await appServices.auth.requireUser(headers.authorization);
        appServices.auth.requireModuleAccess(user, "plants");
        const plantId =
          user.role === "PLANT_SUPERVISOR" && user.plantId
            ? user.plantId
            : undefined;

        return await appServices.plants.list(user.organizationId, {
          search: typeof query.search === "string" ? query.search : undefined,
          status: typeof query.status === "string" ? (query.status as never) : "ALL",
          plantId,
        });
      } catch (error) {
        return handleDomainError(set, error);
      }
    },
    {
      response: {
        200: t.Array(plantSchema),
        ...commonErrorResponses,
      },
    },
  )
  .get(
    "/detect-network",
    async ({ headers, request, server, set }) => {
      try {
        const user = await appServices.auth.requireUser(headers.authorization);
        appServices.auth.requireModuleAccess(user, "plants");

        return appServices.plants.detectCurrentNetwork({
          requestIp: readClientIp(request.headers, request, server),
        });
      } catch (error) {
        return handleDomainError(set, error);
      }
    },
    {
      response: {
        200: detectedPlantNetworkSchema,
        ...commonErrorResponses,
      },
    },
  )
  .post(
    "/detect-network",
    async ({ headers, request, server, body, set }) => {
      try {
        const user = await appServices.auth.requireUser(headers.authorization);
        appServices.auth.requireModuleAccess(user, "plants");

        return appServices.plants.detectCurrentNetwork({
          requestIp: readClientIp(request.headers, request, server),
          browserIpCandidates: body.browserIpCandidates,
          browserConnectionType: body.browserConnectionType,
        });
      } catch (error) {
        return handleDomainError(set, error);
      }
    },
    {
      body: t.Object({
        browserIpCandidates: t.Optional(t.Array(t.String())),
        browserConnectionType: t.Optional(t.Union([t.String(), t.Null()])),
      }),
      response: {
        200: detectedPlantNetworkSchema,
        ...commonErrorResponses,
      },
    },
  )
  .get(
    "/:plantId",
    async ({ headers, params, set }) => {
      try {
        const user = await appServices.auth.requireUser(headers.authorization);
        appServices.auth.requireModuleAccess(user, "plants");
        appServices.auth.requirePlantScope(user, params.plantId);

        return await appServices.plants.getById(user.organizationId, params.plantId);
      } catch (error) {
        return handleDomainError(set, error);
      }
    },
    {
      response: {
        200: plantDetailSchema,
        ...commonErrorResponses,
      },
    },
  )
  .get(
    "/:plantId/present",
    async ({ headers, params, set }) => {
      try {
        const user = await appServices.auth.requireUser(headers.authorization);
        appServices.auth.requireModuleAccess(user, "plants");
        appServices.auth.requirePlantScope(user, params.plantId);

        return await appServices.plants.listPresentPeople(user.organizationId, params.plantId);
      } catch (error) {
        return handleDomainError(set, error);
      }
    },
    {
      response: {
        200: t.Array(
          t.Object({
            id: t.String(),
            openedAt: t.String(),
            person: t.Object({
              id: t.String(),
              personId: t.String(),
              fullName: t.String(),
              cpf: t.String(),
              personType: t.String(),
            }),
          }),
        ),
        ...commonErrorResponses,
      },
    },
  )
  .get(
    "/:plantId/history",
    async ({ headers, params, query, set }) => {
      try {
        const user = await appServices.auth.requireUser(headers.authorization);
        appServices.auth.requireModuleAccess(user, "plants");
        appServices.auth.requirePlantScope(user, params.plantId);

        return await appServices.plants.listHistory(user.organizationId, params.plantId, {
          from: parseDate(query.from),
          to: parseDate(query.to),
          status: typeof query.status === "string" ? query.status : undefined,
        });
      } catch (error) {
        return handleDomainError(set, error);
      }
    },
    {
      response: {
        200: t.Array(
          t.Object({
            id: t.String(),
            openedAt: t.String(),
            closedAt: t.Optional(t.Union([t.String(), t.Null()])),
            status: t.String(),
            totalMinutes: t.Optional(t.Union([t.Number(), t.Null()])),
            person: t.Object({
              id: t.String(),
              personId: t.String(),
              fullName: t.String(),
              cpf: t.String(),
              personType: t.String(),
            }),
          }),
        ),
        ...commonErrorResponses,
      },
    },
  )
  .post(
    "/",
    async ({ headers, body, request, server, set }) => {
      try {
        const user = await appServices.auth.requireUser(headers.authorization);
        appServices.auth.requireModuleAccess(user, "plants");
        appServices.auth.requireRole(user, ["SUPER_ADMIN", "ADMIN"]);

        return await appServices.plants.create({
          organizationId: user.organizationId,
          code: body.code,
          name: body.name,
          city: body.city,
          state: body.state,
          timezone: body.timezone,
          openingHour: body.openingHour,
          closingHour: body.closingHour,
          qrToken: body.qrToken,
          status: parsePlantStatus(body.status),
          requireWifiMatch: body.requireWifiMatch,
          requireSelfie: body.requireSelfie,
          autoCloseLimitHours: body.autoCloseLimitHours,
          lateAlertMinutes: body.lateAlertMinutes,
          geofenceLatitude: body.geofenceLatitude ?? undefined,
          geofenceLongitude: body.geofenceLongitude ?? undefined,
          geofenceRadiusMeters: body.geofenceRadiusMeters ?? undefined,
          authorizedNetworks: body.authorizedNetworks,
        }, {
          userId: user.id,
          ipAddress: readClientIp(request.headers, request, server) ?? null,
        });
      } catch (error) {
        return handleDomainError(set, error);
      }
    },
    {
      body: t.Object({
        code: t.Optional(t.String()),
        name: t.String(),
        city: t.String(),
        state: t.String(),
        timezone: t.Optional(t.String()),
        openingHour: t.String(),
        closingHour: t.String(),
        qrToken: t.Optional(t.String()),
        status: t.Optional(t.String()),
        requireWifiMatch: t.Optional(t.Boolean()),
        requireSelfie: t.Optional(t.Boolean()),
        autoCloseLimitHours: t.Optional(t.Number()),
        lateAlertMinutes: t.Optional(t.Number()),
        geofenceLatitude: t.Optional(t.Union([t.Number(), t.Null()])),
        geofenceLongitude: t.Optional(t.Union([t.Number(), t.Null()])),
        geofenceRadiusMeters: t.Optional(t.Union([t.Number(), t.Null()])),
        authorizedNetworks: t.Optional(
          t.Array(
            t.Object({
              name: t.String(),
              ssid: t.Optional(t.Union([t.String(), t.Null()])),
              bssid: t.Optional(t.Union([t.String(), t.Null()])),
              ipv4Cidr: t.Optional(t.Union([t.String(), t.Null()])),
              notes: t.Optional(t.Union([t.String(), t.Null()])),
            }),
          ),
        ),
      }),
      response: {
        200: plantSchema,
        ...commonErrorResponses,
      },
    },
  )
  .patch(
    "/:plantId",
    async ({ headers, params, body, request, server, set }) => {
      try {
        const user = await appServices.auth.requireUser(headers.authorization);
        appServices.auth.requireModuleAccess(user, "plants");
        appServices.auth.requireRole(user, ["SUPER_ADMIN", "ADMIN", "PLANT_SUPERVISOR"]);
        appServices.auth.requirePlantScope(user, params.plantId);

        return await appServices.plants.update(user.organizationId, params.plantId, {
          code: body.code,
          name: body.name,
          city: body.city,
          state: body.state,
          timezone: body.timezone,
          openingHour: body.openingHour,
          closingHour: body.closingHour,
          status: parsePlantStatus(body.status),
          requireWifiMatch: body.requireWifiMatch,
          requireSelfie: body.requireSelfie,
          autoCloseLimitHours: body.autoCloseLimitHours,
          lateAlertMinutes: body.lateAlertMinutes,
          geofenceLatitude: body.geofenceLatitude ?? undefined,
          geofenceLongitude: body.geofenceLongitude ?? undefined,
          geofenceRadiusMeters: body.geofenceRadiusMeters ?? undefined,
          authorizedNetworks: body.authorizedNetworks,
        }, {
          userId: user.id,
          ipAddress: readClientIp(request.headers, request, server) ?? null,
        });
      } catch (error) {
        return handleDomainError(set, error);
      }
    },
    {
      body: t.Object({
        code: t.Optional(t.String()),
        name: t.Optional(t.String()),
        city: t.Optional(t.String()),
        state: t.Optional(t.String()),
        timezone: t.Optional(t.String()),
        openingHour: t.Optional(t.String()),
        closingHour: t.Optional(t.String()),
        status: t.Optional(t.String()),
        requireWifiMatch: t.Optional(t.Boolean()),
        requireSelfie: t.Optional(t.Boolean()),
        autoCloseLimitHours: t.Optional(t.Number()),
        lateAlertMinutes: t.Optional(t.Number()),
        geofenceLatitude: t.Optional(t.Union([t.Number(), t.Null()])),
        geofenceLongitude: t.Optional(t.Union([t.Number(), t.Null()])),
        geofenceRadiusMeters: t.Optional(t.Union([t.Number(), t.Null()])),
        authorizedNetworks: t.Optional(
          t.Array(
            t.Object({
              name: t.String(),
              ssid: t.Optional(t.Union([t.String(), t.Null()])),
              bssid: t.Optional(t.Union([t.String(), t.Null()])),
              ipv4Cidr: t.Optional(t.Union([t.String(), t.Null()])),
              notes: t.Optional(t.Union([t.String(), t.Null()])),
            }),
          ),
        ),
      }),
      response: {
        200: plantSchema,
        ...commonErrorResponses,
      },
    },
  )
  .get(
    "/public/:qrToken",
    async ({ params, set }) => {
      try {
        return await appServices.plants.getByQrToken(params.qrToken);
      } catch (error) {
        return handleDomainError(set, error);
      }
    },
    {
      response: {
        200: plantSchema,
        ...commonErrorResponses,
      },
    },
  );
