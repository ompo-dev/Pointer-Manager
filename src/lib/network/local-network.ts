"use client";

type BrowserConnection = {
  type?: string;
  effectiveType?: string;
};

function normalizeIpv4(value: string) {
  const normalized = value.trim();

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

  return normalized;
}

function isPrivateIpv4(value: string) {
  const normalized = normalizeIpv4(value);

  if (!normalized) {
    return false;
  }

  const parts = normalized.split(".").map((part) => Number.parseInt(part, 10));

  if (parts[0] === 10) {
    return true;
  }

  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
    return true;
  }

  if (parts[0] === 192 && parts[1] === 168) {
    return true;
  }

  return parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127;
}

export function readBrowserConnectionType() {
  if (typeof navigator === "undefined") {
    return null;
  }

  const networkNavigator = navigator as Navigator & {
    connection?: BrowserConnection;
    mozConnection?: BrowserConnection;
    webkitConnection?: BrowserConnection;
  };

  return (
    networkNavigator.connection?.type ??
    networkNavigator.mozConnection?.type ??
    networkNavigator.webkitConnection?.type ??
    null
  );
}

export function readBrowserConnectionEffectiveType() {
  if (typeof navigator === "undefined") {
    return null;
  }

  const networkNavigator = navigator as Navigator & {
    connection?: BrowserConnection;
    mozConnection?: BrowserConnection;
    webkitConnection?: BrowserConnection;
  };

  return (
    networkNavigator.connection?.effectiveType ??
    networkNavigator.mozConnection?.effectiveType ??
    networkNavigator.webkitConnection?.effectiveType ??
    null
  );
}

export function readBrowserConnectionProfile() {
  return {
    type: readBrowserConnectionType(),
    effectiveType: readBrowserConnectionEffectiveType(),
  };
}

export function readBrowserHostnameIpv4Candidate() {
  if (typeof window === "undefined") {
    return null;
  }

  const hostname = normalizeIpv4(window.location.hostname);

  if (!hostname || !isPrivateIpv4(hostname)) {
    return null;
  }

  return hostname;
}

export async function captureBrowserLocation(options?: PositionOptions) {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    return null;
  }

  return await new Promise<{
    latitude: number;
    longitude: number;
    accuracyMeters: number | null;
  } | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: Number.isFinite(position.coords.accuracy)
            ? position.coords.accuracy
            : null,
        });
      },
      () => {
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
        ...options,
      },
    );
  });
}

export async function detectBrowserLocalIpv4Candidates() {
  if (typeof window === "undefined" || typeof RTCPeerConnection === "undefined") {
    return [];
  }

  const candidates = new Set<string>();
  const peer = new RTCPeerConnection({
    iceServers: [],
  });

  peer.createDataChannel("network-probe");

  const finish = () => {
    peer.onicecandidate = null;
    void peer.close();
    return Array.from(candidates);
  };

  return await new Promise<string[]>((resolve) => {
    const timeout = window.setTimeout(() => {
      resolve(finish());
    }, 1500);

    peer.onicecandidate = (event) => {
      if (!event.candidate?.candidate) {
        window.clearTimeout(timeout);
        resolve(finish());
        return;
      }

      const matches = event.candidate.candidate.match(
        /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
      );

      for (const value of matches ?? []) {
        const normalized = normalizeIpv4(value);

        if (!normalized || normalized.startsWith("127.")) {
          continue;
        }

        candidates.add(normalized);
      }
    };

    void peer
      .createOffer()
      .then((offer) => peer.setLocalDescription(offer))
      .catch(() => {
        window.clearTimeout(timeout);
        resolve(finish());
      });
  });
}
