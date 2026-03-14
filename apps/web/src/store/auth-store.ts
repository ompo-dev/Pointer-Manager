"use client";

import { create } from "zustand";
import { authClient } from "@/lib/auth/client";
import { toSessionUser } from "@/lib/auth/session-user";
import { useSessionStore } from "@/store/session-store";
import { resolveErrorMessage } from "@/store/store-utils";

interface AuthStore {
  error: string | null;
  isPending: boolean;
  clearError: () => void;
  setError: (message: string | null) => void;
  login: (credentials: { email: string; password: string }) => Promise<boolean>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  error: null,
  isPending: false,
  clearError() {
    set({ error: null });
  },
  setError(message) {
    set({ error: message });
  },
  async login(credentials) {
    set({ isPending: true, error: null });

    try {
      const signInResult = await authClient.signIn.email({
        email: credentials.email,
        password: credentials.password,
        rememberMe: true,
      });

      if (signInResult.error) {
        set({
          isPending: false,
          error: signInResult.error.message ?? "Nao foi possivel autenticar agora.",
        });
        return false;
      }

      if (!signInResult.data?.user) {
        set({
          isPending: false,
          error: "Nao foi possivel autenticar agora.",
        });
        return false;
      }

      const tokenResult = await authClient.token();
      const token = tokenResult.data?.token;

      if (!token) {
        set({
          isPending: false,
          error: tokenResult.error?.message ?? "Nao foi possivel gerar a sessao do painel.",
        });
        return false;
      }

      useSessionStore.getState().setSession({
        token,
        user: toSessionUser(signInResult.data.user as never),
      });

      set({ isPending: false, error: null });
      return true;
    } catch (error) {
      set({
        isPending: false,
        error: resolveErrorMessage(error, "Nao foi possivel autenticar agora."),
      });
      return false;
    }
  },
}));
