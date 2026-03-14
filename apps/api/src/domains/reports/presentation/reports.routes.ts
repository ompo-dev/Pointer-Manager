import { Elysia } from "elysia";
import { appServices } from "@/shared/kernel/app-services";
import { handleDomainError } from "@/shared/http/handle-domain-error";
import { commonErrorResponses, reportsSummarySchema } from "@/shared/http/response-schemas";

function parseDate(value: unknown) {
  return typeof value === "string" && value ? new Date(value) : undefined;
}

export const reportsRoutes = new Elysia({ prefix: "/reports" })
  .get(
    "/summary",
    async ({ headers, query, set }) => {
      try {
        const user = await appServices.auth.requireUser(headers.authorization);
        appServices.auth.requireModuleAccess(user, "reports");
        const plantId =
          user.role === "PLANT_SUPERVISOR" && user.plantId
            ? user.plantId
            : typeof query.plantId === "string"
              ? query.plantId
              : undefined;
        appServices.auth.requirePlantScope(user, plantId);

        return await appServices.reports.summary({
          organizationId: user.organizationId,
          plantId,
          from: parseDate(query.from),
          to: parseDate(query.to),
        });
      } catch (error) {
        return handleDomainError(set, error);
      }
    },
    {
      response: {
        200: reportsSummarySchema,
        ...commonErrorResponses,
      },
    },
  )
  .get("/export", async ({ headers, query, set }) => {
    try {
      const user = await appServices.auth.requireUser(headers.authorization);
      appServices.auth.requireModuleAccess(user, "reports");
      const plantId =
        user.role === "PLANT_SUPERVISOR" && user.plantId
          ? user.plantId
          : typeof query.plantId === "string"
            ? query.plantId
            : undefined;
      const reportType =
        typeof query.type === "string" && query.type
          ? (query.type as never)
          : "hours-by-person";
      const format =
        typeof query.format === "string" && query.format.toLowerCase() === "pdf"
          ? "pdf"
          : "csv";
      const filters = {
        organizationId: user.organizationId,
        plantId,
        from: parseDate(query.from),
        to: parseDate(query.to),
      };

      if (format === "pdf") {
        const pdf = await appServices.reports.exportPdf(reportType, filters);

        set.headers = {
          "content-type": "application/pdf",
          "content-disposition": `attachment; filename=\"report-${reportType}.pdf\"`,
        };

        return pdf;
      }

      const csv = await appServices.reports.exportCsv(reportType, filters);

      set.headers = {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename=\"report-${reportType}.csv\"`,
      };

      return csv;
    } catch (error) {
      return handleDomainError(set, error);
    }
  });
