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

const nextConfig = {
  typedRoutes: true,
  transpilePackages: ["@point-manager/auth"],
  allowedDevOrigins: getAllowedDevOrigins(),
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    externalDir: true,
    webpackBuildWorker: false,
  },
};

export default nextConfig;
