"use client";

import { create } from "zustand";
import { fetchAuditLogs, type AuditLogEntry } from "@/lib/api/audit";
import { resolveErrorMessage } from "@/store/store-utils";

interface AuditStore {
  logs: AuditLogEntry[];
  loading: boolean;
  feedback: string | null;
  loadLogs: (filters: {
    action?: string;
    entity?: string;
    search?: string;
    actorUserId?: string;
  }) => Promise<void>;
  clearFeedback: () => void;
}

export const useAuditStore = create<AuditStore>((set) => ({
  logs: [],
  loading: false,
  feedback: null,
  async loadLogs(filters) {
    set({ loading: true, feedback: null });

    try {
      const logs = await fetchAuditLogs(filters);
      set({ logs, loading: false });
    } catch (error) {
      set({
        loading: false,
        feedback: resolveErrorMessage(error, "Nao foi possivel carregar a auditoria."),
      });
    }
  },
  clearFeedback() {
    set({ feedback: null });
  },
}));
