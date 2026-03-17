"use client";

import { create } from "zustand";
import { fetchPublicPlant, type Plant } from "@/lib/api/plants";
import {
  captureBrowserLocation,
  detectBrowserLocalIpv4Candidates,
  readBrowserConnectionProfile,
} from "@/lib/network/local-network";
import {
  adaptAccessSubjectForm,
  seedAccessSubjectForm,
  type AccessSubjectFormFields,
} from "@/lib/access-subject-policy";
import {
  fetchAccessIntake,
  fetchAccessNetworkStatus,
  registerAccessEntry,
  registerAccessExit,
  type AccessIntakeContext,
  type AccessNetworkStatus,
  type TimeEntryRecord,
} from "@/lib/api/time-entries";
import {
  showErrorToast,
  showInfoToast,
  showLoadingToast,
  showSuccessToast,
  showWarningToast,
} from "@/lib/toast";
import { resolveAccessMode } from "@/modules/register/access-intake";
import { resolveErrorMessage } from "@/store/store-utils";

function digitsOnly(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function buildFeedbackMessage(
  intake: AccessIntakeContext,
  currentPlant?: { id?: string | null; name?: string | null } | null,
) {
  const accessMode = resolveAccessMode(intake, currentPlant);

  if (intake.blockedReason) {
    return intake.blockedReason;
  }

  if (accessMode === "EXIT") {
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

function createEmptyRegisterForm(): RegisterFormState {
  const subject = seedAccessSubjectForm("VISITOR");

  return {
    cpf: "",
    personType: subject.personType,
    fullName: subject.fullName,
    employer: subject.employer,
    jobTitle: subject.jobTitle,
    selfieUrl: "",
  };
}

function extractSubjectReference(source?: Partial<AccessSubjectFormFields> | null) {
  return {
    personType: source?.personType,
    fullName: source?.fullName ?? "",
    employer: source?.employer ?? "",
    jobTitle: source?.jobTitle ?? "",
  };
}

function buildRegisterFormState(
  personType?: string | null,
  reference?: Partial<AccessSubjectFormFields> | null,
  current?: Partial<RegisterFormState> | null,
): RegisterFormState {
  const subject = seedAccessSubjectForm(personType, reference);

  return {
    cpf: current?.cpf ?? "",
    personType: subject.personType,
    fullName: subject.fullName,
    employer: subject.employer,
    jobTitle: subject.jobTitle,
    selfieUrl: current?.selfieUrl ?? "",
  };
}

export const emptyRegisterForm: RegisterFormState = createEmptyRegisterForm();

export interface RegisterLocationState {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
}

export interface RegisterReceipt {
  mode: "ENTRY" | "EXIT";
  entry: TimeEntryRecord;
  completedAt: string;
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

function shouldCapturePlantLocation(plant?: Plant | null) {
  return Boolean(
    plant?.geofenceLatitude !== null &&
      plant?.geofenceLatitude !== undefined &&
      plant?.geofenceLongitude !== null &&
      plant?.geofenceLongitude !== undefined &&
      plant?.geofenceRadiusMeters !== null &&
      plant?.geofenceRadiusMeters !== undefined,
  );
}

interface RegisterStore {
  plant: Plant | null;
  networkStatus: AccessNetworkStatus["network"] | null;
  locationStatus: AccessNetworkStatus["location"] | null;
  intake: AccessIntakeContext | null;
  receipt: RegisterReceipt | null;
  form: RegisterFormState;
  location: RegisterLocationState | null;
  browserIpCandidates: string[];
  feedback: string | null;
  loadingPlant: boolean;
  checkingNetwork: boolean;
  locating: boolean;
  checkingCpf: boolean;
  submitting: boolean;
  loadPlant: (plantToken: string) => Promise<void>;
  refreshNetworkStatus: (
    plantToken: string,
    options?: { captureLocation?: boolean; notify?: boolean },
  ) => Promise<void>;
  setCpf: (value: string) => void;
  setPersonType: (value: string) => void;
  setFormValue: <K extends keyof RegisterFormState>(key: K, value: RegisterFormState[K]) => void;
  setLocation: (location: RegisterLocationState | null) => void;
  clearFeedback: () => void;
  clearReceipt: () => void;
  resetForm: () => void;
  lookupAccess: (plantToken: string) => Promise<void>;
  submit: (payload: {
    plantToken: string;
    deviceLabel: string;
  }) => Promise<void>;
}

export const useRegisterStore = create<RegisterStore>((set, get) => ({
  plant: null,
  networkStatus: null,
  locationStatus: null,
  intake: null,
  receipt: null,
  form: emptyRegisterForm,
  location: null,
  browserIpCandidates: [],
  feedback: null,
  loadingPlant: false,
  checkingNetwork: false,
  locating: false,
  checkingCpf: false,
  submitting: false,
  async loadPlant(plantToken) {
    set({ loadingPlant: true, checkingNetwork: true, feedback: null });

    try {
      const plant = await fetchPublicPlant(plantToken);
      const shouldCaptureLocation = shouldCapturePlantLocation(plant);
      set({ locating: shouldCaptureLocation });
      const environment = await readRegisterEnvironment({
        captureLocation: shouldCaptureLocation,
      });
      const networkStatusResult = await fetchAccessNetworkStatus({
        plantToken,
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
      const message = resolveErrorMessage(error, "Nao foi possivel carregar a usina.");
      set({
        loadingPlant: false,
        checkingNetwork: false,
        locating: false,
        feedback: message,
      });
      showErrorToast("Falha ao carregar usina", message);
    }
  },
  async refreshNetworkStatus(plantToken, options) {
    const plant = get().plant;
    const shouldCaptureLocation = options?.captureLocation ?? shouldCapturePlantLocation(plant);

    set({
      checkingNetwork: true,
      locating: shouldCaptureLocation,
    });

    const toastId = options?.notify
      ? showLoadingToast(
          "Atualizando ambiente",
          "Verificando rede e localizacao do dispositivo.",
        )
      : null;

    try {
      const environment = await readRegisterEnvironment({
        captureLocation: shouldCaptureLocation,
        fallbackLocation: get().location,
      });
      const networkStatus = await fetchAccessNetworkStatus({
        plantToken,
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
      if (options?.notify) {
        const networkMessage = networkStatus.location?.status === "BLOCKED"
          ? networkStatus.location.message
          : networkStatus.network.message;
        const isBlocked =
          networkStatus.network.status === "BLOCKED" ||
          networkStatus.location?.status === "BLOCKED" ||
          networkStatus.location?.status === "PENDING";

        if (isBlocked) {
          showWarningToast("Ambiente ainda nao autorizado", networkMessage, {
            id: toastId ?? undefined,
          });
        } else {
          showSuccessToast("Ambiente validado", networkMessage, {
            id: toastId ?? undefined,
          });
        }
      }
    } catch (error) {
      const message = resolveErrorMessage(error, "Nao foi possivel verificar a rede atual.");
      set({
        checkingNetwork: false,
        locating: false,
        feedback: message,
      });
      if (options?.notify) {
        showErrorToast("Falha ao validar ambiente", message, {
          id: toastId ?? undefined,
        });
      }
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
      receipt: state.form.cpf === cpf ? state.receipt : null,
      feedback: state.form.cpf === cpf ? state.feedback : null,
    }));
  },
  setPersonType(personType) {
    set((state) => {
      const nextSubject = adaptAccessSubjectForm(
        personType,
        {
          personType: state.form.personType,
          fullName: state.form.fullName,
          employer: state.form.employer,
          jobTitle: state.form.jobTitle,
        },
        extractSubjectReference(state.intake?.person),
      );

      return {
        form: {
          ...state.form,
          personType: nextSubject.personType,
          fullName: nextSubject.fullName,
          employer: nextSubject.employer,
          jobTitle: nextSubject.jobTitle,
        },
        feedback: state.intake?.blockedReason ?? state.feedback,
      };
    });
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
  clearReceipt() {
    set({ receipt: null });
  },
  resetForm() {
    set((state) => ({
      intake: null,
      receipt: null,
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
  async lookupAccess(plantToken) {
    const cpf = digitsOnly(get().form.cpf);

    if (cpf.length !== 11) {
      set({
        feedback: "Informe um CPF valido para continuar.",
      });
      showWarningToast("CPF invalido", "Informe um CPF com 11 digitos para continuar.");
      return;
    }

    const toastId = showLoadingToast(
      "Consultando acesso",
      "Buscando cadastro e registros em aberto para este CPF.",
    );

    set({
      checkingCpf: true,
      receipt: null,
      feedback: "Consultando cadastro e acessos em aberto...",
    });

    try {
      const intake = await fetchAccessIntake({
        cpf,
        plantToken,
      });

      set((state) => ({
        checkingCpf: false,
        intake,
        form: buildRegisterFormState(
          intake.person?.personType ?? state.form.personType ?? "VISITOR",
          extractSubjectReference(intake.person),
          {
            cpf,
            selfieUrl: state.form.selfieUrl,
          },
        ),
        feedback: buildFeedbackMessage(intake, {
          id: get().plant?.id ?? null,
          name: get().plant?.name ?? null,
        }),
      }));
      if (intake.blockedReason) {
        showWarningToast("Acesso bloqueado", intake.blockedReason, {
          id: toastId,
        });
        return;
      }

      if (resolveAccessMode(intake, {
        id: get().plant?.id ?? null,
        name: get().plant?.name ?? null,
      }) === "EXIT") {
        showInfoToast(
          "Saida em aberto encontrada",
          "Confirme a saida para encerrar o acesso.",
          { id: toastId },
        );
        return;
      }

      if (intake.person) {
        showSuccessToast(
          "Pessoa identificada",
          "Revise os dados e conclua o registro.",
          { id: toastId },
        );
        return;
      }

      showInfoToast(
        "Primeiro acesso localizado",
        "Preencha os dados obrigatorios para concluir a entrada.",
        { id: toastId },
      );
    } catch (error) {
      const message = resolveErrorMessage(error, "Nao foi possivel consultar o acesso.");
      set({
        checkingCpf: false,
        intake: null,
        feedback: message,
      });
      showErrorToast("Falha ao consultar acesso", message, { id: toastId });
    }
  },
  async submit(payload) {
    const { form, intake, location } = get();

    if (!intake) {
      set({
        feedback: "Confirme o CPF antes de registrar o acesso.",
      });
      showWarningToast("Confirme o CPF", "Consulte o CPF antes de concluir o acesso.");
      return;
    }

    if (intake.suggestedMode === "BLOCKED") {
      set({
        feedback: intake.blockedReason ?? "Existe um acesso em aberto em outra usina.",
      });
      showWarningToast(
        "Acesso bloqueado",
        intake.blockedReason ?? "Existe um acesso em aberto em outra usina.",
      );
      return;
    }

    const isExit =
      resolveAccessMode(intake, {
        id: get().plant?.id ?? null,
        name: get().plant?.name ?? null,
      }) === "EXIT";
    const toastId = showLoadingToast(
      isExit ? "Registrando saida" : "Registrando entrada",
      isExit
        ? "Encerrando o acesso em aberto."
        : "Criando o novo registro de acesso.",
    );

    set({
      submitting: true,
      receipt: null,
      feedback: isExit ? "Registrando saida..." : "Registrando entrada...",
    });

    try {
      const environment = await readRegisterEnvironment({
        captureLocation: false,
        fallbackLocation: location,
      });
      const basePayload = {
        cpf: digitsOnly(form.cpf),
        plantToken: payload.plantToken,
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
            fullName: form.fullName || undefined,
            employer: form.employer || undefined,
            jobTitle: form.jobTitle || undefined,
            personType: form.personType,
          });

      set({
        submitting: false,
        intake: null,
        receipt: {
          mode: isExit ? "EXIT" : "ENTRY",
          entry: result,
          completedAt: new Date().toISOString(),
        },
        form: emptyRegisterForm,
        feedback: null,
      });
      showSuccessToast(
        isExit ? "Saida registrada" : "Entrada registrada",
        `${result.person.fullName} teve o acesso ${isExit ? "encerrado" : "iniciado"} com sucesso.`,
        { id: toastId },
      );
    } catch (error) {
      const message = resolveErrorMessage(error, "Falha ao registrar acesso.");
      set({
        submitting: false,
        feedback: message,
      });
      showErrorToast("Falha ao registrar acesso", message, { id: toastId });
    }
  },
}));
