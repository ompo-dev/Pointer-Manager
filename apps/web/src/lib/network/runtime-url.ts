const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}

function isLoopbackHost(hostname: string) {
  return LOOPBACK_HOSTS.has(hostname);
}

function replaceLoopbackHostname(value: string, hostname: string) {
  try {
    const url = new URL(value);

    if (!isLoopbackHost(url.hostname) || isLoopbackHost(hostname)) {
      return trimTrailingSlash(url.toString());
    }

    url.hostname = hostname;
    return trimTrailingSlash(url.toString());
  } catch {
    return trimTrailingSlash(value);
  }
}

export function resolveRuntimeUrl(
  configuredUrl: string | undefined,
  fallbackUrl: string,
) {
  const baseUrl = trimTrailingSlash(configuredUrl ?? fallbackUrl);

  if (typeof window === "undefined") {
    return baseUrl;
  }

  return replaceLoopbackHostname(baseUrl, window.location.hostname);
}

export function resolveApiOrigin() {
  return resolveRuntimeUrl(process.env.NEXT_PUBLIC_API_URL, "http://localhost:4000");
}

export function resolveSocketOrigin() {
  return resolveRuntimeUrl(
    process.env.NEXT_PUBLIC_API_SOCKET_IO_URL,
    "http://localhost:4001",
  );
}
