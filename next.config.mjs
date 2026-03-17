import os from "node:os";
import { PHASE_PRODUCTION_BUILD } from "next/constants.js";

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

export default function nextConfig(phase) {
  const isProductionBuild = phase === PHASE_PRODUCTION_BUILD;

  return {
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
      ...(isProductionBuild ? { workerThreads: true } : {}),
    },
  };
}
