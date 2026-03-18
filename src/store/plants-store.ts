"use client";

import { create } from "zustand";
import {
  createPlant,
  detectCurrentPlantNetwork,
  fetchPlant,
  fetchPlants,
  updatePlant,
  type DetectedPlantNetwork,
  type Plant,
  type PlantDetails,
} from "@/lib/api/plants";
import {
  captureBrowserLocation,
  detectBrowserLocalIpv4Candidates,
  readBrowserHostnameIpv4Candidate,
  readBrowserConnectionProfile,
} from "@/lib/network/local-network";
import {
  showErrorToast,
  showInfoToast,
  showLoadingToast,
  showSuccessToast,
  showWarningToast,
} from "@/lib/toast";
import { createOptimisticId, resolveErrorMessage } from "@/store/store-utils";

export interface PlantAuthorizedNetworkForm {
  id?: string;
  name: string;
  publicIpv4Cidr: string;
  localIpv4Cidr: string;
  ssid: string;
  bssid: string;
  notes: string;
}

export interface DetectedNetworkState extends DetectedPlantNetwork {}

export interface DetectedLocationState {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  distanceMeters: number | null;
  withinConfiguredGeofence: boolean | null;
  autoApplied: boolean;
  notes: string;
}

export interface PlantFormState {
  id?: string;
  code: string;
  name: string;
  city: string;
  state: string;
  openingHour: string;
  closingHour: string;
  qrToken: string;
  requireWifiMatch: string;
  requireSelfie: string;
  autoCloseLimitHours: string;
  lateAlertMinutes: string;
  geofenceLatitude: string;
  geofenceLongitude: string;
  geofenceRadiusMeters: string;
  authorizedNetworks: PlantAuthorizedNetworkForm[];
}

function emptyAuthorizedNetwork(): PlantAuthorizedNetworkForm {
  return {
    name: "",
    publicIpv4Cidr: "",
    localIpv4Cidr: "",
    ssid: "",
    bssid: "",
    notes: "",
  };
}

export const emptyPlantForm: PlantFormState = {
  code: "",
  name: "",
  city: "",
  state: "",
  openingHour: "06:00",
  closingHour: "18:00",
  qrToken: "",
  requireWifiMatch: "true",
  requireSelfie: "false",
  autoCloseLimitHours: "12",
  lateAlertMinutes: "540",
  geofenceLatitude: "",
  geofenceLongitude: "",
  geofenceRadiusMeters: "",
  authorizedNetworks: [],
};

function serializeNetworks(plant?: PlantDetails | Plant | null) {
  return (plant?.authorizedNetworks ?? []).map((network) => ({
    id: network.id,
    name: network.name,
    publicIpv4Cidr: network.publicIpv4Cidr ?? "",
    localIpv4Cidr: network.localIpv4Cidr ?? "",
    ssid: network.ssid ?? "",
    bssid: network.bssid ?? "",
    notes: network.notes ?? "",
  }));
}

function parseNetworks(networks: PlantAuthorizedNetworkForm[]) {
  return networks
    .map((network) => ({
      name: network.name.trim(),
      publicIpv4Cidr: network.publicIpv4Cidr.trim() || null,
      localIpv4Cidr: network.localIpv4Cidr.trim() || null,
      ssid: network.ssid.trim() || null,
      bssid: network.bssid.trim() || null,
      notes: network.notes.trim() || null,
    }))
    .filter(
      (network) =>
        network.name ||
        network.publicIpv4Cidr ||
        network.localIpv4Cidr ||
        network.ssid ||
        network.bssid ||
        network.notes,
    )
    .map((network) => ({
      ...network,
      name: network.name || "Rede autorizada",
    }));
}

function hasConfiguredNetworkIdentity(network: PlantAuthorizedNetworkForm) {
  return Boolean(
    network.publicIpv4Cidr.trim() ||
      network.localIpv4Cidr.trim() ||
    network.ssid.trim() ||
      network.bssid.trim(),
  );
}

