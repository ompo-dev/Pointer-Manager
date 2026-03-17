"use client";

import { create } from "zustand";
import { fetchDashboardOverview, type DashboardOverview } from "@/lib/api/dashboard";
import { fetchPlants, type Plant } from "@/lib/api/plants";
import type {
  LiveFeedStatus,
  LiveOperationsEvent,
} from "@/lib/realtime/operations-types";
import { showErrorToast } from "@/lib/toast";
import { resolveErrorMessage } from "@/store/store-utils";

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
      const message = resolveErrorMessage(error, "Nao foi possivel carregar o dashboard.");
      set({
        loadingOverview: false,
        error: message,
      });
      showErrorToast("Falha ao carregar dashboard", message);
    }
  },
  async loadPlants() {
    set({ loadingPlants: true, error: null });

    try {
      const plants = await fetchPlants();
      set({ plants, loadingPlants: false });
    } catch (error) {
      const message = resolveErrorMessage(error, "Nao foi possivel carregar as usinas.");
      set({
        loadingPlants: false,
        error: message,
      });
      showErrorToast("Falha ao carregar usinas", message);
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
          overview.activePeople += 1;
          overview.openEntries += 1;
          overview.peopleWithoutExit += 1;

          const personName =
            typeof event.payload.personName === "string" ? event.payload.personName : "Pessoa";
          const personType =
            typeof event.payload.personType === "string"
              ? event.payload.personType
              : "OTHER";
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
              personName,
              personType,
              plantName,
              openedAt,
              elapsedMinutes: 0,
              status: status as DashboardOverview["liveEntries"][number]["status"],
            },
            ...overview.liveEntries.filter((item) => item.id !== entryId),
          ].slice(0, 8);
        }

        if (event.type === "entry.closed") {
          const entryId =
            typeof event.payload.entryId === "string" ? event.payload.entryId : null;

          overview.activePeople = Math.max(0, overview.activePeople - 1);
          overview.openEntries = Math.max(0, overview.openEntries - 1);
          overview.peopleWithoutExit = Math.max(0, overview.peopleWithoutExit - 1);
          overview.liveEntries = entryId
            ? overview.liveEntries.filter((item) => item.id !== entryId)
            : overview.liveEntries;
        }

        if (event.type === "entry.adjusted") {
          const entryId =
            typeof event.payload.entryId === "string" ? event.payload.entryId : null;
          const personName =
            typeof event.payload.personName === "string" ? event.payload.personName : "Pessoa";
          const personType =
            typeof event.payload.personType === "string"
              ? event.payload.personType
              : "OTHER";
          const plantName =
            typeof event.payload.plantName === "string" ? event.payload.plantName : "Usina";
          const openedAt =
            typeof event.payload.openedAt === "string"
              ? event.payload.openedAt
              : event.createdAt;
          const status =
            typeof event.payload.status === "string" ? event.payload.status : "ADJUSTED";
          const isCurrentlyOpen = event.payload.isCurrentlyOpen === true;

          if (entryId && isCurrentlyOpen) {
            overview.liveEntries = overview.liveEntries.map((item) =>
              item.id === entryId
                ? {
                    ...item,
                    personName,
                    personType,
                    plantName,
                    openedAt,
                    status: status as DashboardOverview["liveEntries"][number]["status"],
                  }
                : item,
            );
          }

          if (entryId && !isCurrentlyOpen) {
            overview.liveEntries = overview.liveEntries.filter((item) => item.id !== entryId);
          }
        }
      }

      return {
        events: nextEvents,
        overview,
      };
    });
  },
}));
