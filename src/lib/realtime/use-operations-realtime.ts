"use client";

import { useEffect, useRef, useState } from "react";
import type { LiveFeedStatus, LiveOperationsEvent } from "@/lib/realtime/operations-types";

interface UseOperationsRealtimeOptions {
  plantId?: string;
  enabled?: boolean;
  onEvent?: (event: LiveOperationsEvent) => void;
  onStatusChange?: (status: LiveFeedStatus) => void;
}

function normalizePlantId(plantId?: string) {
  return plantId && plantId !== "all" ? plantId : undefined;
}

export function useOperationsRealtime({
  plantId,
  enabled = true,
  onEvent,
  onStatusChange,
}: UseOperationsRealtimeOptions) {
  const [status, setStatus] = useState<LiveFeedStatus>("connecting");
  const normalizedPlantId = normalizePlantId(plantId);
  const onEventRef = useRef(onEvent);
  const onStatusChangeRef = useRef(onStatusChange);

  useEffect(() => {
    onEventRef.current = onEvent;
    onStatusChangeRef.current = onStatusChange;
  }, [onEvent, onStatusChange]);

  function updateStatus(nextStatus: LiveFeedStatus) {
    setStatus(nextStatus);
    onStatusChangeRef.current?.(nextStatus);
  }

  useEffect(() => {
    if (!enabled) {
      updateStatus("offline");
      return;
    }

    updateStatus("connecting");

    const url = new URL("/api/realtime/operations", window.location.origin);
    if (normalizedPlantId) {
      url.searchParams.set("plantId", normalizedPlantId);
    }

    const eventSource = new EventSource(url.toString(), {
      withCredentials: true,
    });

    eventSource.onopen = () => {
      updateStatus("connected");
    };

    eventSource.onerror = () => {
      updateStatus("offline");
    };

    eventSource.addEventListener("operations", (event) => {
      if (!(event instanceof MessageEvent) || typeof event.data !== "string") {
        return;
      }

      try {
        const payload = JSON.parse(event.data) as LiveOperationsEvent;
        onEventRef.current?.(payload);
      } catch (error) {
        console.error(error);
      }
    });

    return () => {
      eventSource.close();
      updateStatus("offline");
    };
  }, [enabled, normalizedPlantId]);

  return { status };
}
