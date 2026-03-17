import os from "node:os";

function getAllowedDevOrigins() {
  const hosts = new Set(["localhost", "127.0.0.1"]);

  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) {
        hosts.add(entry.address);
      }
    }
  }

  return Array.from(hosts);
}

const isDev = process.env.NODE_ENV !== "production";
const port = process.env.PORT ?? "3000";

/** @type {import("next").NextConfig} */
const nextConfig = {
  typedRoutes: true,
  transpilePackages: ["@point-manager/auth"],
  distDir: isDev ? `.next-dev-${port}` : ".next",
  allowedDevOrigins: getAllowedDevOrigins(),
};

export default nextConfig;
