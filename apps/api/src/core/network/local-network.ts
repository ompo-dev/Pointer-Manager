import os from "node:os";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

function normalizeOrigin(origin: string) {
  try {
    return new URL(origin).origin;
  } catch {
    return origin.replace(/\/$/, "");
  }
}

export function getLocalIpv4Addresses() {
  const addresses = new Set<string>();

  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family !== "IPv4" || entry.internal) {
        continue;
      }

      addresses.add(entry.address);
    }
  }

  return Array.from(addresses);
}

export function expandLocalOrigins(configuredOrigins: string) {
  const origins = new Set<string>();

  for (const origin of configuredOrigins.split(",").map((value) => value.trim()).filter(Boolean)) {
    const normalizedOrigin = normalizeOrigin(origin);
    origins.add(normalizedOrigin);

    try {
      const url = new URL(normalizedOrigin);

      if (!LOOPBACK_HOSTS.has(url.hostname)) {
        continue;
      }

      for (const address of getLocalIpv4Addresses()) {
        const expanded = new URL(normalizedOrigin);
        expanded.hostname = address;
        origins.add(expanded.origin);
      }
    } catch {
      continue;
    }
  }

  return Array.from(origins);
}

export function getPrimaryLocalIpv4Address() {
  return getLocalIpv4Addresses()[0] ?? null;
}
