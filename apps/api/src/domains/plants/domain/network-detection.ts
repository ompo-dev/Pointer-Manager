import os from "node:os";
import { execFileSync } from "node:child_process";

export type NetworkConnectionKind = "wifi" | "ethernet" | "mobile" | "unknown";

export interface DetectPlantNetworkInput {
  requestIp?: string | null;
  browserIpCandidates?: string[];
  browserConnectionType?: string | null;
}

export interface DetectedPlantNetworkCandidate {
  id: string;
  label: string;
  connectionKind: NetworkConnectionKind;
  interfaceName: string | null;
  ipAddress: string | null;
  suggestedIpv4Cidr: string | null;
  ssid: string | null;
  bssid: string | null;
  source: string;
  isCurrent: boolean;
  notes: string | null;
}

export interface DetectedPlantNetworkResult {
  requestIp: string | null;
  selectedCandidateId: string | null;
  ipAddress: string | null;
  suggestedIpv4Cidr: string | null;
  interfaceName: string | null;
  connectionKind: NetworkConnectionKind | null;
  ssid: string | null;
  bssid: string | null;
  source: string | null;
  canAutoReadWifiIdentity: boolean;
  notes: string;
  candidates: DetectedPlantNetworkCandidate[];
}

type HostWifiDetails = {
  interfaceName: string;
  ssid: string | null;
  bssid: string | null;
};

function normalizeLabel(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeIpAddress(value?: string | null) {
  if (!value) {
    return null;
  }

  let normalized = value.trim();

  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("::ffff:")) {
    normalized = normalized.slice(7);
  }

  if (normalized === "::1") {
    return "127.0.0.1";
  }

  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    normalized = normalized.slice(1, -1);
  }

  const zoneIndex = normalized.indexOf("%");
  if (zoneIndex >= 0) {
    normalized = normalized.slice(0, zoneIndex);
  }

  return normalized;
}

function parseIpv4(value?: string | null) {
  const normalized = normalizeIpAddress(value);

  if (!normalized) {
    return null;
  }

  const parts = normalized.split(".").map((part) => Number.parseInt(part, 10));

  if (
    parts.length !== 4 ||
    parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)
  ) {
    return null;
  }

  return parts;
}

function ipv4ToNumber(parts: number[]) {
  return (
    ((parts[0] << 24) >>> 0) +
    ((parts[1] << 16) >>> 0) +
    ((parts[2] << 8) >>> 0) +
    (parts[3] >>> 0)
  );
}

function numberToIpv4(value: number) {
  return [
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255,
  ].join(".");
}

function isIpv4(value?: string | null): value is string {
  return parseIpv4(value) !== null;
}

function isLoopbackIpv4(value?: string | null) {
  const parts = parseIpv4(value);
  return !!parts && parts[0] === 127;
}

function isPrivateIpv4(value?: string | null) {
  const parts = parseIpv4(value);

  if (!parts) {
    return false;
  }

  if (parts[0] === 10) {
    return true;
  }

  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
    return true;
  }

  return parts[0] === 192 && parts[1] === 168;
}

function buildNetworkCidr(value?: string | null, prefix = 24) {
  const parts = parseIpv4(value);

  if (!parts || prefix < 0 || prefix > 32) {
    return null;
  }

  const ipValue = ipv4ToNumber(parts);
  const mask =
    prefix === 0 ? 0 : prefix === 32 ? 0xffffffff : ((0xffffffff << (32 - prefix)) >>> 0);
  const networkValue = (ipValue & mask) >>> 0;

  return `${numberToIpv4(networkValue)}/${prefix}`;
}

function buildSuggestedIpv4Cidr(value?: string | null) {
  return buildNetworkCidr(value, 24);
}

function normalizeIpv4Cidr(value?: string | null) {
  if (!value) {
    return null;
  }

  const [address, prefixValue] = value.split("/");
  const prefix = Number.parseInt(prefixValue ?? "", 10);

  if (Number.isNaN(prefix)) {
    return buildSuggestedIpv4Cidr(address);
  }

  return buildNetworkCidr(address, prefix);
}

function sameIpv4Subnet(first?: string | null, second?: string | null) {
  const left = parseIpv4(first);
  const right = parseIpv4(second);

  if (!left || !right) {
    return false;
  }

  return left[0] === right[0] && left[1] === right[1] && left[2] === right[2];
}

