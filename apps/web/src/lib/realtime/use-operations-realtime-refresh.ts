"use client";

import { useEffect, useRef } from "react";
import { invalidateQueryCache } from "@/lib/api/query-cache";
import { useOperationsRealtime } from "@/lib/realtime/use-operations-realtime";
import type { LiveFeedStatus } from "@/lib/realtime/operations-types";

interface UseOperationsRealtimeRefreshOptions {
  plantId?: string;
  enabled?: boolean;
  matchers?: string[];
  debounceMs?: number;
  refreshOnReconnect?: boolean;
  onRefresh: () => Promise<void> | void;
}

export function useOperationsRealtimeRefresh({
  plantId,
  enabled = true,
  matchers,
  debounceMs = 350,
  refreshOnReconnect = true,
  onRefresh,
}: UseOperationsRealtimeRefreshOptions) {
  const timeoutRef = useRef<number | null>(null);
  const onRefreshRef = useRef(onRefresh);
  const matchersRef = useRef(matchers);
  const hasConnectedOnceRef = useRef(false);
  const previousStatusRef = useRef<LiveFeedStatus>("connecting");

  useEffect(() => {
    onRefreshRef.current = onRefresh;
    matchersRef.current = matchers;
  }, [matchers, onRefresh]);

  function handleRefresh() {
    if (matchersRef.current?.length) {
      invalidateQueryCache(matchersRef.current);
    }

    void onRefreshRef.current();
  }

  const { status } = useOperationsRealtime({
    plantId,
    enabled,
    onEvent: (event) => {
      if (event.type === "presence.snapshot") {
        return;
      }

      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null;
        handleRefresh();
      }, debounceMs);
    },
  });

  useEffect(() => {
    if (!refreshOnReconnect) {
      previousStatusRef.current = status;
      return;
    }

    if (status !== "connected") {
      previousStatusRef.current = status;
      return;
    }

    if (!hasConnectedOnceRef.current) {
      hasConnectedOnceRef.current = true;
      previousStatusRef.current = status;
      return;
    }

    if (previousStatusRef.current !== "connected") {
      handleRefresh();
    }

    previousStatusRef.current = status;
  }, [refreshOnReconnect, status]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);
}
