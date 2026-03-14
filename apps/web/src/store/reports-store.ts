"use client";

import { create } from "zustand";
import { fetchPlants, type Plant } from "@/lib/api/plants";
import { fetchReportsSummary, type ReportsSummary } from "@/lib/api/reports";
import { resolveErrorMessage } from "@/store/store-utils";

interface ReportsStore {
  plantOptions: Plant[];
  summary: ReportsSummary | null;
  loadingPlants: boolean;
  loadingSummary: boolean;
  feedback: string | null;
  loadPlantOptions: () => Promise<void>;
  loadSummary: (filters: { plantId?: string; from?: string; to?: string }) => Promise<void>;
  clearFeedback: () => void;
}

export const useReportsStore = create<ReportsStore>((set) => ({
  plantOptions: [],
  summary: null,
  loadingPlants: false,
  loadingSummary: false,
  feedback: null,
  async loadPlantOptions() {
    set({ loadingPlants: true, feedback: null });

    try {
      const plantOptions = await fetchPlants();
      set({ plantOptions, loadingPlants: false });
    } catch (error) {
      set({
        loadingPlants: false,
        feedback: resolveErrorMessage(error, "Nao foi possivel carregar as usinas."),
      });
    }
  },
  async loadSummary(filters) {
    set({ loadingSummary: true, feedback: null });

    try {
      const summary = await fetchReportsSummary(filters);
      set({ summary, loadingSummary: false });
    } catch (error) {
      set({
        loadingSummary: false,
        feedback: resolveErrorMessage(error, "Nao foi possivel carregar os relatorios."),
      });
    }
  },
  clearFeedback() {
    set({ feedback: null });
  },
}));