function isLegacyDetectedPlaceholder(network: PlantAuthorizedNetworkForm) {
  const notes = network.notes.trim().toLowerCase();
  const name = network.name.trim().toLowerCase();

  return (
    !hasConfiguredNetworkIdentity(network) &&
    (name === "conexao atual" ||
      notes.includes("perfil do navegador") ||
      notes.includes("ip observado") ||
      notes.includes("saida publica observada"))
  );
}

function isAutoDetectedManagedNetwork(network: PlantAuthorizedNetworkForm) {
  const notes = network.notes.trim().toLowerCase();

  return (
    notes.includes("detectado no equipamento que hospeda o sistema") ||
    notes.includes("ip publico observado:")
  );
}

function buildDetectedNetworkForm(
  detection: DetectedPlantNetwork,
  candidate: {
    label: string;
    ssid?: string | null;
    bssid?: string | null;
    localIpv4Cidr?: string | null;
    notes?: string | null;
    localIpAddress?: string | null;
  },
  fallbackNotes: string,
): PlantAuthorizedNetworkForm {
  const notes = [
    candidate.notes ?? fallbackNotes,
    detection.observedPublicIp ? `IP publico observado: ${detection.observedPublicIp}` : null,
    candidate.localIpAddress ? `IP local observado: ${candidate.localIpAddress}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    name: candidate.label,
    publicIpv4Cidr: detection.suggestedPublicIpv4Cidr ?? "",
    localIpv4Cidr: candidate.localIpv4Cidr ?? "",
    ssid: candidate.ssid ?? "",
    bssid: candidate.bssid ?? "",
    notes,
  };
}

function buildPlantFormState(plant?: PlantDetails | Plant | null): PlantFormState {
  if (!plant) {
    return emptyPlantForm;
  }

  return {
    id: plant.id,
    code: plant.code,
    name: plant.name,
    city: plant.city,
    state: plant.state,
    openingHour: plant.openingHour,
    closingHour: plant.closingHour,
    qrToken: plant.qrToken,
    requireWifiMatch: String(plant.requireWifiMatch),
    requireSelfie: String(plant.requireSelfie),
    autoCloseLimitHours: String(plant.autoCloseLimitHours),
    lateAlertMinutes: String(plant.lateAlertMinutes),
    geofenceLatitude: plant.geofenceLatitude?.toString() ?? "",
    geofenceLongitude: plant.geofenceLongitude?.toString() ?? "",
    geofenceRadiusMeters: plant.geofenceRadiusMeters?.toString() ?? "",
    authorizedNetworks: serializeNetworks(plant),
  };
}

function buildPlantPayload(form: PlantFormState) {
  return {
    code: form.code.trim() || undefined,
    name: form.name,
    city: form.city,
    state: form.state,
    openingHour: form.openingHour,
    closingHour: form.closingHour,
    qrToken: form.qrToken.trim() || undefined,
    requireWifiMatch: form.requireWifiMatch === "true",
    requireSelfie: form.requireSelfie === "true",
    autoCloseLimitHours: Number.parseInt(form.autoCloseLimitHours, 10),
    lateAlertMinutes: Number.parseInt(form.lateAlertMinutes, 10),
    geofenceLatitude: form.geofenceLatitude ? Number(form.geofenceLatitude) : null,
    geofenceLongitude: form.geofenceLongitude ? Number(form.geofenceLongitude) : null,
    geofenceRadiusMeters: form.geofenceRadiusMeters ? Number(form.geofenceRadiusMeters) : null,
    authorizedNetworks: parseNetworks(form.authorizedNetworks),
  };
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

function buildDetectedLocationState(
  location: {
    latitude: number;
    longitude: number;
    accuracyMeters: number | null;
  },
  form: PlantFormState,
  autoApplied: boolean,
): DetectedLocationState {
  const geofenceLatitude = form.geofenceLatitude ? Number(form.geofenceLatitude) : null;
  const geofenceLongitude = form.geofenceLongitude ? Number(form.geofenceLongitude) : null;
  const geofenceRadiusMeters = form.geofenceRadiusMeters ? Number(form.geofenceRadiusMeters) : null;

  const distanceMeters =
    geofenceLatitude !== null &&
    geofenceLongitude !== null
      ? calculateDistanceMeters(
          geofenceLatitude,
          geofenceLongitude,
          location.latitude,
          location.longitude,
        )
      : null;

  const withinConfiguredGeofence =
    distanceMeters !== null && geofenceRadiusMeters !== null
      ? distanceMeters <= geofenceRadiusMeters
      : null;

  const notes = autoApplied
    ? "Localizacao atual aplicada automaticamente como centro da geofence."
    : geofenceLatitude !== null && geofenceLongitude !== null && geofenceRadiusMeters !== null
      ? withinConfiguredGeofence
        ? "Equipamento dentro do raio configurado para esta usina."
        : "Equipamento fora do raio configurado para esta usina."
      : "Localizacao atual pronta para ser usada como centro da geofence.";

  return {
    latitude: location.latitude,
    longitude: location.longitude,
    accuracyMeters: location.accuracyMeters,
    distanceMeters,
    withinConfiguredGeofence,
    autoApplied,
    notes,
  };
}

function buildOptimisticPlant(
  form: PlantFormState,
  id: string,
  current?: Plant | PlantDetails | null,
): Plant {
  const generatedCode = current?.code ?? (form.code.trim() || `usina-${id.slice(-6)}`);

  return {
    id,
    code: generatedCode,
    name: form.name,
    city: form.city,
    state: form.state,
    timezone: current?.timezone ?? "America/Sao_Paulo",
    openingHour: form.openingHour,
    closingHour: form.closingHour,
    qrToken: current?.qrToken ?? (form.qrToken.trim() || id),
    status: current?.status ?? "ACTIVE",
    requireWifiMatch: form.requireWifiMatch === "true",
    requireSelfie: form.requireSelfie === "true",
    autoCloseLimitHours: Number.parseInt(form.autoCloseLimitHours, 10),
    lateAlertMinutes: Number.parseInt(form.lateAlertMinutes, 10),
    geofenceLatitude: form.geofenceLatitude ? Number(form.geofenceLatitude) : null,
    geofenceLongitude: form.geofenceLongitude ? Number(form.geofenceLongitude) : null,
    geofenceRadiusMeters: form.geofenceRadiusMeters ? Number(form.geofenceRadiusMeters) : null,
    authorizedNetworks: parseNetworks(form.authorizedNetworks),
    _count: current?._count ?? {
      people: 0,
      timeEntries: 0,
    },
  };
}

interface PlantsStore {
  plants: Plant[];
  selectedPlantId: string | null;
  selectedPlant: PlantDetails | null;
  form: PlantFormState;
  detectedNetwork: DetectedNetworkState | null;
  selectedDetectedCandidateId: string | null;
  detectedLocation: DetectedLocationState | null;
  feedback: string | null;
  loadingList: boolean;
  loadingDetail: boolean;
  saving: boolean;
  detectingNetwork: boolean;
  detectingLocation: boolean;
  loadPlants: (filters: { search?: string; status?: string }) => Promise<void>;
  loadPlant: (plantId: string | null) => Promise<void>;
  setSelectedPlantId: (plantId: string | null) => void;
  setFormValue: <K extends keyof PlantFormState>(key: K, value: PlantFormState[K]) => void;
  updateAuthorizedNetwork: (
    index: number,
    key: keyof PlantAuthorizedNetworkForm,
    value: string,
  ) => void;
  appendAuthorizedNetwork: (network?: Partial<PlantAuthorizedNetworkForm>) => void;
  removeAuthorizedNetwork: (index: number) => void;
  detectCurrentNetwork: (options?: { notify?: boolean }) => Promise<void>;
  setSelectedDetectedCandidateId: (candidateId: string | null) => void;
  applyDetectedNetwork: () => void;
  detectCurrentLocation: (options?: { notify?: boolean }) => Promise<void>;
  applyDetectedLocation: () => void;
  resetForm: () => void;
  clearFeedback: () => void;
  savePlant: () => Promise<string | null>;
}

export const usePlantsStore = create<PlantsStore>((set, get) => ({
  plants: [],
  selectedPlantId: null,
  selectedPlant: null,
  form: emptyPlantForm,
  detectedNetwork: null,
  selectedDetectedCandidateId: null,
  detectedLocation: null,
  feedback: null,
  loadingList: false,
  loadingDetail: false,
  saving: false,
  detectingNetwork: false,
  detectingLocation: false,
  async loadPlants(filters) {
    set({ loadingList: true, feedback: null });

    try {
      const plants = await fetchPlants(filters);
      set({ plants, loadingList: false });
    } catch (error) {
      const message = resolveErrorMessage(error, "Nao foi possivel carregar as usinas.");
      set({
        loadingList: false,
        feedback: message,
      });
      showErrorToast("Falha ao carregar usinas", message);
    }
  },
  async loadPlant(plantId) {
    if (!plantId) {
      set({
        selectedPlantId: null,
        selectedPlant: null,
        form: emptyPlantForm,
        detectedNetwork: null,
        selectedDetectedCandidateId: null,
        detectedLocation: null,
      });
      return;
    }

    set({ loadingDetail: true, selectedPlantId: plantId, feedback: null });

    try {
      const selectedPlant = await fetchPlant(plantId);
      set({
        selectedPlant,
        form: buildPlantFormState(selectedPlant),
        loadingDetail: false,
        detectedNetwork: null,
        selectedDetectedCandidateId: null,
        detectedLocation: null,
      });
    } catch (error) {
      const message = resolveErrorMessage(error, "Nao foi possivel carregar a usina.");
      set({
        loadingDetail: false,
        feedback: message,
      });
      showErrorToast("Falha ao carregar usina", message);
    }
  },
  setSelectedPlantId(selectedPlantId) {
    set({ selectedPlantId });
  },
  setFormValue(key, value) {
    set((state) => ({
      form: {
        ...state.form,
        [key]: value,
      },
    }));
  },
  updateAuthorizedNetwork(index, key, value) {
    set((state) => ({
      form: {
        ...state.form,
        authorizedNetworks: state.form.authorizedNetworks.map((network, networkIndex) =>
          networkIndex === index
            ? {
                ...network,
                [key]: value,
              }
            : network,
        ),
      },
    }));
  },
  appendAuthorizedNetwork(network) {
    set((state) => ({
      form: {
        ...state.form,
        authorizedNetworks: [
          ...state.form.authorizedNetworks,
          {
            ...emptyAuthorizedNetwork(),
            ...network,
          },
        ],
      },
    }));
  },
  removeAuthorizedNetwork(index) {
    set((state) => ({
      form: {
        ...state.form,
        authorizedNetworks: state.form.authorizedNetworks.filter(
          (_network, networkIndex) => networkIndex !== index,
        ),
      },
    }));
  },
  async detectCurrentNetwork(options) {
    set({
      detectingNetwork: true,
      feedback: "Detectando a conexao atual...",
    });

    const toastId = options?.notify
      ? showLoadingToast(
          "Detectando rede atual",
          "Lendo a conexao ativa deste equipamento.",
        )
      : null;

    try {
      const hostnameCandidate = readBrowserHostnameIpv4Candidate();
      const browserIpCandidates = Array.from(
        new Set(
          [
            ...(await detectBrowserLocalIpv4Candidates()),
            hostnameCandidate,
          ].filter((value): value is string => !!value),
        ),
      );
      const connectionProfile = readBrowserConnectionProfile();
      const detection = await detectCurrentPlantNetwork({
        browserIpCandidates,
        browserConnectionType: connectionProfile.type,
      });
      set((state) => {
        const selectedDetectedCandidateId =
          detection.selectedCandidateId ?? detection.localCandidates[0]?.id ?? null;
        const selectedCandidate =
          detection.localCandidates.find((candidate) => candidate.id === selectedDetectedCandidateId) ??
          detection.localCandidates[0] ??
          null;
        const legacyPlaceholderIndex = state.form.authorizedNetworks.findIndex(
          isLegacyDetectedPlaceholder,
        );
        const autoManagedIndex =
          legacyPlaceholderIndex >= 0
            ? legacyPlaceholderIndex
            : state.form.authorizedNetworks.findIndex(isAutoDetectedManagedNetwork);
        const nextNetwork =
          detection.suggestedPublicIpv4Cidr ||
          selectedCandidate?.localIpv4Cidr ||
          selectedCandidate?.ssid ||
          selectedCandidate?.bssid
            ? buildDetectedNetworkForm(
                detection,
                selectedCandidate ?? {
                  label: detection.observedPublicIp
                    ? `Saida publica ${detection.observedPublicIp}`
                    : "Ambiente detectado",
                },
                detection.notes,
              )
            : null;

        const shouldAutoApply =
          !!nextNetwork &&
          (state.form.authorizedNetworks.length === 0 || autoManagedIndex >= 0);

        const authorizedNetworks =
          !shouldAutoApply || !nextNetwork
            ? state.form.authorizedNetworks
            : state.form.authorizedNetworks.length === 0
              ? [nextNetwork]
              : state.form.authorizedNetworks.map((network, index) =>
                  index === autoManagedIndex ? nextNetwork : network,
                );

        return {
          detectingNetwork: false,
          detectedNetwork: detection,
          selectedDetectedCandidateId,
          form: shouldAutoApply
            ? {
                ...state.form,
                authorizedNetworks,
              }
            : state.form,
          feedback: detection.localCandidates.length || detection.observedPublicIp
            ? shouldAutoApply
              ? "Ambiente de rede atual detectado e aplicado automaticamente na usina."
              : "Ambiente de rede atual detectado automaticamente para conferencia."
            : detection.notes,
        };
      });
      if (options?.notify) {
        const detection = get().detectedNetwork;
        const selectedCandidate =
          detection?.localCandidates.find(
            (candidate) => candidate.id === get().selectedDetectedCandidateId,
          ) ??
          detection?.localCandidates[0] ??
          null;
        const description =
          selectedCandidate?.label ??
          detection?.notes ??
          "O ambiente de rede atual foi verificado.";

        showSuccessToast("Ambiente atual detectado", description, {
          id: toastId ?? undefined,
        });
      }
    } catch (error) {
      const message = resolveErrorMessage(error, "Nao foi possivel detectar a rede atual.");
      set({
        detectingNetwork: false,
        feedback: message,
      });
      if (options?.notify) {
        showErrorToast("Falha ao detectar rede", message, {
          id: toastId ?? undefined,
        });
      }
    }
  },
  setSelectedDetectedCandidateId(selectedDetectedCandidateId) {
    set({ selectedDetectedCandidateId });
  },
  applyDetectedNetwork() {
    const { detectedNetwork, selectedDetectedCandidateId } = get();

    if (!detectedNetwork) {
      set({ feedback: "Detecte a conexao atual antes de adicionar a rede." });
      showWarningToast(
        "Detecte a rede primeiro",
        "Atualize a deteccao antes de aplicar a configuracao.",
      );
      return;
    }

    const selectedCandidate =
      detectedNetwork.localCandidates.find((candidate) => candidate.id === selectedDetectedCandidateId) ??
      detectedNetwork.localCandidates.find((candidate) => candidate.isCurrent) ??
      detectedNetwork.localCandidates[0] ??
      null;

    if (!selectedCandidate && !detectedNetwork.suggestedPublicIpv4Cidr) {
      set({ feedback: "Nenhum ambiente de rede utilizavel foi detectado para este equipamento." });
      showWarningToast(
        "Nenhum ambiente valido",
        "O equipamento nao informou sinais suficientes de rede para aplicacao automatica.",
      );
      return;
    }

    if (
      !detectedNetwork.suggestedPublicIpv4Cidr &&
      !selectedCandidate?.localIpv4Cidr &&
      !selectedCandidate?.ssid &&
      !selectedCandidate?.bssid
    ) {
      set({
        feedback:
          "A deteccao atual nao trouxe IP publico, LAN local ou identidade Wi-Fi suficiente para salvar o ambiente.",
      });
      showWarningToast(
        "Ambiente sem identificacao suficiente",
        "A deteccao precisa informar IP publico, LAN local ou identidade Wi-Fi para ser salva.",
      );
      return;
    }

    set((state) => {
      const nextNetwork = buildDetectedNetworkForm(
        detectedNetwork,
        selectedCandidate ?? {
          label: detectedNetwork.observedPublicIp
            ? `Saida publica ${detectedNetwork.observedPublicIp}`
            : "Ambiente detectado",
        },
        detectedNetwork.notes,
      );

      const alreadyExists = state.form.authorizedNetworks.some(
        (network) =>
          (network.publicIpv4Cidr.trim() !== "" &&
            network.publicIpv4Cidr.trim() === nextNetwork.publicIpv4Cidr.trim()) ||
          (network.localIpv4Cidr.trim() !== "" &&
            network.localIpv4Cidr.trim() === nextNetwork.localIpv4Cidr.trim()),
      );
      const legacyPlaceholderIndex = state.form.authorizedNetworks.findIndex(
        isLegacyDetectedPlaceholder,
      );

      const authorizedNetworks = alreadyExists
        ? state.form.authorizedNetworks
        : legacyPlaceholderIndex >= 0
          ? state.form.authorizedNetworks.map((network, index) =>
              index === legacyPlaceholderIndex ? nextNetwork : network,
            )
          : [...state.form.authorizedNetworks, nextNetwork];

      return {
        form: {
          ...state.form,
          authorizedNetworks,
        },
        feedback: alreadyExists
          ? "O ambiente atual ja esta na lista de redes autorizadas."
          : legacyPlaceholderIndex >= 0
            ? "Ambiente detectado aplicado no lugar do cadastro antigo incompleto."
            : "Ambiente selecionado adicionado a usina.",
      };
    });
    const appliedCandidate = detectedNetwork.localCandidates.find(
      (candidate) => candidate.id === selectedDetectedCandidateId,
    );
    const appliedName =
      appliedCandidate?.label ??
      (detectedNetwork.observedPublicIp
        ? `Saida publica ${detectedNetwork.observedPublicIp}`
        : "Ambiente atual");

    if (
      get().feedback === "O ambiente atual ja esta na lista de redes autorizadas."
    ) {
      showInfoToast("Ambiente ja cadastrado", `${appliedName} ja estava autorizado.`);
      return;
    }

    showSuccessToast("Ambiente aplicado", `${appliedName} foi adicionado a usina.`);
  },
  async detectCurrentLocation(options) {
    set({
      detectingLocation: true,
      feedback: "Detectando a localizacao atual...",
    });

    const toastId = options?.notify
      ? showLoadingToast(
          "Capturando localizacao",
          "Obtendo a posicao atual deste equipamento.",
        )
      : null;

    try {
      const location = await captureBrowserLocation();

      if (!location) {
        set({
          detectingLocation: false,
          detectedLocation: null,
          feedback: "Nao foi possivel capturar a localizacao atual do equipamento.",
        });
        if (options?.notify) {
          showWarningToast(
            "Localizacao indisponivel",
            "O navegador nao retornou uma posicao valida.",
            { id: toastId ?? undefined },
          );
        }
        return;
      }

      set((state) => {
        const shouldAutoApplyCenter =
          state.form.geofenceLatitude.trim() === "" &&
          state.form.geofenceLongitude.trim() === "";
        const nextForm = shouldAutoApplyCenter
          ? {
              ...state.form,
              geofenceLatitude: location.latitude.toString(),
              geofenceLongitude: location.longitude.toString(),
              geofenceRadiusMeters: state.form.geofenceRadiusMeters || "100",
            }
          : state.form;
        const detectedLocation = buildDetectedLocationState(
          location,
          nextForm,
          shouldAutoApplyCenter,
        );

        return {
          detectingLocation: false,
          detectedLocation,
          form: nextForm,
          feedback: detectedLocation.notes,
        };
      });
      if (options?.notify) {
        const detectedLocation = get().detectedLocation;
        const description = detectedLocation
          ? `${detectedLocation.latitude.toFixed(6)}, ${detectedLocation.longitude.toFixed(6)}`
          : "Posicao atual capturada.";
        showSuccessToast("Localizacao atualizada", description, {
          id: toastId ?? undefined,
        });
      }
    } catch (error) {
      const message = resolveErrorMessage(error, "Nao foi possivel detectar a localizacao atual.");
      set({
        detectingLocation: false,
        feedback: message,
      });
      if (options?.notify) {
        showErrorToast("Falha ao capturar localizacao", message, {
          id: toastId ?? undefined,
        });
      }
    }
  },
  applyDetectedLocation() {
    const { detectedLocation } = get();

    if (!detectedLocation) {
      set({ feedback: "Detecte a localizacao atual antes de aplicar a geofence." });
      showWarningToast(
        "Detecte a localizacao primeiro",
        "Capture a posicao atual antes de atualizar a geofence.",
      );
      return;
    }

    set((state) => ({
      form: {
        ...state.form,
        geofenceLatitude: detectedLocation.latitude.toString(),
        geofenceLongitude: detectedLocation.longitude.toString(),
        geofenceRadiusMeters: state.form.geofenceRadiusMeters || "100",
      },
      detectedLocation: buildDetectedLocationState(
        detectedLocation,
        {
          ...state.form,
          geofenceLatitude: detectedLocation.latitude.toString(),
          geofenceLongitude: detectedLocation.longitude.toString(),
          geofenceRadiusMeters: state.form.geofenceRadiusMeters || "100",
        },
        true,
      ),
      feedback: "Localizacao atual aplicada na geofence da usina.",
    }));
    showSuccessToast(
      "Geofence atualizada",
      "A localizacao atual foi aplicada como referencia da usina.",
    );
  },
  resetForm() {
    set({
      selectedPlantId: null,
      selectedPlant: null,
      form: emptyPlantForm,
      detectedNetwork: null,
      selectedDetectedCandidateId: null,
      detectedLocation: null,
      feedback: null,
    });
  },
  clearFeedback() {
    set({ feedback: null });
  },
  async savePlant() {
    const { form, plants, selectedPlant } = get();
    const payload = buildPlantPayload(form);
    const optimisticId = form.id ?? createOptimisticId("plant");
    const optimisticPlant = buildOptimisticPlant(form, optimisticId, selectedPlant);
    const previousPlants = plants;
    const previousSelectedPlant = selectedPlant;
    const toastId = showLoadingToast(
      form.id ? "Atualizando usina" : "Criando usina",
      form.id
        ? "Salvando as configuracoes operacionais."
        : "Preparando a nova usina para o painel.",
    );

    set({
      saving: true,
      feedback: form.id ? "Atualizando usina..." : "Criando usina...",
      plants: form.id
        ? plants.map((item) => (item.id === form.id ? optimisticPlant : item))
        : [optimisticPlant, ...plants],
      selectedPlant: {
        ...optimisticPlant,
        presentPeople: previousSelectedPlant?.presentPeople ?? [],
        history: previousSelectedPlant?.history ?? [],
      },
      selectedPlantId: optimisticId,
      form: {
        ...form,
        id: optimisticId,
      },
    });

    try {
      const savedPlant = form.id
        ? await updatePlant(form.id, payload)
        : await createPlant(payload as never);

      set((state) => ({
        saving: false,
        feedback: "Usina salva com sucesso.",
        plants: state.plants.map((item) => (item.id === optimisticId ? savedPlant : item)),
        selectedPlantId: savedPlant.id,
        selectedPlant:
          state.selectedPlant?.id === optimisticId
            ? {
                ...state.selectedPlant,
                ...savedPlant,
              }
            : {
                ...savedPlant,
                presentPeople: [],
                history: [],
              },
        form: buildPlantFormState(savedPlant),
      }));
      showSuccessToast(
        form.id ? "Usina atualizada" : "Usina criada",
        "As configuracoes da usina foram salvas com sucesso.",
        { id: toastId },
      );

      return savedPlant.id;
    } catch (error) {
      const message = resolveErrorMessage(error, "Nao foi possivel salvar a usina.");
      set({
        saving: false,
        plants: previousPlants,
        selectedPlant: previousSelectedPlant,
        selectedPlantId: previousSelectedPlant?.id ?? null,
        form: buildPlantFormState(previousSelectedPlant),
        feedback: message,
      });
      showErrorToast("Falha ao salvar usina", message, { id: toastId });

      return null;
    }
  },
}));
