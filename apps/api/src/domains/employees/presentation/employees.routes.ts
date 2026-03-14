import { Elysia, t } from "elysia";
import { EmployeeStatus, PersonType } from "@prisma/client";
import { appServices } from "@/shared/kernel/app-services";
import { DomainError } from "@/shared/kernel/domain-error";
import { handleDomainError } from "@/shared/http/handle-domain-error";
import { commonErrorResponses, personDetailSchema, personSchema } from "@/shared/http/response-schemas";

function parseDate(value: unknown) {
  return typeof value === "string" && value ? new Date(value) : undefined;
}

function parseEmployeeStatus(value?: string) {
  if (!value) {
    return undefined;
  }

  if (Object.values(EmployeeStatus).includes(value as EmployeeStatus)) {
    return value as EmployeeStatus;
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

export const employeesRoutes = new Elysia({ prefix: "/employees" })
  .get(
    "/",
    async ({ headers, query, set }) => {
      try {
        const user = await appServices.auth.requireUser(headers.authorization);
        appServices.auth.requireModuleAccess(user, "people");
        appServices.auth.requirePlantScope(
          user,
          typeof query.plantId === "string" ? query.plantId : undefined,
        );

        return await appServices.employees.list(user.organizationId, {
          search: typeof query.search === "string" ? query.search : undefined,
          status: typeof query.status === "string" ? (query.status as never) : "ALL",
          personType:
            typeof query.personType === "string" ? (query.personType as never) : "ALL",
          plantId: typeof query.plantId === "string" ? query.plantId : undefined,
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

        return await appServices.employees.getById(user.organizationId, params.personId);
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

        return await appServices.employees.listHistory(user.organizationId, params.personId, {
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
  .get("/:personId/export", async ({ headers, params, query, set }) => {
    try {
      const user = await appServices.auth.requireUser(headers.authorization);
      appServices.auth.requireModuleAccess(user, "people");

      const csv = await appServices.employees.exportHistory(
        user.organizationId,
        params.personId,
        {
          from: parseDate(query.from),
          to: parseDate(query.to),
          status: typeof query.status === "string" ? query.status : undefined,
        },
      );

      set.headers = {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename=\"person-${params.personId}-history.csv\"`,
      };

      return csv;
    } catch (error) {
      return handleDomainError(set, error);
    }
  })
  .post(
    "/",
    async ({ headers, body, set }) => {
      try {
        const user = await appServices.auth.requireUser(headers.authorization);
        appServices.auth.requireModuleAccess(user, "people");
        appServices.auth.requireRole(user, ["SUPER_ADMIN", "ADMIN", "PLANT_SUPERVISOR"]);
        appServices.auth.requirePlantScope(user, body.primaryPlantId ?? undefined);

        return await appServices.employees.create({
          organizationId: user.organizationId,
          primaryPlantId: body.primaryPlantId ?? undefined,
          fullName: body.fullName,
          cpf: body.cpf,
          personType: parsePersonType(body.personType),
          employer: body.employer,
          jobTitle: body.jobTitle,
          email: body.email ?? undefined,
          phone: body.phone ?? undefined,
          photoUrl: body.photoUrl ?? undefined,
          notes: body.notes ?? undefined,
          status: parseEmployeeStatus(body.status),
        });
      } catch (error) {
        return handleDomainError(set, error);
      }
    },
    {
      body: t.Object({
        primaryPlantId: t.Optional(t.Union([t.String(), t.Null()])),
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
    async ({ headers, params, body, set }) => {
      try {
        const user = await appServices.auth.requireUser(headers.authorization);
        appServices.auth.requireModuleAccess(user, "people");
        appServices.auth.requireRole(user, ["SUPER_ADMIN", "ADMIN", "PLANT_SUPERVISOR"]);
        appServices.auth.requirePlantScope(user, body.primaryPlantId ?? undefined);

        return await appServices.employees.update(user.organizationId, params.personId, {
          primaryPlantId: body.primaryPlantId ?? undefined,
          fullName: body.fullName,
          cpf: body.cpf,
          personType: parsePersonType(body.personType),
          employer: body.employer,
          jobTitle: body.jobTitle,
          email: body.email ?? undefined,
          phone: body.phone ?? undefined,
          photoUrl: body.photoUrl ?? undefined,
          notes: body.notes ?? undefined,
          status: parseEmployeeStatus(body.status),
        });
      } catch (error) {
        return handleDomainError(set, error);
      }
    },
    {
      body: t.Object({
        primaryPlantId: t.Optional(t.Union([t.String(), t.Null()])),
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
