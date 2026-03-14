import { z } from "zod";

const schema = z.object({
  BETTER_AUTH_SECRET: z
    .string()
    .min(32)
    .default("point-manager-better-auth-dev-secret-2026"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  BETTER_AUTH_AUDIENCE: z.string().default("point-manager-api"),
  BETTER_AUTH_TRUSTED_ORIGINS: z.string().optional(),
});

export const authEnv = schema.parse(process.env);
