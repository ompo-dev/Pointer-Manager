"use client";

import { create } from "zustand";
import { fetchPublicPlantById, type Plant } from "@/lib/api/plants";
import {
  captureBrowserLocation,
  detectBrowserLocalIpv4Candidates,
  readBrowserConnectionProfile,
} from "@/lib/network/local-network";
import {
  fetchAccessIntake,
  fetchAccessNetworkStatus,
  registerAccessEntry,
  registerAccessExit,
  type AccessIntakeContext,
  type AccessNetworkStatus,
} from "@/lib/api/time-entries";
import { resolveErrorMessage } from "@/store/store-utils";

function digitsOnly(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function buildFeedbackMessage(intake: AccessIntakeContext) {
  if (intake.blockedReason) {
    return intake.blockedReason;
  }

  if (intake.suggestedMode === "EXIT") {
    return "Acesso em aberto encontrado. Confirme a saida para encerrar o registro.";
  }

  if (intake.person) {
    return "Pessoa identificada. Revise os dados e conclua a entrada.";
  }

  return "Primeiro acesso. Informe apenas os dados obrigatorios para este perfil.";
}

export interface RegisterFormState {
  cpf: string;
  personType: string;
  fullName: string;
  employer: string;
  jobTitle: string;
  selfieUrl: string;
}

export const emptyRegisterForm: RegisterFormState = {
  cpf: "",
  personType: "VISITOR",
  fullName: "",
  employer: "",
  jobTitle: "",
  selfieUrl: "",
};

export interface RegisterLocationState {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
}

async function readRegisterEnvironment(options?: {
  captureLocation?: boolean;
  fallbackLocation?: RegisterLocationState | null;
}) {
  const connectionProfile = readBrowserConnectionProfile();
  const [browserIpCandidates, detectedLocation] = await Promise.all([
    detectBrowserLocalIpv4Candidates().catch(() => []),
    options?.captureLocation
      ? captureBrowserLocation()
      : Promise.resolve(options?.fallbackLocation ?? null),
  ]);

  return {
    connectionProfile,
    browserIpCandidates,
    location: detectedLocation,
  };
}

interface RegisterStore {
  plant: Plant | null;
  networkStatus: AccessNetworkStatus["network"] | null;
  locationStatus: AccessNetworkStatus["location"] | null;
  intake: AccessIntakeContext | null;
  form: RegisterFormState;
  location: RegisterLocationState | null;
  browserIpCandidates: string[];
  feedback: string | null;
  loadingPlant: boolean;
  checkingNetwork: boolean;
  locating: boolean;
  checkingCpf: boolean;
  submitting: boolean;
  loadPlant: (plantId: string) => Promise<void>;
  refreshNetworkStatus: (
    plantId: string,
    options?: { captureLocation?: boolean },
  ) => Promise<void>;
  setCpf: (value: string) => void;
  setPersonType: (value: string) => void;
  setFormValue: <K extends keyof RegisterFormState>(key: K, value: RegisterFormState[K]) => void;
  setLocation: (location: RegisterLocationState | null) => void;
  clearFeedback: () => void;
  resetForm: () => void;
  lookupAccess: (plantId: string) => Promise<void>;
  submit: (payload: {
    plantId: string;
    deviceLabel: string;
  }) => Promise<void>;
}

export const useRegisterStore = create<RegisterStore>((set, get) => ({
  plant: null,
  networkStatus: null,
  locationStatus: null,
  intake: null,
  form: emptyRegisterForm,
  location: null,
  browserIpCandidates: [],
  feedback: null,
  loadingPlant: false,
  checkingNetwork: false,
  locating: false,
  checkingCpf: false,
  submitting: false,
  async loadPlant(plantId) {
    set({ loadingPlant: true, checkingNetwork: true, feedback: null });

    try {
      const plant = await fetchPublicPlantById(plantId);
      const shouldCaptureLocation =
        plant.geofenceLatitude !== null &&
        plant.geofenceLatitude !== undefined &&
        plant.geofenceLongitude !== null &&
        plant.geofenceLongitude !== undefined &&
        plant.geofenceRadiusMeters !== null &&
        plant.geofenceRadiusMeters !== undefined;
      set({ locating: shouldCaptureLocation });
      const environment = await readRegisterEnvironment({
        captureLocation: shouldCaptureLocation,
      });
      const networkStatusResult = await fetchAccessNetworkStatus({
        plantId,
        geoLatitude: environment.location?.latitude,
        geoLongitude: environment.location?.longitude,
        browserIpCandidates: environment.browserIpCandidates,
        networkType: environment.connectionProfile.type,
        networkEffectiveType: environment.connectionProfile.effectiveType,
      }).catch(() => null);

      set({
        plant,
        networkStatus: networkStatusResult?.network ?? null,
        locationStatus: networkStatusResult?.location ?? null,
        location: environment.location,
        browserIpCandidates: environment.browserIpCandidates,
        loadingPlant: false,
        checkingNetwork: false,
        locating: false,
      });
    } catch (error) {
      set({
        loadingPlant: false,
        checkingNetwork: false,
        locating: false,
        feedback: resolveErrorMessage(error, "Nao foi possivel carregar a usina."),
      });
    }
  },
  async refreshNetworkStatus(plantId, options) {
    const plant = get().plant;
    const shouldCaptureLocation =
      options?.captureLocation ??
      Boolean(
        plant?.geofenceLatitude !== null &&
          plant?.geofenceLatitude !== undefined &&
          plant?.geofenceLongitude !== null &&
          plant?.geofenceLongitude !== undefined &&
          plant?.geofenceRadiusMeters !== null &&
          plant?.geofenceRadiusMeters !== undefined,
      );

    set({
      checkingNetwork: true,
      locating: shouldCaptureLocation,
    });

    try {
      const environment = await readRegisterEnvironment({
        captureLocation: shouldCaptureLocation,
        fallbackLocation: get().location,
      });
      const networkStatus = await fetchAccessNetworkStatus({
        plantId,
        geoLatitude: environment.location?.latitude,
        geoLongitude: environment.location?.longitude,
        browserIpCandidates: environment.browserIpCandidates,
        networkType: environment.connectionProfile.type,
        networkEffectiveType: environment.connectionProfile.effectiveType,
      });

      set({
        checkingNetwork: false,
        locating: false,
        networkStatus: networkStatus.network,
        locationStatus: networkStatus.location,
        location: environment.location ?? null,
        browserIpCandidates: environment.browserIpCandidates,
      });
    } catch (error) {
      set({
        checkingNetwork: false,
        locating: false,
        feedback: resolveErrorMessage(error, "Nao foi possivel verificar a rede atual."),
      });
    }
  },
  setCpf(value) {
    const cpf = digitsOnly(value);

    set((state) => ({
      form: {
        ...state.form,
        cpf,
        selfieUrl: state.form.cpf === cpf ? state.form.selfieUrl : "",
      },
      intake: state.form.cpf === cpf ? state.intake : null,
      feedback: state.form.cpf === cpf ? state.feedback : null,
      location: state.form.cpf === cpf ? state.location : null,
    }));
  },
  setPersonType(personType) {
    set((state) => ({
      form: {
        ...state.form,
        personType,
        fullName: state.intake?.person?.fullName ?? state.form.fullName,
        employer: state.intake?.person ? state.form.employer : "",
        jobTitle: state.intake?.person ? state.form.jobTitle : "",
      },
      feedback: state.intake?.blockedReason ?? state.feedback,
    }));
  },
  setFormValue(key, value) {
    set((state) => ({
      form: {
        ...state.form,
        [key]: value,
      },
    }));
  },
  setLocation(location) {
    set({ location });
  },
  clearFeedback() {
    set({ feedback: null });
  },
  resetForm() {
    set((state) => ({
      intake: null,
      networkStatus: state.networkStatus,
      locationStatus: state.locationStatus,
      form: emptyRegisterForm,
      feedback: null,
      location: state.location,
      browserIpCandidates: state.browserIpCandidates,
      checkingNetwork: false,
      locating: false,
      checkingCpf: false,
      submitting: false,
    }));
  },
  async lookupAccess(plantId) {
    const cpf = digitsOnly(get().form.cpf);

    if (cpf.length !== 11) {
      set({
        feedback: "Informe um CPF valido para continuar.",
      });
      return;
    }

    set({
      checkingCpf: true,
      feedback: "Consultando cadastro e acessos em aberto...",
    });

    try {
      const intake = await fetchAccessIntake({
        cpf,
        plantId,
      });

      set((state) => ({
        checkingCpf: false,
        intake,
        form: {
          cpf,
          personType: intake.person?.personType ?? state.form.personType ?? "VISITOR",
          fullName: intake.person?.fullName ?? "",
          employer: intake.person ? intake.person.employer : "",
          jobTitle: intake.person ? intake.person.jobTitle : "",
          selfieUrl: state.form.selfieUrl,
        },
        feedback: buildFeedbackMessage(intake),
      }));
    } catch (error) {
      set({
        checkingCpf: false,
        intake: null,
        feedback: resolveErrorMessage(error, "Nao foi possivel consultar o acesso."),
      });
    }
  },
  async submit(payload) {
    const { form, intake, location } = get();

    if (!intake) {
      set({
        feedback: "Confirme o CPF antes de registrar o acesso.",
      });
      return;
    }

    if (intake.suggestedMode === "BLOCKED") {
      set({
        feedback: intake.blockedReason ?? "Existe um acesso em aberto em outra usina.",
      });
      return;
    }

    const isExit = intake.suggestedMode === "EXIT";

    set({
      submitting: true,
      feedback: isExit ? "Registrando saida..." : "Registrando entrada...",
    });

    try {
      const environment = await readRegisterEnvironment({
        captureLocation: false,
        fallbackLocation: location,
      });
      const basePayload = {
        cpf: digitsOnly(form.cpf),
        plantId: payload.plantId,
        deviceLabel: payload.deviceLabel,
        selfieUrl: form.selfieUrl || undefined,
        geoLatitude: environment.location?.latitude,
        geoLongitude: environment.location?.longitude,
        browserIpCandidates: environment.browserIpCandidates,
        networkType: environment.connectionProfile.type,
        networkEffectiveType: environment.connectionProfile.effectiveType,
      };

      const result = isExit
        ? await registerAccessExit(basePayload)
        : await registerAccessEntry({
            ...basePayload,
            ...(intake.person
              ? {}
              : {
                  fullName: form.fullName || undefined,
                  employer: form.employer || undefined,
                  jobTitle: form.jobTitle || undefined,
                  personType: form.personType,
                }),
          });

      set({
        submitting: false,
        intake: null,
        location: null,
        form: emptyRegisterForm,
        feedback: isExit
          ? `Saida registrada para ${result.employee.fullName}.`
          : `Entrada registrada para ${result.employee.fullName}.`,
      });
    } catch (error) {
      set({
        submitting: false,
        feedback: resolveErrorMessage(error, "Falha ao registrar acesso."),
      });
    }
  },
}));
