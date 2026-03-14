import { Elysia, t } from "elysia";
import { appServices } from "@/shared/kernel/app-services";
import { handleDomainError } from "@/shared/http/handle-domain-error";
import { readClientIp } from "@/shared/http/read-client-ip";
import {
  authUserSchema,
  commonErrorResponses,
  loginResponseSchema,
} from "@/shared/http/response-schemas";

export const authRoutes = new Elysia({ prefix: "/auth" })
  .post(
    "/login",
    async ({ body, request, set }) => {
      try {
        return await appServices.auth.login({
          email: body.email,
          password: body.password,
          ipAddress: readClientIp(request.headers) ?? null,
        });
      } catch (error) {
        return handleDomainError(set, error);
      }
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        password: t.String({ minLength: 6 }),
      }),
      response: {
        200: loginResponseSchema,
        ...commonErrorResponses,
      },
    },
  )
  .get(
    "/me",
    async ({ headers, set }) => {
      try {
        return await appServices.auth.requireUser(headers.authorization);
      } catch (error) {
        return handleDomainError(set, error);
      }
    },
    {
      response: {
        200: authUserSchema,
        ...commonErrorResponses,
      },
    },
  );
