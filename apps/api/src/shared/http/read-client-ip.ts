const IP_HEADER_CANDIDATES = [
  "cf-connecting-ip",
  "true-client-ip",
  "fly-client-ip",
  "x-real-ip",
  "x-forwarded-for",
] as const;

function normalizeIpAddress(value?: string | null) {
  if (!value) {
    return undefined;
  }

  let normalized = value.trim();

  if (!normalized) {
    return undefined;
  }

  if (normalized.startsWith("::ffff:")) {
    normalized = normalized.slice(7);
  }

  if (normalized === "::1") {
    return "127.0.0.1";
  }

  return normalized;
}

type RequestIpServer = {
  requestIP?: (request: Request) => { address: string } | null;
} | null;

export function readClientIp(headers: Headers, request?: Request, server?: RequestIpServer) {
  const socketAddress = request ? server?.requestIP?.(request)?.address : undefined;
  const normalizedSocketAddress = normalizeIpAddress(socketAddress);

  if (normalizedSocketAddress) {
    return normalizedSocketAddress;
  }

  for (const headerName of IP_HEADER_CANDIDATES) {
    const value = headers.get(headerName);

    if (!value) {
      continue;
    }

    const normalized = normalizeIpAddress(value.split(",")[0]?.trim());
    if (normalized) {
      return normalized;
    }
  }

  return undefined;
}
