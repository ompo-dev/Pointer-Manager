"use client";

import { startTransition, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { resolveAllowedModules } from "@/lib/permissions";
import { useAccessStore } from "@/store/access-store";
import { useAuditStore } from "@/store/audit-store";
import { useDashboardStore } from "@/store/dashboard-store";
import { usePeopleStore } from "@/store/people-store";
import { usePlantsStore } from "@/store/plants-store";
import { useReportsStore } from "@/store/reports-store";
import { useSessionStore } from "@/store/session-store";
import { useTimeEntriesStore } from "@/store/time-entries-store";

const recentWarmups = new Map<string, number>();
const WARMUP_DEDUP_WINDOW_MS = 1200;

function safelyRun(tasks: Array<() => Promise<void>>) {
  return Promise.allSettled(tasks.map((task) => task()));
}

export function DashboardDataWarmup() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const user = useSessionStore((state) => state.user);
  const searchKey = searchParams?.toString() ?? "";

  useEffect(() => {
    const warmupKey = `${pathname}?${searchKey}`;
    const lastWarmupAt = recentWarmups.get(warmupKey) ?? 0;
    const now = Date.now();

    if (now - lastWarmupAt < WARMUP_DEDUP_WINDOW_MS) {
      return;
    }

    recentWarmups.set(warmupKey, now);

    const params = searchParams;
    const search = params?.get("search") ?? "";
    const status = params?.get("status") ?? "ALL";
    const plantId = params?.get("plantId") ?? "";
    const panelPlantId = params?.get("plant") ?? "";
    const from = params?.get("from") ?? "";
    const to = params?.get("to") ?? "";
    const personType = params?.get("personType") ?? "ALL";
    const personId = params?.get("personId");
    const allowedModules = new Set(resolveAllowedModules(user));

    const priorityTasks: Array<() => Promise<void>> = [];
    const backgroundTasks: Array<() => Promise<void>> = [];

    if (allowedModules.has("dashboard")) {
      backgroundTasks.push(() => useDashboardStore.getState().loadPlants());
    }

    if (allowedModules.has("people")) {
      backgroundTasks.push(
        () => usePeopleStore.getState().loadPlantOptions(),
        () =>
          usePeopleStore.getState().loadPeople({
            search: "",
            status: "ALL",
            personType: "ALL",
            plantId: panelPlantId || undefined,
          }),
      );
    }

    if (allowedModules.has("time-entries")) {
      backgroundTasks.push(
        () => useTimeEntriesStore.getState().loadPlantOptions(),
        () =>
          useTimeEntriesStore.getState().loadEntries({
            search: "",
            status: "ALL",
            plantId: panelPlantId || undefined,
          }),
      );
    }

    if (allowedModules.has("plants")) {
      backgroundTasks.push(() => usePlantsStore.getState().loadPlants({ search: "", status: "ALL" }));
    }

    if (allowedModules.has("access")) {
      backgroundTasks.push(
        () => useAccessStore.getState().loadPlantOptions(),
        () => useAccessStore.getState().loadUsers(),
      );
    }

    if (allowedModules.has("reports")) {
      backgroundTasks.push(
        () => useReportsStore.getState().loadPlantOptions(),
        () =>
          useReportsStore.getState().loadSummary({
            plantId: panelPlantId || undefined,
          }),
      );
    }

    if (allowedModules.has("audit")) {
      backgroundTasks.push(() => useAuditStore.getState().loadLogs({}));
    }

    if (pathname === "/dashboard" && allowedModules.has("dashboard")) {
      priorityTasks.push(
        () => useDashboardStore.getState().loadPlants(),
        () => useDashboardStore.getState().loadOverview(panelPlantId || undefined),
      );
    }

    if (pathname === "/plants" && allowedModules.has("plants")) {
      priorityTasks.push(
        () => usePlantsStore.getState().loadPlants({ search, status }),
        () => usePlantsStore.getState().loadPlant(plantId || panelPlantId || null),
      );
    }

    if (pathname === "/people" && allowedModules.has("people")) {
      priorityTasks.push(
        () => usePeopleStore.getState().loadPlantOptions(),
        () =>
          usePeopleStore.getState().loadPeople({
            search,
            status,
            personType,
            plantId: panelPlantId || undefined,
          }),
        () => usePeopleStore.getState().loadPerson(personId ?? null),
      );
    }

    if ((pathname === "/time-entries" || pathname === "/active-access") && allowedModules.has("time-entries")) {
      priorityTasks.push(
        () => useTimeEntriesStore.getState().loadPlantOptions(),
        () =>
          useTimeEntriesStore.getState().loadEntries({
            search,
            status,
            plantId: panelPlantId || undefined,
            from: from || undefined,
            to: to || undefined,
          }),
      );
    }

    if (pathname === "/reports" && allowedModules.has("reports")) {
      priorityTasks.push(
        () => useReportsStore.getState().loadPlantOptions(),
        () =>
          useReportsStore.getState().loadSummary({
            plantId: panelPlantId || undefined,
            from: from || undefined,
            to: to || undefined,
          }),
      );
    }

    if (pathname === "/audit" && allowedModules.has("audit")) {
      priorityTasks.push(
        () => useAuditStore.getState().loadLogs({}),
      );
    }

    if (pathname === "/access" && allowedModules.has("access")) {
      priorityTasks.push(
        () => useAccessStore.getState().loadUsers(),
        () => useAccessStore.getState().loadPlantOptions(),
      );
    }

    startTransition(() => {
      void safelyRun(priorityTasks);
    });

    const timeout = window.setTimeout(() => {
      startTransition(() => {
        void safelyRun(backgroundTasks);
      });
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [pathname, searchKey, user]);

  return null;
}
