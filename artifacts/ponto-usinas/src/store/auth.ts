import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Usuario } from "@workspace/api-client-react";

interface AuthStore {
  user: Usuario | null;
  token: string | null;
  setUser: (user: Usuario | null) => void;
  setToken: (token: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
      logout: () => set({ user: null, token: null }),
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({ token: state.token }), // Only persist token
    }
  )
);
