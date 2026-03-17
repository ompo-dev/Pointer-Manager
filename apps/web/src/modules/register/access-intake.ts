"use client";

import type { AccessIntakeContext } from "@/lib/api/time-entries";

export interface AccessModeInput {
  plant: {
    id?: string | null;
    name?: string | null;
  } | null;
}

export type ResolvedAccessMode = "ENTRY" | "EXIT" | "BLOCKED";

export function resolveAccessMode(
  intake: AccessIntakeContext,
  currentPlant?: AccessModeInput["plant"],
): ResolvedAccessMode {
  if (intake.suggestedMode === "BLOCKED" || intake.blockedReason) {
    return "BLOCKED";
  }

  if (!intake.openEntry) {
    return "ENTRY";
  }

  if (intake.openEntry.samePlant) {
    return "EXIT";
  }

  if (
    currentPlant?.id &&
    intake.openEntry.plantId &&
    currentPlant.id === intake.openEntry.plantId
  ) {
    return "EXIT";
  }

  return intake.suggestedMode === "EXIT" ? "EXIT" : "BLOCKED";
}
