"use client";

export type LiveFeedStatus = "connecting" | "connected" | "offline";

export interface LiveOperationsEvent {
  type: "presence.snapshot" | "entry.created" | "entry.closed" | "entry.adjusted";
  plantId?: string;
  payload: Record<string, unknown>;
  createdAt: string;
}
