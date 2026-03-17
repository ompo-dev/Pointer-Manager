"use client";

import { useEffect, useMemo } from "react";
import { parseAsString, useQueryState } from "nuqs";
import { Building2, MapPin } from "lucide-react";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useSessionStore } from "@/store/session-store";
import { usePanelContextStore } from "@/store/panel-context-store";

export function PanelContextSwitcher() {
  const { state, toggleSidebar } = useSidebar();
  const user = useSessionStore((state) => state.user);
  const [plant, setPlant] = useQueryState(
    "plant",
    parseAsString.withDefault(""),
  );
  const plants = usePanelContextStore((state) => state.plants);
  const loading = usePanelContextStore((state) => state.loading);
  const feedback = usePanelContextStore((state) => state.feedback);
  const loadPlants = usePanelContextStore((state) => state.loadPlants);

  useEffect(() => {
    if (plants.length === 0 && !loading) {
      void loadPlants();
    }
  }, [loadPlants, loading, plants.length]);

  useEffect(() => {
    if (plant || plants.length === 0) {
      return;
    }

    const preferredPlantId =
      user?.plantId && plants.some((item) => item.id === user.plantId)
        ? user.plantId
        : plants[0]?.id;

    if (preferredPlantId) {
      void setPlant(preferredPlantId);
    }
  }, [plant, plants, setPlant, user?.plantId]);

  const currentPlant = plants.find((item) => item.id === plant) ?? null;
  const options = useMemo(
    () =>
      plants.map((item) => ({
        value: item.id,
        label: item.name,
        keywords: [item.city, item.state, item.code, item.id],
      })),
    [plants],
  );

  if (state === "collapsed") {
    return (
      <SidebarGroup className="w-full">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={currentPlant?.name ?? "Selecionar usina"}
              className="justify-center rounded-xl border border-sidebar-border/70 bg-sidebar-accent/30"
              onClick={() => toggleSidebar()}
            >
              <Building2 className="size-4" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
    );
  }

  return (
    <SidebarGroup className="py-0">
      <SidebarGroupContent>
        <div className="space-y-3 rounded-2xl border border-sidebar-border/70 bg-sidebar-accent/30 p-3">
          <SearchableCombobox
            value={plant}
            onValueChange={(value) => {
              if (value) {
                void setPlant(value);
              }
            }}
            options={options}
            placeholder={loading ? "Carregando usinas..." : "Selecionar usina"}
            searchPlaceholder="Buscar usina..."
            emptyMessage="Nenhuma usina encontrada."
            loading={loading}
            className="h-10 rounded-xl border-sidebar-border/60 bg-sidebar text-sidebar-foreground"
          />

          {currentPlant ? (
            <div className="rounded-xl border border-sidebar-border/60 bg-sidebar px-3 py-2 text-sm">
              <p className="inline-flex items-center gap-2 font-medium text-sidebar-foreground">
                <Building2 className="size-4" />
                {currentPlant.name}
              </p>
              <p className="mt-1 inline-flex items-center gap-2 text-xs text-sidebar-foreground/70">
                <MapPin className="size-3.5" />
                {currentPlant.city} - {currentPlant.state}
              </p>
            </div>
          ) : (
            <p className="text-xs text-sidebar-foreground/70">
              Selecione a usina para filtrar o painel operacional.
            </p>
          )}

          {feedback ? (
            <p className="text-xs text-sidebar-foreground/70">{feedback}</p>
          ) : null}
        </div>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
