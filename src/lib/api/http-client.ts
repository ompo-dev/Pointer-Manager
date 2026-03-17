import axios from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import { authClient } from "@/lib/auth/client";
import { forceLocalLogout } from "@/lib/auth/logout";
import { resolveApiOrigin } from "@/lib/network/runtime-url";
import { useSessionStore } from "@/store/session-store";

const apiBaseUrl = resolveApiOrigin();

export const httpClient = axios.create({
  baseURL: `${apiBaseUrl}/api/v1`,
  headers: {
    "Content-Type": "application/json",
  },
});

export const publicHttpClient = axios.create({
  baseURL: `${apiBaseUrl}/api/v1`,
  headers: {
    "Content-Type": "application/json",
  },
});

let tokenPromise: Promise<string | null> | null = null;

async function resolveAuthToken(options?: { forceRefresh?: boolean }) {
  const currentToken = useSessionStore.getState().token;

  if (currentToken && !options?.forceRefresh) {
    return currentToken;
  }

  if (tokenPromise) {
    return tokenPromise;
  }

  tokenPromise = (async () => {
  try {
    const tokenResult = await authClient.token();
    const token = tokenResult.data?.token ?? null;

    if (!token) {
      forceLocalLogout();
      return null;
    }

    useSessionStore.getState().setToken(token);
    return token;
  } catch {
    forceLocalLogout();
    return null;
  } finally {
    tokenPromise = null;
  }
  })();

  return tokenPromise;
}

httpClient.interceptors.request.use(async (config) => {
  let token = useSessionStore.getState().token;

  if (!token) {
    token = await resolveAuthToken();
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

httpClient.interceptors.response.use(undefined, async (error) => {
  const config = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

  if (error.response?.status !== 401 || !config || config._retry) {
    throw error;
  }

  useSessionStore.getState().setToken(null);
  const refreshedToken = await resolveAuthToken({ forceRefresh: true });

  if (!refreshedToken) {
    throw error;
  }

  config._retry = true;
  config.headers.Authorization = `Bearer ${refreshedToken}`;

  return httpClient.request(config);
});
