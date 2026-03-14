"use client";

import { create } from "zustand";
import { fetchDashboardOverview, type DashboardOverview } from "@/lib/api/dashboard";
import { fetchPlants, type Plant } from "@/lib/api/plants";
import { resolveErrorMessage } from "@/store/store-utils";

export type LiveFeedStatus = "connecting" | "connected" | "offline";

export interface LiveOperationsEvent {
  type: "presence.snapshot" | "entry.created" | "entry.closed" | "entry.adjusted";
  payload: Record<string, unknown>;
  createdAt: string;
}

interface DashboardState {
  overview: DashboardOverview | null;
  plants: Plant[];
  events: LiveOperationsEvent[];
  loadingOverview: boolean;
  loadingPlants: boolean;
  error: string | null;
  realtimeStatus: LiveFeedStatus;
  loadOverview: (plantId?: string | null) => Promise<void>;
  loadPlants: () => Promise<void>;
  setRealtimeStatus: (status: LiveFeedStatus) => void;
  resetFeed: () => void;
  pushEvent: (event: LiveOperationsEvent) => void;
}

function normalizePlantId(plantId?: string | null) {
  return plantId && plantId !== "all" ? plantId : undefined;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  overview: null,
  plants: [],
  events: [],
  loadingOverview: false,
  loadingPlants: false,
  error: null,
  realtimeStatus: "connecting",
  async loadOverview(plantId) {
    set({ loadingOverview: true, error: null });

    try {
      const overview = await fetchDashboardOverview(normalizePlantId(plantId));
      set({ overview, loadingOverview: false });
    } catch (error) {
      set({
        loadingOverview: false,
        error: resolveErrorMessage(error, "Nao foi possivel carregar o dashboard."),
      });
    }
  },
  async loadPlants() {
    set({ loadingPlants: true, error: null });

    try {
      const plants = await fetchPlants();
      set({ plants, loadingPlants: false });
    } catch (error) {
      set({
        loadingPlants: false,
        error: resolveErrorMessage(error, "Nao foi possivel carregar as usinas."),
      });
    }
  },
  setRealtimeStatus(status) {
    set({ realtimeStatus: status });
  },
  resetFeed() {
    set({ events: [], realtimeStatus: "connecting" });
  },
  pushEvent(event) {
    set((state) => {
      const nextEvents = [event, ...state.events].slice(0, 24);
      const overview = state.overview ? { ...state.overview } : null;

      if (overview) {
        if (event.type === "entry.created") {
          overview.openEntries += 1;
          overview.employeesWithoutExit += 1;

          const personName =
            typeof event.payload.personName === "string" ? event.payload.personName : "Pessoa";
          const plantName =
            typeof event.payload.plantName === "string" ? event.payload.plantName : "Usina";
          const openedAt =
            typeof event.payload.openedAt === "string"
              ? event.payload.openedAt
              : event.createdAt;
          const status =
            typeof event.payload.status === "string" ? event.payload.status : "OPEN";
          const entryId =
            typeof event.payload.entryId === "string"
              ? event.payload.entryId
              : `live-${event.createdAt}`;

          overview.liveEntries = [
            {
              id: entryId,
              employeeName: personName,
              personType: "ACCESS",
              plantName,
              openedAt,
              status: status as DashboardOverview["liveEntries"][number]["status"],
            },
            ...overview.liveEntries.filter((item) => item.id !== entryId),
          ].slice(0, 8);
        }

        if (event.type === "entry.closed") {
          const entryId =
            typeof event.payload.entryId === "string" ? event.payload.entryId : null;

          overview.openEntries = Math.max(0, overview.openEntries - 1);
          overview.employeesWithoutExit = Math.max(0, overview.employeesWithoutExit - 1);
          overview.liveEntries = entryId
            ? overview.liveEntries.filter((item) => item.id !== entryId)
            : overview.liveEntries;
        }
      }

      return {
        events: nextEvents,
        overview,
      };
    });
  },
}));
