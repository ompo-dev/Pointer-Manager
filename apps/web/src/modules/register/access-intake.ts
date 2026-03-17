"use client";

import type { AccessIntakeContext } from "@/lib/api/time-entries";

export type ResolvedAccessMode = "ENTRY" | "EXIT" | "BLOCKED";

function normalizeLabel(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

export function resolveAccessMode(intake: Pick<
  AccessIntakeContext,
  "suggestedMode" | "blockedReason" | "openEntry"
>, currentPlant?: { id?: string | null; name?: string | null } | null): ResolvedAccessMode {
  if (intake.blockedReason) {
    return "BLOCKED";
  }

  const currentPlantId = currentPlant?.id ?? null;
  const currentPlantName = currentPlant?.name ?? null;
  const isSamePlant =
    intake.openEntry?.samePlant ||
    (Boolean(currentPlantId) && intake.openEntry?.plantId === currentPlantId) ||
    (Boolean(currentPlantName) &&
      normalizeLabel(intake.openEntry?.plantName) === normalizeLabel(currentPlantName));

  if (intake.suggestedMode === "EXIT" || isSamePlant) {
    return "EXIT";
  }

  if (intake.openEntry) {
    return "BLOCKED";
  }

  if (intake.suggestedMode === "BLOCKED") {
    return "BLOCKED";
  }

  return "ENTRY";
}
