"use client";

import { useEffect } from "react";
import {
  useDashboardStore,
  type LiveFeedStatus,
  type LiveOperationsEvent,
} from "@/store/dashboard-store";

const wsUrl =
  process.env.NEXT_PUBLIC_API_WS_URL?.replace(/\/$/, "") ??
  "ws://localhost:4000/realtime";

export function useLiveOperationsFeed(plantId?: string) {
  const events = useDashboardStore((state) => state.events);
  const status = useDashboardStore((state) => state.realtimeStatus);
  const pushEvent = useDashboardStore((state) => state.pushEvent);
  const resetFeed = useDashboardStore((state) => state.resetFeed);
  const setRealtimeStatus = useDashboardStore((state) => state.setRealtimeStatus);

  useEffect(() => {
    resetFeed();

    const url = new URL(wsUrl);

    if (plantId && plantId !== "all") {
      url.searchParams.set("plantId", plantId);
    }

    const socket = new WebSocket(url);

    const updateStatus = (nextStatus: LiveFeedStatus) => {
      setRealtimeStatus(nextStatus);
    };

    socket.addEventListener("open", () => updateStatus("connected"));
    socket.addEventListener("close", () => updateStatus("offline"));
    socket.addEventListener("error", () => updateStatus("offline"));
    socket.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data) as LiveOperationsEvent;
        pushEvent(data);
      } catch {
        updateStatus("offline");
      }
    });

    return () => {
      socket.close();
    };
  }, [plantId, pushEvent, resetFeed, setRealtimeStatus]);

  return { events, status };
}

export type { LiveOperationsEvent };
