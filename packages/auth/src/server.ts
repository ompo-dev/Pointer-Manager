import os from "node:os";
import bcrypt from "bcryptjs";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { jwt } from "better-auth/plugins";
import { authEnv } from "./env";
import { authPrisma } from "./prisma";

function getTrustedOrigins() {
  const trustedOrigins = new Set<string>([authEnv.BETTER_AUTH_URL]);
  const baseUrl = new URL(authEnv.BETTER_AUTH_URL);
  const configuredOrigins = authEnv.BETTER_AUTH_TRUSTED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  for (const origin of configuredOrigins ?? []) {
    trustedOrigins.add(origin);
  }

  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family !== "IPv4" || entry.internal) {
        continue;
      }

      trustedOrigins.add(`${baseUrl.protocol}//${entry.address}${baseUrl.port ? `:${baseUrl.port}` : ""}`);
    }
  }

  return Array.from(trustedOrigins);
}

export const auth = betterAuth({
  baseURL: authEnv.BETTER_AUTH_URL,
  secret: authEnv.BETTER_AUTH_SECRET,
  trustedOrigins: getTrustedOrigins(),
  database: prismaAdapter(authPrisma, {
    provider: "postgresql",
  }),
  experimental: {
    joins: true,
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    password: {
      hash: async (password) => bcrypt.hash(password, 12),
      verify: async ({ hash, password }) => bcrypt.compare(password, hash),
    },
  },
  user: {
    modelName: "User",
    additionalFields: {
      organizationId: {
        type: "string",
        input: false,
      },
      plantId: {
        type: "string",
        required: false,
        input: false,
      },
      role: {
        type: ["SUPER_ADMIN", "ADMIN", "PLANT_SUPERVISOR"],
        input: false,
      },
      modulePermissions: {
        type: "string[]",
        required: false,
        input: false,
      },
      status: {
        type: ["ACTIVE", "INACTIVE"],
        input: false,
      },
      lastLoginAt: {
        type: "date",
        required: false,
        input: false,
      },
    },
  },
  session: {
    modelName: "Session",
  },
  account: {
    modelName: "Account",
  },
  verification: {
    modelName: "Verification",
  },
  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          const user = await authPrisma.user.update({
            where: { id: session.userId },
            data: { lastLoginAt: new Date() },
            select: {
              id: true,
              organizationId: true,
            },
          });

          await authPrisma.auditLog.create({
            data: {
              organizationId: user.organizationId,
              actorUserId: user.id,
              action: "AUTH.LOGIN",
              entity: "User",
              entityId: user.id,
            },
          });
        },
      },
    },
  },
  plugins: [
    jwt({
      schema: {
        jwks: {
          modelName: "Jwks",
        },
      },
      jwt: {
        issuer: authEnv.BETTER_AUTH_URL,
        audience: authEnv.BETTER_AUTH_AUDIENCE,
        expirationTime: "10h",
        definePayload: ({ user }) => ({
          organizationId: user.organizationId,
          plantId: user.plantId ?? null,
          role: user.role,
          modulePermissions: user.modulePermissions ?? [],
          status: user.status,
          email: user.email,
          name: user.name,
        }),
      },
    }),
  ],
});
