import { Elysia, t } from "elysia";
import { AccessProfileStatus, PersonType } from "@prisma/client";
import { appServices } from "@api/shared/kernel/app-services";
import { DomainError } from "@api/shared/kernel/domain-error";
import { handleDomainError } from "@api/shared/http/handle-domain-error";
import { readClientIp } from "@api/shared/http/read-client-ip";
import { commonErrorResponses, personDetailSchema, personSchema } from "@api/shared/http/response-schemas";

function parseDate(value: unknown) {
  return typeof value === "string" && value ? new Date(value) : undefined;
}

function parseAccessProfileStatus(value?: string) {
  if (!value) {
    return undefined;
  }

  if (Object.values(AccessProfileStatus).includes(value as AccessProfileStatus)) {
    return value as AccessProfileStatus;
  }

  throw new DomainError("Status de pessoa invalido.", 422);
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

export const peopleRoutes = new Elysia({ prefix: "/people" })
  .get(
    "/",
    async ({ headers, query, set }) => {
      try {
        const user = await appServices.auth.requireUser(headers.authorization);
        appServices.auth.requireModuleAccess(user, "people");

        const plantId =
          user.role === "PLANT_SUPERVISOR" && user.plantId
            ? user.plantId
            : typeof query.plantId === "string"
              ? query.plantId
              : undefined;

        appServices.auth.requirePlantScope(user, plantId);

        return await appServices.people.list(user.organizationId, {
          search: typeof query.search === "string" ? query.search : undefined,
          status: typeof query.status === "string" ? (query.status as never) : "ALL",
          personType:
            typeof query.personType === "string" ? (query.personType as never) : "ALL",
          plantId,
        });
      } catch (error) {
        return handleDomainError(set, error);
      }
    },
    {
      response: {
        200: t.Array(personSchema),
        ...commonErrorResponses,
      },
    },
  )
  .get(
    "/:personId",
    async ({ headers, params, set }) => {
      try {
        const user = await appServices.auth.requireUser(headers.authorization);
        appServices.auth.requireModuleAccess(user, "people");

        return await appServices.people.getById(
          user.organizationId,
          params.personId,
          user.role === "PLANT_SUPERVISOR" ? user.plantId : undefined,
        );
      } catch (error) {
        return handleDomainError(set, error);
      }
    },
    {
      response: {
        200: personDetailSchema,
        ...commonErrorResponses,
      },
    },
  )
  .get(
    "/:personId/history",
    async ({ headers, params, query, set }) => {
      try {
        const user = await appServices.auth.requireUser(headers.authorization);
        appServices.auth.requireModuleAccess(user, "people");

        return await appServices.people.listHistory(user.organizationId, params.personId, {
          from: parseDate(query.from),
          to: parseDate(query.to),
          status: typeof query.status === "string" ? query.status : undefined,
          plantId: user.role === "PLANT_SUPERVISOR" ? user.plantId ?? undefined : undefined,
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
            totalMinutes: t.Optional(t.Union([t.Number(), t.Null()])),
            status: t.String(),
            plant: t.Object({
              id: t.String(),
              name: t.String(),
            }),
          }),
        ),
        ...commonErrorResponses,
      },
    },
  )
  .get("/:personId/export", async ({ headers, params, query, set, request, server }) => {
    try {
      const user = await appServices.auth.requireUser(headers.authorization);
      appServices.auth.requireModuleAccess(user, "people");

      const csv = await appServices.people.exportHistory(
        user.organizationId,
        params.personId,
        {
          from: parseDate(query.from),
          to: parseDate(query.to),
          status: typeof query.status === "string" ? query.status : undefined,
          plantId: user.role === "PLANT_SUPERVISOR" ? user.plantId ?? undefined : undefined,
        },
      );

      set.headers["content-type"] = "text/csv; charset=utf-8";
      set.headers["content-disposition"] =
        `attachment; filename=\"person-${params.personId}-history.csv\"`;
      set.headers["x-exporter-ip"] =
        readClientIp(request.headers, request, server) ?? "";

      return csv;
    } catch (error) {
      return handleDomainError(set, error);
    }
  })
  .post(
    "/",
    async ({ headers, body, request, server, set }) => {
      try {
        const user = await appServices.auth.requireUser(headers.authorization);
        appServices.auth.requireModuleAccess(user, "people");
        appServices.auth.requireRole(user, ["SUPER_ADMIN", "ADMIN", "PLANT_SUPERVISOR"]);
        const homePlantId =
          user.role === "PLANT_SUPERVISOR" && user.plantId
            ? body.homePlantId ?? user.plantId
            : body.homePlantId ?? undefined;

        appServices.auth.requirePlantScope(user, homePlantId);

        return await appServices.people.create(
          {
            organizationId: user.organizationId,
            homePlantId: homePlantId ?? undefined,
            fullName: body.fullName,
            cpf: body.cpf,
            personType: parsePersonType(body.personType),
            employer: body.employer,
            jobTitle: body.jobTitle,
            email: body.email ?? undefined,
            phone: body.phone ?? undefined,
            photoUrl: body.photoUrl ?? undefined,
            notes: body.notes ?? undefined,
            status: parseAccessProfileStatus(body.status),
          },
          {
            userId: user.id,
            ipAddress: readClientIp(request.headers, request, server) ?? null,
          },
        );
      } catch (error) {
        return handleDomainError(set, error);
      }
    },
    {
      body: t.Object({
        homePlantId: t.Optional(t.Union([t.String(), t.Null()])),
        fullName: t.String(),
        cpf: t.String({ minLength: 11 }),
        personType: t.Optional(t.String()),
        employer: t.String(),
        jobTitle: t.String(),
        email: t.Optional(t.Union([t.String(), t.Null()])),
        phone: t.Optional(t.Union([t.String(), t.Null()])),
        photoUrl: t.Optional(t.Union([t.String(), t.Null()])),
        notes: t.Optional(t.Union([t.String(), t.Null()])),
        status: t.Optional(t.String()),
      }),
      response: {
        200: personSchema,
        ...commonErrorResponses,
      },
    },
  )
  .patch(
    "/:personId",
    async ({ headers, params, body, request, server, set }) => {
      try {
        const user = await appServices.auth.requireUser(headers.authorization);
        appServices.auth.requireModuleAccess(user, "people");
        appServices.auth.requireRole(user, ["SUPER_ADMIN", "ADMIN", "PLANT_SUPERVISOR"]);
        const homePlantId =
          user.role === "PLANT_SUPERVISOR" && user.plantId
            ? body.homePlantId ?? user.plantId
            : body.homePlantId ?? undefined;

        appServices.auth.requirePlantScope(user, homePlantId);

        return await appServices.people.update(
          user.organizationId,
          params.personId,
          {
            homePlantId: homePlantId ?? undefined,
            fullName: body.fullName,
            cpf: body.cpf,
            personType: parsePersonType(body.personType),
            employer: body.employer,
            jobTitle: body.jobTitle,
            email: body.email ?? undefined,
            phone: body.phone ?? undefined,
            photoUrl: body.photoUrl ?? undefined,
            notes: body.notes ?? undefined,
            status: parseAccessProfileStatus(body.status),
          },
          {
            userId: user.id,
            ipAddress: readClientIp(request.headers, request, server) ?? null,
          },
          user.role === "PLANT_SUPERVISOR" ? user.plantId : undefined,
        );
      } catch (error) {
        return handleDomainError(set, error);
      }
    },
    {
      body: t.Object({
        homePlantId: t.Optional(t.Union([t.String(), t.Null()])),
        fullName: t.Optional(t.String()),
        cpf: t.Optional(t.String({ minLength: 11 })),
        personType: t.Optional(t.String()),
        employer: t.Optional(t.String()),
        jobTitle: t.Optional(t.String()),
        email: t.Optional(t.Union([t.String(), t.Null()])),
        phone: t.Optional(t.Union([t.String(), t.Null()])),
        photoUrl: t.Optional(t.Union([t.String(), t.Null()])),
        notes: t.Optional(t.Union([t.String(), t.Null()])),
        status: t.Optional(t.String()),
      }),
      response: {
        200: personSchema,
        ...commonErrorResponses,
      },
    },
  );
