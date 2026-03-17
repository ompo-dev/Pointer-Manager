"use client";

import { create } from "zustand";
import { fetchAuthenticatedUser } from "@/lib/api/auth";
import { authClient } from "@/lib/auth/client";
import { toSessionUser } from "@/lib/auth/session-user";
import { showErrorToast, showLoadingToast, showSuccessToast } from "@/lib/toast";
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
    const toastId = showLoadingToast(
      "Autenticando",
      "Validando suas credenciais e preparando a sessao.",
    );

    try {
      const signInResult = await authClient.signIn.email({
        email: credentials.email,
        password: credentials.password,
        rememberMe: true,
      });

      if (signInResult.error) {
        const message =
          signInResult.error.message ?? "Nao foi possivel autenticar agora.";
        set({
          isPending: false,
          error: message,
        });
        showErrorToast("Falha no login", message, { id: toastId });
        return false;
      }

      if (!signInResult.data?.user) {
        set({
          isPending: false,
          error: "Nao foi possivel autenticar agora.",
        });
        showErrorToast("Falha no login", "Nao foi possivel autenticar agora.", {
          id: toastId,
        });
        return false;
      }

      const tokenResult = await authClient.token();
      const token = tokenResult.data?.token;

      if (!token) {
        const message =
          tokenResult.error?.message ?? "Nao foi possivel gerar a sessao do painel.";
        set({
          isPending: false,
          error: message,
        });
        showErrorToast("Falha ao iniciar sessao", message, { id: toastId });
        return false;
      }

      const authenticatedUser = await fetchAuthenticatedUser(token);

      useSessionStore.getState().setSession({
        token,
        user: toSessionUser(authenticatedUser),
      });

      set({ isPending: false, error: null });
      showSuccessToast("Login realizado", "Sessao administrativa iniciada com sucesso.", {
        id: toastId,
      });
      return true;
    } catch (error) {
      const message = resolveErrorMessage(error, "Nao foi possivel autenticar agora.");
      set({
        isPending: false,
        error: message,
      });
      showErrorToast("Falha no login", message, { id: toastId });
      return false;
    }
  },
}));
