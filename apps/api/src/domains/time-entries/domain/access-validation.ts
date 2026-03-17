import type { AuthorizedNetwork, Plant } from "@prisma/client";

interface AccessValidationInput {
  deviceIp?: string | null;
  wifiSsid?: string | null;
  wifiBssid?: string | null;
  geoLatitude?: number | null;
  geoLongitude?: number | null;
  networkType?: string | null;
  networkEffectiveType?: string | null;
}

type AccessValidationPlant = Pick<
  Plant,
  | "name"
  | "requireWifiMatch"
  | "requireSelfie"
  | "geofenceLatitude"
  | "geofenceLongitude"
  | "geofenceRadiusMeters"
> & {
  authorizedNetworks: AuthorizedNetwork[];
};

type NetworkMatchKind = "ssid" | "bssid" | "cidr" | null;

export interface PlantNetworkAccessEvaluation {
  status: "AUTHORIZED" | "BLOCKED" | "OPEN";
  reason: "authorized" | "network" | "cellular" | "open";
  message: string;
  observedIp: string | null;
  currentNetworkName: string | null;
  matched: boolean;
  matchedBy: NetworkMatchKind;
  matchedNetworkName: string | null;
  browserHintIgnored: boolean;
}

export interface PlantLocationAccessEvaluation {
  status: "AUTHORIZED" | "BLOCKED" | "OPEN" | "PENDING";
  reason: "authorized" | "geofence" | "open" | "pending";
  message: string;
  required: boolean;
  observedLatitude: number | null;
  observedLongitude: number | null;
  distanceMeters: number | null;
  radiusMeters: number | null;
}

function parseIpv4(value: string) {
  const parts = value.split(".").map((part) => Number.parseInt(part, 10));

  if (
    parts.length !== 4 ||
    parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)
  ) {
    return null;
  }

  return (
    ((parts[0] << 24) >>> 0) +
    ((parts[1] << 16) >>> 0) +
    ((parts[2] << 8) >>> 0) +
    (parts[3] >>> 0)
  );
}