function normalizeBrowserConnectionKind(value?: string | null): NetworkConnectionKind {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return "unknown";
  }

  if (normalized === "wifi" || normalized === "wlan" || normalized === "wireless") {
    return "wifi";
  }

  if (normalized === "ethernet" || normalized === "wired") {
    return "ethernet";
  }

  if (
    normalized === "cellular" ||
    normalized === "mobile" ||
    normalized === "4g" ||
    normalized === "5g"
  ) {
    return "mobile";
  }

  return "unknown";
}

function guessInterfaceConnectionKind(interfaceName: string): NetworkConnectionKind {
  const normalized = interfaceName.trim().toLowerCase();

  if (
    normalized.includes("wi-fi") ||
    normalized.includes("wifi") ||
    normalized.includes("wlan") ||
    normalized.includes("wireless")
  ) {
    return "wifi";
  }

  if (
    normalized.includes("ethernet") ||
    normalized.includes("eth") ||
    normalized.includes("lan")
  ) {
    return "ethernet";
  }

  return "unknown";
}

function shouldIgnoreInterfaceName(interfaceName: string) {
  const normalized = interfaceName.trim().toLowerCase();

  return [
    "vethernet",
    "hyper-v",
    "virtualbox",
    "vmware",
    "docker",
    "loopback",
    "wsl",
    "tailscale",
    "zerotier",
    "hamachi",
  ].some((keyword) => normalized.includes(keyword));
}

function formatConnectionLabel(
  connectionKind: NetworkConnectionKind,
  interfaceName: string | null,
  ssid: string | null,
  ipAddress: string | null,
) {
  if (connectionKind === "wifi") {
    return ssid
      ? `Wi-Fi ${ssid}`
      : `Wi-Fi${interfaceName ? ` (${interfaceName})` : ""}`;
  }

  if (connectionKind === "ethernet") {
    return ssid
      ? `Rede cabeada ${ssid}${interfaceName ? ` (${interfaceName})` : ""}`
      : `Rede cabeada${interfaceName ? ` (${interfaceName})` : ""}`;
  }

  if (connectionKind === "mobile") {
    return "Rede movel";
  }

  return ipAddress ? `Rede local ${ipAddress}` : "Rede local";
}

function buildCandidateNotes(
  connectionKind: NetworkConnectionKind,
  source: string,
  interfaceName: string | null,
  ssid: string | null,
  bssid: string | null,
) {
  const parts = [
    interfaceName ? `Interface: ${interfaceName}` : null,
    source === "host-interface" ? "Detectado no equipamento que hospeda o sistema." : null,
  ];

  if (connectionKind === "ethernet") {
    parts.push(
      ssid || bssid
        ? `Conexao cabeada detectada na mesma rede do Wi-Fi${ssid ? ` ${ssid}` : ""}.`
        : "Conexao cabeada detectada. SSID e BSSID nao puderam ser associados automaticamente.",
    );
  }

  if (connectionKind === "wifi") {
    parts.push(
      ssid || bssid
        ? "Wi-Fi detectado automaticamente no equipamento."
        : "Wi-Fi detectado, mas SSID/BSSID nao puderam ser lidos automaticamente.",
    );
  }

  if (connectionKind === "mobile") {
    parts.push("Conexao movel detectada. Essa rede nao deve ser autorizada para ponto.");
  }

  return parts.filter(Boolean).join(" ");
}

function readWindowsWifiInterfaces() {
  if (process.platform !== "win32") {
    return [];
  }

  try {
    const output = execFileSync("netsh", ["wlan", "show", "interfaces"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });

    return output
      .split(/\r?\n\r?\n+/)
      .map((block) => {
        const lines = block.split(/\r?\n/);
        const fields = new Map<string, string>();

        for (const line of lines) {
          const match = line.match(/^\s*([^:]+?)\s*:\s*(.+?)\s*$/);

          if (!match) {
            continue;
          }

          fields.set(normalizeLabel(match[1]), match[2].trim());
        }

        const state =
          fields.get("state") ??
          fields.get("estado") ??
          null;
        const normalizedState = normalizeLabel(state ?? "");
        const isConnected =
          normalizedState.includes("connected") ||
          normalizedState.includes("conectado");

        if (!isConnected) {
          return null;
        }

        const interfaceName =
          fields.get("name") ??
          fields.get("nome") ??
          null;
        const ssid =
          fields.get("ssid") ??
          fields.get("perfil") ??
          fields.get("profile") ??
          null;
        const bssid =
          fields.get("ap bssid") ??
          fields.get("bssid") ??
          null;

        if (!interfaceName) {
          return null;
        }

        return {
          interfaceName,
          ssid: ssid ?? null,
          bssid: bssid ?? null,
        } satisfies HostWifiDetails;
      })
      .filter((value): value is HostWifiDetails => !!value);
  } catch {
    return [];
  }
}

