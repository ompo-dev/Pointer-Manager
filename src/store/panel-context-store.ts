"use client";

import { create } from "zustand";
import { fetchPlants, type Plant } from "@/lib/api/plants";
import { showErrorToast } from "@/lib/toast";
import { resolveErrorMessage } from "@/store/store-utils";

interface PanelContextStore {
  plants: Plant[];
  loading: boolean;
  feedback: string | null;
  loadPlants: () => Promise<void>;
}

export const usePanelContextStore = create<PanelContextStore>((set) => ({
  plants: [],
  loading: false,
  feedback: null,
  async loadPlants() {
    set({ loading: true, feedback: null });

    try {
      const plants = await fetchPlants({ status: "ACTIVE" });
      set({ plants, loading: false });
    } catch (error) {
      const message = resolveErrorMessage(error, "Nao foi possivel carregar o contexto de usinas.");
      set({
        loading: false,
        feedback: message,
      });
      showErrorToast("Falha ao carregar contexto", message);
    }
  },
}));
