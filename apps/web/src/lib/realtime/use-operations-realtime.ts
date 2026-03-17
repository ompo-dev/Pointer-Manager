"use client";

import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import type { LiveFeedStatus, LiveOperationsEvent } from "@/lib/realtime/operations-types";

const socketUrl =
  process.env.NEXT_PUBLIC_API_SOCKET_IO_URL?.replace(/\/$/, "") ??
  "http://localhost:4001";

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

    const socket = io(socketUrl, {
      transports: ["websocket"],
      forceNew: true,
      query: normalizedPlantId ? { plantId: normalizedPlantId } : undefined,
    });

    socket.on("connect", () => updateStatus("connected"));
    socket.on("disconnect", () => updateStatus("offline"));
    socket.on("connect_error", () => updateStatus("offline"));
    socket.on("operations:event", (event: LiveOperationsEvent) => {
      onEventRef.current?.(event);
    });

    return () => {
      socket.disconnect();
      updateStatus("offline");
    };
  }, [enabled, normalizedPlantId]);

  return { status };
}