function inspectHostNetworkCandidates() {
  const wifiDetails = readWindowsWifiInterfaces();
  const wifiByInterfaceName = new Map(
    wifiDetails.map((item) => [item.interfaceName.toLowerCase(), item]),
  );
  const candidates: DetectedPlantNetworkCandidate[] = [];

  for (const [interfaceName, addresses] of Object.entries(
    os.networkInterfaces(),
  ) as Array<[string, os.NetworkInterfaceInfo[] | undefined]>) {
    if (shouldIgnoreInterfaceName(interfaceName)) {
      continue;
    }

    const interfaceAddresses = addresses ?? [];
    const ipv4Address = interfaceAddresses.find((address: os.NetworkInterfaceInfo) => {
      const family = String(address.family);
      return family === "IPv4" && !address.internal;
    });

    if (!ipv4Address) {
      continue;
    }

    const ipAddress = normalizeIpAddress(ipv4Address.address);
    if (!isIpv4(ipAddress)) {
      continue;
    }

    const wifiInfo = wifiByInterfaceName.get(interfaceName.toLowerCase()) ?? null;
    const connectionKind = wifiInfo
      ? "wifi"
      : guessInterfaceConnectionKind(interfaceName);
    const suggestedIpv4Cidr =
      typeof ipv4Address.cidr === "string" && ipv4Address.cidr
        ? normalizeIpv4Cidr(ipv4Address.cidr)
        : buildSuggestedIpv4Cidr(ipAddress);

    candidates.push({
      id: `host:${interfaceName}:${ipAddress}`,
      label: formatConnectionLabel(connectionKind, interfaceName, wifiInfo?.ssid ?? null, ipAddress),
      connectionKind,
      interfaceName,
      ipAddress,
      suggestedIpv4Cidr,
      ssid: wifiInfo?.ssid ?? null,
      bssid: wifiInfo?.bssid ?? null,
      source: "host-interface",
      isCurrent: false,
      notes: buildCandidateNotes(
        connectionKind,
        "host-interface",
        interfaceName,
        wifiInfo?.ssid ?? null,
        wifiInfo?.bssid ?? null,
      ),
    });
  }

  const wifiIdentityCandidates = candidates.filter(
    (candidate) =>
      candidate.connectionKind === "wifi" &&
      Boolean(candidate.ssid || candidate.bssid),
  );

  const enrichedCandidates = candidates.map((candidate) => {
    if (candidate.connectionKind !== "ethernet" || candidate.ssid || candidate.bssid) {
      return candidate;
    }

    const relatedWifiCandidate =
      wifiIdentityCandidates.find((wifiCandidate) =>
        sameIpv4Subnet(wifiCandidate.ipAddress, candidate.ipAddress),
      ) ??
      (wifiIdentityCandidates.length === 1 ? wifiIdentityCandidates[0] : null);

    if (!relatedWifiCandidate) {
      return candidate;
    }

    const inheritedSsid = relatedWifiCandidate.ssid ?? null;
    const inheritedBssid = relatedWifiCandidate.bssid ?? null;

    return {
      ...candidate,
      label: formatConnectionLabel(
        candidate.connectionKind,
        candidate.interfaceName,
        inheritedSsid,
        candidate.ipAddress,
      ),
      ssid: inheritedSsid,
      bssid: inheritedBssid,
      notes: buildCandidateNotes(
        candidate.connectionKind,
        candidate.source,
        candidate.interfaceName,
        inheritedSsid,
        inheritedBssid,
      ),
    } satisfies DetectedPlantNetworkCandidate;
  });

  return enrichedCandidates.sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));
}

function buildRequestCandidate(
  ipAddress: string,
  browserConnectionType?: string | null,
): DetectedPlantNetworkCandidate {
  const connectionKind = normalizeBrowserConnectionKind(browserConnectionType);

  return {
    id: `request:${ipAddress}`,
    label: formatConnectionLabel(connectionKind, null, null, ipAddress),
    connectionKind,
    interfaceName: null,
    ipAddress,
    suggestedIpv4Cidr: buildSuggestedIpv4Cidr(ipAddress),
    ssid: null,
    bssid: null,
    source: "request-ip",
    isCurrent: false,
    notes: "IP do dispositivo atual detectado pela requisicao HTTP.",
  };
}