function matchIpv4Cidr(ip: string, cidr: string) {
  const [network, prefix] = cidr.split("/");
  const ipValue = parseIpv4(ip);
  const networkValue = parseIpv4(network);
  const prefixValue = Number.parseInt(prefix ?? "", 10);

  if (
    ipValue === null ||
    networkValue === null ||
    Number.isNaN(prefixValue) ||
    prefixValue < 0 ||
    prefixValue > 32
  ) {
    return false;
  }

  if (prefixValue === 0) {
    return true;
  }

  const mask = prefixValue === 32 ? 0xffffffff : ((0xffffffff << (32 - prefixValue)) >>> 0);
  return (ipValue & mask) === (networkValue & mask);
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function calculateDistanceMeters(
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number,
) {
  const earthRadius = 6371000;
  const latitudeDelta = degreesToRadians(toLatitude - fromLatitude);
  const longitudeDelta = degreesToRadians(toLongitude - fromLongitude);
  const latitudeA = degreesToRadians(fromLatitude);
  const latitudeB = degreesToRadians(toLatitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) *
      Math.cos(latitudeB) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadius * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function findMatchingAuthorizedNetwork(
  activeNetworks: AuthorizedNetwork[],
  input: AccessValidationInput,
) {
  for (const network of activeNetworks) {
    const ssidMatched =
      !!network.ssid &&
      !!input.wifiSsid &&
      network.ssid.trim().toLowerCase() === input.wifiSsid.trim().toLowerCase();

    if (ssidMatched) {
      return {
        network,
        matchedBy: "ssid" as const,
      };
    }

    const bssidMatched =
      !!network.bssid &&
      !!input.wifiBssid &&
      network.bssid.trim().toLowerCase() === input.wifiBssid.trim().toLowerCase();

    if (bssidMatched) {
      return {
        network,
        matchedBy: "bssid" as const,
      };
    }

    const ipMatched =
      !!network.ipv4Cidr &&
      !!input.deviceIp &&
      matchIpv4Cidr(input.deviceIp, network.ipv4Cidr);

    if (ipMatched) {
      return {
        network,
        matchedBy: "cidr" as const,
      };
    }
  }

  return {
    network: null,
    matchedBy: null,
  };
}

function resolveObservedNetworkName(input: AccessValidationInput) {
  if (input.wifiSsid?.trim()) {
    return input.wifiSsid.trim();
  }

  const networkType = input.networkType?.trim().toLowerCase();

  if (networkType === "ethernet" || networkType === "wired") {
    return input.deviceIp ? `Rede cabeada (${input.deviceIp})` : "Rede cabeada";
  }

  if (
    networkType === "wifi" ||
    networkType === "wlan" ||
    networkType === "wireless"
  ) {
    return input.deviceIp ? `Wi-Fi local (${input.deviceIp})` : "Wi-Fi local";
  }

  if (networkType === "cellular" || networkType === "mobile") {
    return "Rede movel";
  }

  return input.deviceIp ? `Rede local (${input.deviceIp})` : null;
}

function evaluatePlantLocationAccess(
  plant: AccessValidationPlant,
  input: AccessValidationInput,
): PlantLocationAccessEvaluation {
  const geofenceConfigured =
    plant.geofenceLatitude !== null &&
    plant.geofenceLongitude !== null &&
    plant.geofenceRadiusMeters !== null;

  if (!geofenceConfigured) {
    return {
      status: "OPEN",
      reason: "open",
      message: "Geolocalizacao nao obrigatoria para esta usina.",
      required: false,
      observedLatitude: input.geoLatitude ?? null,
      observedLongitude: input.geoLongitude ?? null,
      distanceMeters: null,
      radiusMeters: null,
    };
  }

  const geofenceLatitude = plant.geofenceLatitude;
  const geofenceLongitude = plant.geofenceLongitude;
  const geofenceRadiusMeters = plant.geofenceRadiusMeters;

  if (
    geofenceLatitude === null ||
    geofenceLongitude === null ||
    geofenceRadiusMeters === null
  ) {
    return {
      status: "BLOCKED",
      reason: "geofence",
      message: "Configuracao de geofence invalida para esta usina.",
      required: true,
      observedLatitude: input.geoLatitude ?? null,
      observedLongitude: input.geoLongitude ?? null,
      distanceMeters: null,
      radiusMeters: null,
    };
  }

  if (input.geoLatitude === null || input.geoLatitude === undefined) {
    return {
      status: "PENDING",
      reason: "pending",
      message: "Aguardando localizacao do dispositivo para validar esta usina.",
      required: true,
      observedLatitude: null,
      observedLongitude: input.geoLongitude ?? null,
      distanceMeters: null,
      radiusMeters: geofenceRadiusMeters,
    };
  }

  if (input.geoLongitude === null || input.geoLongitude === undefined) {
    return {
      status: "PENDING",
      reason: "pending",
      message: "Aguardando localizacao do dispositivo para validar esta usina.",
      required: true,
      observedLatitude: input.geoLatitude ?? null,
      observedLongitude: null,
      distanceMeters: null,
      radiusMeters: geofenceRadiusMeters,
    };
  }

  const distanceMeters = calculateDistanceMeters(
    geofenceLatitude,
    geofenceLongitude,
    input.geoLatitude,
    input.geoLongitude,
  );

  if (distanceMeters > geofenceRadiusMeters) {
    return {
      status: "BLOCKED",
      reason: "geofence",
      message: "Dispositivo fora do raio autorizado da usina.",
      required: true,
      observedLatitude: input.geoLatitude,
      observedLongitude: input.geoLongitude,
      distanceMeters,
      radiusMeters: geofenceRadiusMeters,
    };
  }

  return {
    status: "AUTHORIZED",
    reason: "authorized",
    message: `Localizacao autorizada dentro do raio de ${Math.round(geofenceRadiusMeters)} m.`,
    required: true,
    observedLatitude: input.geoLatitude,
    observedLongitude: input.geoLongitude,
    distanceMeters,
    radiusMeters: geofenceRadiusMeters,
  };
}

export function evaluatePlantNetworkAccess(
  plant: AccessValidationPlant,
  input: AccessValidationInput,
): PlantNetworkAccessEvaluation {
  const networkType = input.networkType?.trim().toLowerCase();
  const networkEffectiveType = input.networkEffectiveType?.trim().toLowerCase();
  const mobileNetworkDetected =
    networkType === "cellular" ||
    networkType === "mobile";

  const activeNetworks = plant.authorizedNetworks.filter((network) => network.isActive);
  const matchedNetwork = findMatchingAuthorizedNetwork(activeNetworks, input);
  const networkMatched = !!matchedNetwork.network;
  const currentNetworkName =
    resolveObservedNetworkName(input) ?? matchedNetwork.network?.name ?? null;

  const mobileNetworkEvidence =
    mobileNetworkDetected && networkEffectiveType
      ? `${networkType} (${networkEffectiveType})`
      : networkType ?? null;

  if (mobileNetworkDetected && plant.requireWifiMatch && !networkMatched) {
    return {
      status: "BLOCKED",
      reason: "cellular",
      message: mobileNetworkEvidence
        ? `Registro bloqueado em rede movel (${mobileNetworkEvidence}). Conecte-se a rede autorizada da usina.`
        : "Registro bloqueado em rede movel. Conecte-se a rede autorizada da usina.",
      observedIp: input.deviceIp ?? null,
      currentNetworkName,
      matched: false,
      matchedBy: null,
      matchedNetworkName: null,
      browserHintIgnored: false,
    };
  }

  if (plant.requireWifiMatch && activeNetworks.length === 0) {
    return {
      status: "BLOCKED",
      reason: "network",
      message: "Esta usina exige validacao por Wi-Fi, mas ainda nao possui redes autorizadas ativas cadastradas.",
      observedIp: input.deviceIp ?? null,
      currentNetworkName,
      matched: false,
      matchedBy: null,
      matchedNetworkName: null,
      browserHintIgnored: false,
    };
  }

  if (plant.requireWifiMatch && !networkMatched) {
    return {
      status: "BLOCKED",
      reason: "network",
      message: "Dispositivo fora da rede Wi-Fi autorizada da usina.",
      observedIp: input.deviceIp ?? null,
      currentNetworkName,
      matched: false,
      matchedBy: null,
      matchedNetworkName: null,
      browserHintIgnored: false,
    };
  }

  if (activeNetworks.length === 0) {
    return {
      status: "OPEN",
      reason: "open",
      message: plant.requireWifiMatch
        ? "Nenhuma rede autorizada foi cadastrada para esta usina. O acesso segue liberado ate a configuracao ser concluida."
        : "Esta usina nao exige rede especifica no momento.",
      observedIp: input.deviceIp ?? null,
      currentNetworkName,
      matched: true,
      matchedBy: null,
      matchedNetworkName: null,
      browserHintIgnored: false,
    };
  }

  if (!matchedNetwork.network) {
    return {
      status: "OPEN",
      reason: "open",
      message: "Esta usina nao exige rede especifica no momento.",
      observedIp: input.deviceIp ?? null,
      currentNetworkName,
      matched: false,
      matchedBy: null,
      matchedNetworkName: null,
      browserHintIgnored: false,
    };
  }

  const browserHintIgnored = mobileNetworkDetected && networkMatched;
  const matchedByLabel =
    matchedNetwork.matchedBy === "cidr"
      ? "IP da rede"
      : matchedNetwork.matchedBy === "ssid"
        ? "SSID"
        : matchedNetwork.matchedBy === "bssid"
          ? "BSSID"
          : "identificacao da rede";

  return {
    status: "AUTHORIZED",
    reason: "authorized",
    message:
      matchedNetwork.matchedBy === "cidr"
        ? browserHintIgnored
          ? `Conexao autorizada pela mesma sub-rede da usina (${matchedNetwork.network.name}). O indicador de rede movel do navegador foi ignorado porque o IP autorizado prevaleceu.`
          : `Conexao autorizada pela mesma sub-rede da usina (${matchedNetwork.network.name}) por IP da rede.`
        : browserHintIgnored
          ? `Conexao autorizada na rede ${matchedNetwork.network.name}. O indicador de rede movel do navegador foi ignorado porque o ${matchedByLabel.toLowerCase()} autorizado prevaleceu.`
          : `Conexao autorizada na rede ${matchedNetwork.network.name} por ${matchedByLabel}.`,
    observedIp: input.deviceIp ?? null,
    currentNetworkName,
    matched: true,
    matchedBy: matchedNetwork.matchedBy,
    matchedNetworkName: matchedNetwork.network.name,
    browserHintIgnored,
  };
}

export function validatePlantAccess(
  plant: AccessValidationPlant,
  input: AccessValidationInput & { selfieUrl?: string | null },
) {
  const networkAccess = evaluatePlantNetworkAccess(plant, input);

  if (networkAccess.status === "BLOCKED") {
    return {
      valid: false,
      mode: networkAccess.reason === "cellular" ? "cellular" : "network",
      notes: networkAccess.message,
    } as const;
  }

  if (plant.requireSelfie && !input.selfieUrl) {
    return {
      valid: false,
      mode: "selfie",
      notes: "A usina exige selfie obrigatoria para prova de presenca.",
    } as const;
  }

  const locationAccess = evaluatePlantLocationAccess(plant, input);

  if (locationAccess.status === "PENDING" || locationAccess.status === "BLOCKED") {
    return {
      valid: false,
      mode: "geofence",
      notes: locationAccess.message,
    } as const;
  }

  return {
    valid: true,
    mode: locationAccess.required ? "network+geofence" : "network",
    notes: networkAccess.message,
  } as const;
}

export { evaluatePlantLocationAccess };
