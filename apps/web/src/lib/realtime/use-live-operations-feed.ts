"use client";

import { useEffect } from "react";
import {
  useDashboardStore,
} from "@/store/dashboard-store";
import { useOperationsRealtime } from "@/lib/realtime/use-operations-realtime";
import type { LiveOperationsEvent } from "@/lib/realtime/operations-types";

interface UseLiveOperationsFeedOptions {
  onEvent?: (event: LiveOperationsEvent) => void;
}

export function useLiveOperationsFeed(plantId?: string, options?: UseLiveOperationsFeedOptions) {
  const events = useDashboardStore((state) => state.events);
  const status = useDashboardStore((state) => state.realtimeStatus);
  const pushEvent = useDashboardStore((state) => state.pushEvent);
  const resetFeed = useDashboardStore((state) => state.resetFeed);
  const setRealtimeStatus = useDashboardStore((state) => state.setRealtimeStatus);

  useEffect(() => {
    resetFeed();
  }, [plantId, pushEvent, resetFeed, setRealtimeStatus]);

  useOperationsRealtime({
    plantId,
    onStatusChange: setRealtimeStatus,
    onEvent: (event) => {
      pushEvent(event);
      options?.onEvent?.(event);
    },
  });

  return { events, status };
}

export type { LiveOperationsEvent };