function buildBrowserCandidates(
  ips: string[],
  browserConnectionType?: string | null,
) {
  const connectionKind = normalizeBrowserConnectionKind(browserConnectionType);

  return ips.map(
    (ipAddress) =>
      ({
        id: `browser:${ipAddress}`,
        label: formatConnectionLabel(connectionKind, null, null, ipAddress),
        connectionKind,
        interfaceName: null,
        ipAddress,
        suggestedIpv4Cidr: buildSuggestedIpv4Cidr(ipAddress),
        ssid: null,
        bssid: null,
        source: "browser-local-ip",
        isCurrent: false,
        notes: "IP local identificado no navegador para ajudar na escolha da rede atual.",
      }) satisfies DetectedPlantNetworkCandidate,
  );
}

function dedupeCandidates(candidates: DetectedPlantNetworkCandidate[]) {
  const seen = new Set<string>();

  return candidates.filter((candidate) => {
    const key = `${candidate.source}:${candidate.interfaceName ?? "-"}:${candidate.ipAddress ?? "-"}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function selectCurrentCandidate(
  candidates: DetectedPlantNetworkCandidate[],
  input: DetectPlantNetworkInput,
) {
  if (!candidates.length) {
    return null;
  }

  const browserConnectionKind = normalizeBrowserConnectionKind(input.browserConnectionType);
  const hintIps = Array.from(
    new Set(
      [input.requestIp, ...(input.browserIpCandidates ?? [])]
        .map(normalizeIpAddress)
        .filter(isIpv4),
    ),
  );

  let selected = candidates[0];
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const candidate of candidates) {
    let score = 0;

    if (candidate.ipAddress && hintIps.includes(candidate.ipAddress)) {
      score += 100;
    } else if (
      candidate.ipAddress &&
      hintIps.some((hintIp) => sameIpv4Subnet(hintIp, candidate.ipAddress))
    ) {
      score += 60;
    }

    if (browserConnectionKind !== "unknown" && candidate.connectionKind === browserConnectionKind) {
      score += 20;
    }

    if (candidate.source === "host-interface") {
      score += 10;
    }

    if (score > bestScore) {
      bestScore = score;
      selected = candidate;
    }
  }

  return selected;
}

export function detectPlantNetwork(input: DetectPlantNetworkInput): DetectedPlantNetworkResult {
  const requestIp = normalizeIpAddress(input.requestIp);
  const browserIpCandidates = Array.from(
    new Set(
      (input.browserIpCandidates ?? [])
        .map(normalizeIpAddress)
        .filter((value): value is string => !!value && isPrivateIpv4(value)),
    ),
  );

  const candidates = inspectHostNetworkCandidates();

  if (
    requestIp &&
    isPrivateIpv4(requestIp) &&
    !isLoopbackIpv4(requestIp) &&
    !candidates.some((candidate) => candidate.ipAddress === requestIp)
  ) {
    candidates.unshift(buildRequestCandidate(requestIp, input.browserConnectionType));
  }

  if (browserIpCandidates.length) {
    candidates.push(...buildBrowserCandidates(browserIpCandidates, input.browserConnectionType));
  }

  const uniqueCandidates = dedupeCandidates(candidates);
  const selectedCandidate = selectCurrentCandidate(uniqueCandidates, {
    ...input,
    requestIp,
    browserIpCandidates,
  });

  const resolvedCandidates = uniqueCandidates.map((candidate) => ({
    ...candidate,
    isCurrent: candidate.id === selectedCandidate?.id,
  }));

  if (!selectedCandidate) {
    return {
      requestIp,
      selectedCandidateId: null,
      ipAddress: requestIp,
      suggestedIpv4Cidr: buildSuggestedIpv4Cidr(requestIp),
      interfaceName: null,
      connectionKind: null,
      ssid: null,
      bssid: null,
      source: null,
      canAutoReadWifiIdentity: false,
      notes:
        "Nao foi possivel identificar automaticamente a rede atual. Verifique se o equipamento possui uma interface IPv4 ativa.",
      candidates: resolvedCandidates,
    };
  }

  return {
    requestIp,
    selectedCandidateId: selectedCandidate.id,
    ipAddress: selectedCandidate.ipAddress,
    suggestedIpv4Cidr: selectedCandidate.suggestedIpv4Cidr,
    interfaceName: selectedCandidate.interfaceName,
    connectionKind: selectedCandidate.connectionKind,
    ssid: selectedCandidate.ssid,
    bssid: selectedCandidate.bssid,
    source: selectedCandidate.source,
    canAutoReadWifiIdentity: resolvedCandidates.some(
      (candidate) => Boolean(candidate.ssid || candidate.bssid),
    ),
    notes:
      selectedCandidate.notes ??
      "Rede atual identificada e pronta para ser adicionada como rede autorizada.",
    candidates: resolvedCandidates,
  };
}
