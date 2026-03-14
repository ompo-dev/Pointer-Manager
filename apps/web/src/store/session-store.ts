"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  plantId: string | null;
  status: string;
}

interface SessionState {
  token: string | null;
  user: SessionUser | null;
  setSession: (payload: { token: string; user: SessionUser }) => void;
  setToken: (token: string | null) => void;
  setAuthenticatedUser: (user: SessionUser | null) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: ({ token, user }) => set({ token, user }),
      setToken: (token) => set((state) => ({ ...state, token })),
      setAuthenticatedUser: (user) => set((state) => ({ ...state, user })),
      clearSession: () => set({ token: null, user: null }),
    }),
    {
      name: "point-manager-session",
      partialize: (state) => ({ token: state.token, user: state.user }),
    },
  ),
);

export type { SessionUser };
