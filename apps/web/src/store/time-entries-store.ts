"use client";

import { create } from "zustand";
import { fetchPlants, type Plant } from "@/lib/api/plants";
import {
  adjustEntry,
  fetchTimeEntries,
  manualCloseEntry,
  runAutoClose,
  type TimeEntryRecord,
} from "@/lib/api/time-entries";
import { resolveErrorMessage } from "@/store/store-utils";

export interface AdjustFormState {
  openedAt: string;
  closedAt: string;
  notes: string;
  status: string;
}

function toDateTimeLocal(value?: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function buildAdjustState(entry?: TimeEntryRecord | null): AdjustFormState {
  if (!entry) {
    return {
      openedAt: "",
      closedAt: "",
      notes: "",
      status: "ADJUSTED",
    };
  }

  return {
    openedAt: toDateTimeLocal(entry.openedAt),
    closedAt: toDateTimeLocal(entry.closedAt),
    notes: entry.notes ?? "",
    status: entry.status,
  };
}

interface TimeEntriesStore {
  entries: TimeEntryRecord[];
  plantOptions: Plant[];
  selectedEntryId: string | null;
  adjustForm: AdjustFormState;
  feedback: string | null;
  loading: boolean;
  loadingPlantOptions: boolean;
  closing: boolean;
  adjusting: boolean;
  autoClosing: boolean;
  loadEntries: (filters: {
    search?: string;
    plantId?: string;
    status?: string;
    from?: string;
    to?: string;
  }) => Promise<void>;
  loadPlantOptions: () => Promise<void>;
  setSelectedEntryId: (entryId: string | null) => void;
  setAdjustField: <K extends keyof AdjustFormState>(key: K, value: AdjustFormState[K]) => void;
  clearFeedback: () => void;
  closeSelectedEntry: () => Promise<void>;
  adjustSelectedEntry: () => Promise<void>;
  runAutoClose: (plantId?: string) => Promise<void>;
}

export const useTimeEntriesStore = create<TimeEntriesStore>((set, get) => ({
  entries: [],
  plantOptions: [],
  selectedEntryId: null,
  adjustForm: buildAdjustState(),
  feedback: null,
  loading: false,
  loadingPlantOptions: false,
  closing: false,
  adjusting: false,
  autoClosing: false,
  async loadEntries(filters) {
    set({ loading: true, feedback: null });

    try {
      const entries = await fetchTimeEntries(filters);
      const selectedEntryId = get().selectedEntryId ?? entries[0]?.id ?? null;
      const selectedEntry = entries.find((entry) => entry.id === selectedEntryId) ?? null;

      set({
        entries,
        selectedEntryId,
        adjustForm: buildAdjustState(selectedEntry),
        loading: false,
      });
    } catch (error) {
      set({
        loading: false,
        feedback: resolveErrorMessage(error, "Nao foi possivel carregar os registros."),
      });
    }
  },
  async loadPlantOptions() {
    set({ loadingPlantOptions: true, feedback: null });

    try {
      const plantOptions = await fetchPlants();
      set({ plantOptions, loadingPlantOptions: false });
    } catch (error) {
      set({
        loadingPlantOptions: false,
        feedback: resolveErrorMessage(error, "Nao foi possivel carregar as usinas."),
      });
    }
  },
  setSelectedEntryId(selectedEntryId) {
    const selectedEntry =
      get().entries.find((entry) => entry.id === selectedEntryId) ?? null;

    set({
      selectedEntryId,
      adjustForm: buildAdjustState(selectedEntry),
    });
  },
  setAdjustField(key, value) {
    set((state) => ({
      adjustForm: {
        ...state.adjustForm,
        [key]: value,
      },
    }));
  },
  clearFeedback() {
    set({ feedback: null });
  },
  async closeSelectedEntry() {
    const { selectedEntryId, entries, adjustForm } = get();
    const selectedEntry =
      entries.find((entry) => entry.id === selectedEntryId) ?? null;

    if (!selectedEntry) {
      set({ feedback: "Selecione um registro para encerrar." });
      return;
    }

    const previousEntries = entries;
    const optimisticClosedAt = new Date().toISOString();

    set({
      closing: true,
      feedback: "Encerrando registro...",
      entries: entries.map((entry) =>
        entry.id === selectedEntry.id
          ? {
              ...entry,
              status: "CLOSED",
              notes: adjustForm.notes || entry.notes,
              closedAt: optimisticClosedAt,
            }
          : entry,
      ),
    });

    try {
      const updated = await manualCloseEntry(selectedEntry.id, adjustForm.notes);
      const nextEntries = get().entries.map((entry) =>
        entry.id === updated.id ? updated : entry,
      );

      set({
        entries: nextEntries,
        adjustForm: buildAdjustState(updated),
        closing: false,
        feedback: "Registro encerrado manualmente.",
      });
    } catch (error) {
      set({
        entries: previousEntries,
        adjustForm: buildAdjustState(selectedEntry),
        closing: false,
        feedback: resolveErrorMessage(error, "Falha ao encerrar registro."),
      });
    }
  },
  async adjustSelectedEntry() {
    const { selectedEntryId, entries, adjustForm } = get();
    const selectedEntry =
      entries.find((entry) => entry.id === selectedEntryId) ?? null;

    if (!selectedEntry) {
      set({ feedback: "Selecione um registro para ajustar." });
      return;
    }

    const previousEntries = entries;
    const optimisticEntry: TimeEntryRecord = {
      ...selectedEntry,
      openedAt: adjustForm.openedAt
        ? new Date(adjustForm.openedAt).toISOString()
        : selectedEntry.openedAt,
      closedAt: adjustForm.closedAt
        ? new Date(adjustForm.closedAt).toISOString()
        : null,
      notes: adjustForm.notes || null,
      status: adjustForm.status,
    };

    set({
      adjusting: true,
      feedback: "Aplicando ajuste...",
      entries: entries.map((entry) => (entry.id === optimisticEntry.id ? optimisticEntry : entry)),
    });

    try {
      const updated = await adjustEntry(selectedEntry.id, {
        openedAt: adjustForm.openedAt ? new Date(adjustForm.openedAt).toISOString() : undefined,
        closedAt: adjustForm.closedAt ? new Date(adjustForm.closedAt).toISOString() : null,
        notes: adjustForm.notes || null,
        status: adjustForm.status,
      });
      const nextEntries = get().entries.map((entry) =>
        entry.id === updated.id ? updated : entry,
      );

      set({
        entries: nextEntries,
        adjustForm: buildAdjustState(updated),
        adjusting: false,
        feedback: "Registro ajustado com sucesso.",
      });
    } catch (error) {
      set({
        entries: previousEntries,
        adjustForm: buildAdjustState(selectedEntry),
        adjusting: false,
        feedback: resolveErrorMessage(error, "Falha ao ajustar registro."),
      });
    }
  },
  async runAutoClose(plantId) {
    const previousEntries = get().entries;
    const nextEntries = previousEntries.map((entry) =>
      entry.status === "OPEN" && (!plantId || entry.plant.id === plantId)
        ? {
            ...entry,
            status: "AUTO_CLOSED",
            closedReason: "AUTO_CLOSE_PENDING",
          }
        : entry,
    );

    set({
      autoClosing: true,
      feedback: "Executando auto-close...",
      entries: nextEntries,
    });

    try {
      const result = await runAutoClose(plantId || undefined);

      set((state) => {
        const refreshedEntries = state.entries.map((entry) =>
          result.closedEntryIds.includes(entry.id)
            ? {
                ...entry,
                status: "AUTO_CLOSED",
              }
            : entry,
        );

        return {
          entries: refreshedEntries,
          autoClosing: false,
          feedback: `${result.closedEntryIds.length} registros encerrados automaticamente.`,
        };
      });
    } catch (error) {
      set({
        entries: previousEntries,
        autoClosing: false,
        feedback: resolveErrorMessage(error, "Falha ao executar auto-close."),
      });
    }
  },
}));
