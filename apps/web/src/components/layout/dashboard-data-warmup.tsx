"use client";

import { startTransition, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAccessStore } from "@/store/access-store";
import { useAuditStore } from "@/store/audit-store";
import { useDashboardStore } from "@/store/dashboard-store";
import { usePeopleStore } from "@/store/people-store";
import { usePlantsStore } from "@/store/plants-store";
import { useReportsStore } from "@/store/reports-store";
import { useTimeEntriesStore } from "@/store/time-entries-store";

const recentWarmups = new Map<string, number>();
const WARMUP_DEDUP_WINDOW_MS = 1200;

function safelyRun(tasks: Array<() => Promise<void>>) {
  return Promise.allSettled(tasks.map((task) => task()));
}

export function DashboardDataWarmup() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
    const dashboardPlant = params?.get("plant") ?? "all";
    const from = params?.get("from") ?? "";
    const to = params?.get("to") ?? "";
    const personType = params?.get("personType") ?? "ALL";
    const action = params?.get("action") ?? "";
    const entity = params?.get("entity") ?? "";
    const personId = params?.get("personId");

    const priorityTasks: Array<() => Promise<void>> = [];
    const backgroundTasks: Array<() => Promise<void>> = [
      () => useDashboardStore.getState().loadPlants(),
      () => usePeopleStore.getState().loadPlantOptions(),
      () => useTimeEntriesStore.getState().loadPlantOptions(),
      () => useAccessStore.getState().loadPlantOptions(),
      () => useReportsStore.getState().loadPlantOptions(),
      () => usePlantsStore.getState().loadPlants({ search: "", status: "ALL" }),
      () =>
        usePeopleStore.getState().loadPeople({
          search: "",
          status: "ALL",
          personType: "ALL",
        }),
      () =>
        useTimeEntriesStore.getState().loadEntries({
          search: "",
          status: "ALL",
        }),
      () => useAccessStore.getState().loadUsers(),
      () => useReportsStore.getState().loadSummary({}),
      () => useAuditStore.getState().loadLogs({}),
    ];

    if (pathname === "/dashboard") {
      priorityTasks.push(
        () => useDashboardStore.getState().loadPlants(),
        () => useDashboardStore.getState().loadOverview(dashboardPlant),
      );
    }

    if (pathname === "/plants") {
      priorityTasks.push(
        () => usePlantsStore.getState().loadPlants({ search, status }),
        () => usePlantsStore.getState().loadPlant(plantId || null),
      );
    }

    if (pathname === "/employees") {
      priorityTasks.push(
        () => usePeopleStore.getState().loadPlantOptions(),
        () =>
          usePeopleStore.getState().loadPeople({
            search,
            status,
            personType,
            plantId: plantId || undefined,
          }),
        () => usePeopleStore.getState().loadPerson(personId ?? null),
      );
    }

    if (pathname === "/time-entries") {
      priorityTasks.push(
        () => useTimeEntriesStore.getState().loadPlantOptions(),
        () =>
          useTimeEntriesStore.getState().loadEntries({
            search,
            status,
            plantId: plantId || undefined,
            from: from || undefined,
            to: to || undefined,
          }),
      );
    }

    if (pathname === "/reports") {
      priorityTasks.push(
        () => useReportsStore.getState().loadPlantOptions(),
        () =>
          useReportsStore.getState().loadSummary({
            plantId: plantId || undefined,
            from: from || undefined,
            to: to || undefined,
          }),
      );
    }

    if (pathname === "/audit") {
      priorityTasks.push(
        () =>
          useAuditStore.getState().loadLogs({
            search: search || undefined,
            action: action || undefined,
            entity: entity || undefined,
          }),
      );
    }

    if (pathname === "/access") {
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
  }, [pathname, searchKey]);

  return null;
}
