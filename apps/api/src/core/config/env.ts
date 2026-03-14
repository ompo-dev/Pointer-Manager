import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z
    .string()
    .default("postgresql://postgres:postgres@localhost:5432/point_manager"),
  DIRECT_URL: z.string().optional(),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32)
    .default("point-manager-better-auth-dev-secret-2026"),
  BETTER_AUTH_AUDIENCE: z.string().default("point-manager-api"),
});

export const env = schema.parse(process.env);
