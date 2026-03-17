"use client";

import { create } from "zustand";
import { fetchPlants, type Plant } from "@/lib/api/plants";
import {
  fetchLiveTimeEntries,
  manualCloseEntry,
  type TimeEntryRecord,
} from "@/lib/api/time-entries";
import {
  showErrorToast,
  showLoadingToast,
  showSuccessToast,
  showWarningToast,
} from "@/lib/toast";
import { resolveErrorMessage } from "@/store/store-utils";

interface ActiveAccessStore {
  entries: TimeEntryRecord[];
  plantOptions: Plant[];
  loading: boolean;
  loadingPlantOptions: boolean;
  closingEntryId: string | null;
  feedback: string | null;
  loadEntries: (plantId?: string) => Promise<void>;
  loadPlantOptions: () => Promise<void>;
  closeEntry: (entryId: string) => Promise<void>;
  clearFeedback: () => void;
}

export const useActiveAccessStore = create<ActiveAccessStore>((set, get) => ({
  entries: [],
  plantOptions: [],
  loading: false,
  loadingPlantOptions: false,
  closingEntryId: null,
  feedback: null,
  async loadEntries(plantId) {
    set({ loading: true, feedback: null });

    try {
      const entries = await fetchLiveTimeEntries(plantId);
      set({ entries, loading: false });
    } catch (error) {
      set({
        loading: false,
        feedback: resolveErrorMessage(error, "Nao foi possivel carregar os acessos ativos."),
      });
    }
  },
  async loadPlantOptions() {
    set({ loadingPlantOptions: true, feedback: null });

    try {
      const plantOptions = await fetchPlants();
      set({ plantOptions, loadingPlantOptions: false });
    } catch (error) {
      const message = resolveErrorMessage(error, "Nao foi possivel carregar as usinas.");
      set({
        loadingPlantOptions: false,
        feedback: message,
      });
      showErrorToast("Falha ao carregar usinas", message);
    }
  },
  async closeEntry(entryId) {
    const target = get().entries.find((entry) => entry.id === entryId);

    if (!target) {
      set({ feedback: "Registro ativo nao encontrado." });
      showWarningToast("Registro nao encontrado", "Atualize a tabela e tente novamente.");
      return;
    }

    const previousEntries = get().entries;
    const toastId = showLoadingToast(
      "Encerrando acesso ativo",
      `Finalizando o acesso de ${target.person.fullName}.`,
    );

    set({
      closingEntryId: entryId,
      feedback: "Encerrando acesso ativo...",
      entries: previousEntries.filter((entry) => entry.id !== entryId),
    });

    try {
      await manualCloseEntry(entryId, "Acesso encerrado manualmente pela tela de acessos ativos.");

      set({
        closingEntryId: null,
        feedback: "Acesso encerrado com sucesso.",
      });
      showSuccessToast(
        "Acesso encerrado",
        `O acesso de ${target.person.fullName} foi finalizado.`,
        { id: toastId },
      );
    } catch (error) {
      const message = resolveErrorMessage(error, "Nao foi possivel encerrar o acesso.");
      set({
        closingEntryId: null,
        entries: previousEntries,
        feedback: message,
      });
      showErrorToast("Falha ao encerrar acesso", message, { id: toastId });
    }
  },
  clearFeedback() {
    set({ feedback: null });
  },
}));
