import { authClient } from "@/lib/auth/client";
import { useSessionStore } from "@/store/session-store";

function redirectToLogin() {
  if (typeof window === "undefined") {
    return;
  }

  if (window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}

export function forceLocalLogout() {
  useSessionStore.getState().clearSession();
  redirectToLogin();
}

export async function signOutFromApp() {
  try {
    await authClient.signOut();
  } catch {
    // Local cleanup still has to happen when the auth endpoint is unavailable.
  } finally {
    forceLocalLogout();
  }
}
