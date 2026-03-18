"use client";

import { useEffect, useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { parseAsString, useQueryState } from "nuqs";
import {
  Building2,
  CheckCircle2,
  Clock3,
  Network,
  Plus,
  QrCode,
} from "lucide-react";
import { toDataURL } from "qrcode";
import { DataTable } from "@/components/data-table";
import { ActiveStateBadge, TimeEntryStatusBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  SearchableCombobox,
  type SearchableOption,
} from "@/components/ui/searchable-combobox";
import {
  fetchBrazilStates,
  fetchCitiesByState,
  type BrazilState,
} from "@/lib/api/brazil-locations";
import { type Plant, type PlantDetails } from "@/lib/api/plants";
import { useOperationsRealtimeRefresh } from "@/lib/realtime/use-operations-realtime-refresh";
import {
  formatDateTime,
  formatMinutes,
  formatPersonTypeLabel,
} from "@/lib/utils";
import { PlantEditorPanel } from "@/modules/plants/plant-editor-panel";
import { emptyPlantForm, usePlantsStore } from "@/store/plants-store";

type PlantRow = Plant;
type PresentPersonRow = PlantDetails["presentPeople"][number];
type PlantHistoryRow = PlantDetails["history"][number];

function networkNeedsRepair(network: {
  ssid?: string | null;
  bssid?: string | null;
  ipv4Cidr?: string | null;
}) {
  return !network.ssid && !network.bssid && !network.ipv4Cidr;
}

function buildComparablePlantForm(plant?: PlantDetails | Plant | null) {
  if (!plant) {
    return emptyPlantForm;
  }

  return {
    id: plant.id,
    code: plant.code,
    name: plant.name,
    city: plant.city,
    state: plant.state,
    openingHour: plant.openingHour,
    closingHour: plant.closingHour,
    qrToken: plant.qrToken,
    requireWifiMatch: String(plant.requireWifiMatch),
    requireSelfie: String(plant.requireSelfie),
    autoCloseLimitHours: String(plant.autoCloseLimitHours),
    lateAlertMinutes: String(plant.lateAlertMinutes),
    geofenceLatitude: plant.geofenceLatitude?.toString() ?? "",
    geofenceLongitude: plant.geofenceLongitude?.toString() ?? "",
    geofenceRadiusMeters: plant.geofenceRadiusMeters?.toString() ?? "",
    authorizedNetworks: (plant.authorizedNetworks ?? []).map((network) => ({
      id: network.id,
      name: network.name,
      ssid: network.ssid ?? "",
      bssid: network.bssid ?? "",
      ipv4Cidr: network.ipv4Cidr ?? "",
      notes: network.notes ?? "",
    })),
  };
}

export function PlantsScreen() {
  const [search, setSearch] = useQueryState(
    "search",
    parseAsString.withDefault(""),
  );
  const [status, setStatus] = useQueryState(
    "status",
    parseAsString.withDefault("ALL"),
  );
  const [plantId, setPlantId] = useQueryState("plantId", parseAsString);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [hasSeededInitialSelection, setHasSeededInitialSelection] =
    useState(false);
  const plants = usePlantsStore((state) => state.plants);
  const selectedPlant = usePlantsStore((state) => state.selectedPlant);
  const form = usePlantsStore((state) => state.form);
  const detectedNetwork = usePlantsStore((state) => state.detectedNetwork);
  const selectedDetectedCandidateId = usePlantsStore(
    (state) => state.selectedDetectedCandidateId,
  );
  const detectedLocation = usePlantsStore((state) => state.detectedLocation);
  const feedback = usePlantsStore((state) => state.feedback);
  const saving = usePlantsStore((state) => state.saving);
  const detectingNetwork = usePlantsStore((state) => state.detectingNetwork);
  const detectingLocation = usePlantsStore((state) => state.detectingLocation);
  const setFormValue = usePlantsStore((state) => state.setFormValue);
  const updateAuthorizedNetwork = usePlantsStore(
    (state) => state.updateAuthorizedNetwork,
  );
  const appendAuthorizedNetwork = usePlantsStore(
    (state) => state.appendAuthorizedNetwork,
  );
  const removeAuthorizedNetwork = usePlantsStore(
    (state) => state.removeAuthorizedNetwork,
  );
  const detectCurrentNetwork = usePlantsStore(
    (state) => state.detectCurrentNetwork,
  );
  const setSelectedDetectedCandidateId = usePlantsStore(
    (state) => state.setSelectedDetectedCandidateId,
  );
  const applyDetectedNetwork = usePlantsStore(
    (state) => state.applyDetectedNetwork,
  );
  const detectCurrentLocation = usePlantsStore(
    (state) => state.detectCurrentLocation,
  );
  const applyDetectedLocation = usePlantsStore(
    (state) => state.applyDetectedLocation,
  );
  const resetForm = usePlantsStore((state) => state.resetForm);
  const savePlant = usePlantsStore((state) => state.savePlant);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [stateOptions, setStateOptions] = useState<SearchableOption[]>([]);
  const [loadingStates, setLoadingStates] = useState(false);
  const [cityOptions, setCityOptions] = useState<SearchableOption[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);

  const selectedDetectedCandidate = useMemo(
    () =>
      detectedNetwork?.candidates.find(
        (candidate) => candidate.id === selectedDetectedCandidateId,
      ) ??
      detectedNetwork?.candidates.find((candidate) => candidate.isCurrent) ??
      detectedNetwork?.candidates[0] ??
      null,
    [detectedNetwork, selectedDetectedCandidateId],
  );

  const plantColumns = useMemo<ColumnDef<PlantRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Usina",
        cell: ({ row }) => (
          <div className="space-y-1 whitespace-normal">
            <p className="font-semibold">{row.original.name}</p>
            <p className="text-sm text-muted-foreground">{row.original.id}</p>
          </div>
        ),
      },
      {
        accessorKey: "city",
        header: "Local",
        cell: ({ row }) => (
          <div className="space-y-1 whitespace-normal text-sm">
            <p>
              {row.original.city} - {row.original.state}
            </p>
            <p className="text-muted-foreground">
              {row.original.openingHour} - {row.original.closingHour}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <ActiveStateBadge status={row.original.status} />,
      },
      {
        accessorKey: "_count",
        header: "Operacao",
        cell: ({ row }) => (
          <div className="space-y-1 whitespace-normal text-sm">
            <p>{row.original._count?.people ?? 0} pessoas</p>
            <p className="text-muted-foreground">
              {row.original._count?.timeEntries ?? 0} acessos abertos
            </p>
          </div>
        ),
      },
    ],
    [],
  );

  const presentColumns = useMemo<ColumnDef<PresentPersonRow>[]>(
    () => [
      {
        accessorKey: "person.fullName",
        header: "Pessoa",
        cell: ({ row }) => (
          <div className="space-y-1 whitespace-normal">
            <p className="font-semibold">{row.original.person.fullName}</p>
            <p className="text-sm text-muted-foreground">
              {row.original.person.cpf}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "person.personType",
        header: "Tipo",
        cell: ({ row }) => formatPersonTypeLabel(row.original.person.personType),
      },
      {
        accessorKey: "openedAt",
        header: "Entrada",
        cell: ({ row }) => formatDateTime(row.original.openedAt),
      },
    ],
    [],
  );

  const historyColumns = useMemo<ColumnDef<PlantHistoryRow>[]>(
    () => [
      {
        accessorKey: "person.fullName",
        header: "Pessoa",
        cell: ({ row }) => (
          <div className="space-y-1 whitespace-normal">
            <p className="font-semibold">{row.original.person.fullName}</p>
            <p className="text-sm text-muted-foreground">
              {formatDateTime(row.original.openedAt)}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <TimeEntryStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "totalMinutes",
        header: "Horas",
        cell: ({ row }) => formatMinutes(row.original.totalMinutes ?? 0),
      },
    ],
    [],
  );

  useEffect(() => {
    if (plantId || isCreatingNew) {
      if (!hasSeededInitialSelection) {
        setHasSeededInitialSelection(true);
      }
      return;
    }

    if (!hasSeededInitialSelection && plants[0]?.id) {
      setHasSeededInitialSelection(true);
      void setPlantId(plants[0].id);
    }
  }, [hasSeededInitialSelection, isCreatingNew, plantId, plants, setPlantId]);

  useEffect(() => {
    let cancelled = false;
    setLoadingStates(true);

    void fetchBrazilStates()
      .then((states) => {
        if (cancelled) return;
        setStateOptions(
          states.map((state: BrazilState) => ({
            value: state.code,
            label: `${state.name} (${state.code})`,
            keywords: [state.name, state.code],
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setStateOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingStates(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!form.state) {
      setCityOptions([]);
      return;
    }

    let cancelled = false;
    setLoadingCities(true);

    void fetchCitiesByState(form.state)
      .then((cities) => {
        if (cancelled) return;
        setCityOptions(
          cities.map((city) => ({
            value: city.name,
            label: city.name,
            keywords: [city.name, form.state],
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setCityOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingCities(false);
      });

    return () => {
      cancelled = true;
    };
  }, [form.state]);

  useEffect(() => {
    async function generateQrCode() {
      if (!selectedPlant?.id) {
        setQrCodeUrl("");
        return;
      }

      const origin =
        typeof window !== "undefined"
          ? window.location.origin
          : (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
      const registerUrl = `${origin}/register?plantId=${selectedPlant.id}`;
      const dataUrl = await toDataURL(registerUrl, { margin: 1, width: 180 });
      setQrCodeUrl(dataUrl);
    }

    void generateQrCode();
  }, [selectedPlant?.id]);

  useEffect(() => {
    void detectCurrentNetwork();
    void detectCurrentLocation();
  }, [detectCurrentLocation, detectCurrentNetwork, plantId]);

  const handleSavePlant = async () => {
    const savedId = await savePlant();
    if (savedId) {
      setIsCreatingNew(false);
      void setPlantId(savedId);
    }
  };

  const plantEditorProps = {
    showSaveAction:
      JSON.stringify(form) !==
      JSON.stringify(
        isCreatingNew
          ? emptyPlantForm
          : buildComparablePlantForm(selectedPlant),
      ),
    form,
    stateOptions,
    cityOptions,
    loadingStates,
    loadingCities,
    detectedNetwork,
    selectedDetectedCandidateId,
    selectedDetectedCandidate,
    detectedLocation,
    feedback,
    saving,
    detectingNetwork,
    detectingLocation,
    setFormValue,
    updateAuthorizedNetwork,
    appendAuthorizedNetwork,
    removeAuthorizedNetwork,
    detectCurrentNetwork,
    setSelectedDetectedCandidateId,
    applyDetectedNetwork,
    detectCurrentLocation,
    applyDetectedLocation,
    onSave: handleSavePlant,
  } as const;

  useOperationsRealtimeRefresh({
    matchers: ["plants", "plant"],
    onRefresh: async () => {
      await usePlantsStore.getState().loadPlants({ search, status });

      if (plantId && !isCreatingNew && !plantEditorProps.showSaveAction) {
        await usePlantsStore.getState().loadPlant(plantId);
      }
    },
  });

  const statusOptions = useMemo<SearchableOption[]>(
    () => [
      { value: "ALL", label: "Todos os status", keywords: ["todos"] },
      { value: "ACTIVE", label: "Ativa", keywords: ["ativa"] },
      { value: "INACTIVE", label: "Inativa", keywords: ["inativa"] },
    ],
    [],
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Usinas</CardTitle>
            <CardDescription>
              Cadastro, QRCode, redes autorizadas, geofence e politicas de
              fechamento.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <DataTable
              data={plants}
              columns={plantColumns}
              getRowId={(plant) => plant.id}
              queryStateScope="plantsList"
              onRowClick={(plant) => {
                if (!isCreatingNew && plant.id === plantId) {
                  resetForm();
                  void setPlantId(null);
                  return;
                }

                setIsCreatingNew(false);
                void setPlantId(plant.id);
              }}
              isRowActive={(plant) => plant.id === plantId}
              toolbar={
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px_auto]">
                  <Input
                    value={search}
                    onChange={(event) => void setSearch(event.target.value)}
                    placeholder="Buscar por nome ou localizacao"
                  />
                  <SearchableCombobox
                    value={status}
                    onValueChange={(value) => void setStatus(value || "ALL")}
                    options={statusOptions}
                    placeholder="Todos os status"
                    searchPlaceholder="Buscar status..."
                    emptyMessage="Nenhum status encontrado."
                  />
                  <Button
                    type="button"
                    onClick={() => {
                      setIsCreatingNew(true);
                      resetForm();
                      void setPlantId(null);
                    }}
                    size="lg"
                  >
                    <Plus className=" size-4" />
                    Criar usina
                  </Button>
                </div>
              }
              inlinePanel={
                isCreatingNew ? (
                  <div className="bg-muted/10">
                    <PlantEditorPanel mode="create" {...plantEditorProps} />
                  </div>
                ) : null
              }
              expandedRowId={!isCreatingNew ? plantId : null}
              getDetailTitle={(row) => row.name}
              getDetailDescription={(row) => `${row.city} - ${row.state}`}
              renderInlineDetails={(row) => (
                <div className="space-y-6 bg-muted/10">
                  <PlantEditorPanel mode="edit" {...plantEditorProps} />

                  {selectedPlant?.id === row.id ? (
                    <div className="grid gap-4 px-4 pb-4 sm:px-6 sm:pb-6 xl:grid-cols-[0.9fr_1.1fr]">
                      <Card>
                        <CardHeader>
                          <CardTitle>Operacao da usina</CardTitle>
                          <CardDescription>
                            {selectedPlant.name}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-border bg-card p-4">
                              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                Link publico
                              </p>
                              <p className="mt-2 break-all font-mono text-sm">
                                {selectedPlant.id}
                              </p>
                              <a
                                href={`/register?plantId=${selectedPlant.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-3 inline-flex text-sm font-semibold underline-offset-4 hover:underline"
                              >
                                Abrir pagina publica
                              </a>
                              {qrCodeUrl ? (
                                <img
                                  src={qrCodeUrl}
                                  alt={`QRCode da usina ${selectedPlant.name}`}
                                  className="mt-4 h-40 w-40 rounded-2xl border border-border bg-card p-2"
                                />
                              ) : (
                                <QrCode className="mt-3 size-5 text-muted-foreground" />
                              )}
                            </div>

                            <div className="rounded-2xl border border-border bg-card p-4">
                              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                Horario
                              </p>
                              <p className="mt-2 inline-flex items-center gap-2 text-sm">
                                <Clock3 className="size-4 text-muted-foreground" />
                                {selectedPlant.openingHour} -{" "}
                                {selectedPlant.closingHour}
                              </p>
                            </div>

                            <div className="rounded-2xl border border-border bg-card p-4">
                              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                Politica
                              </p>
                              <div className="mt-2 space-y-2 text-sm">
                                <p className="inline-flex items-center gap-2">
                                  <CheckCircle2 className="size-4 text-muted-foreground" />
                                  Wi-Fi:{" "}
                                  {selectedPlant.requireWifiMatch
                                    ? "obrigatorio"
                                    : "livre"}
                                </p>
                                <p className="inline-flex items-center gap-2">
                                  <CheckCircle2 className="size-4 text-muted-foreground" />
                                  Selfie:{" "}
                                  {selectedPlant.requireSelfie
                                    ? "obrigatoria"
                                    : "opcional"}
                                </p>
                              </div>
                            </div>

                            <div className="rounded-2xl border border-border bg-card p-4">
                              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                Limites
                              </p>
                              <p className="mt-2 text-sm">
                                Auto-close: {selectedPlant.autoCloseLimitHours}h
                                | Alerta:{" "}
                                {formatMinutes(selectedPlant.lateAlertMinutes)}
                              </p>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-border bg-card p-4">
                            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                              <Network className="size-4" />
                              Redes autorizadas
                            </p>
                            <div className="mt-3 space-y-2">
                              {selectedPlant.authorizedNetworks.map(
                                (network) => (
                                  <div
                                    key={`${network.name}-${network.ssid ?? network.ipv4Cidr ?? "network"}`}
                                    className="rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                                  >
                                    <p className="font-semibold">
                                      {network.name}
                                    </p>
                                    {networkNeedsRepair(network) ? (
                                      <p className="break-words text-amber-700">
                                        Cadastro antigo/incompleto. Atualize a
                                        deteccao automatica e salve a usina
                                        novamente para corrigir a rede.
                                      </p>
                                    ) : (
                                      <p className="break-words text-muted-foreground">
                                        {network.ssid || network.bssid
                                          ? `${network.ssid || "-"} | ${network.bssid || "-"} | ${network.ipv4Cidr || "-"}`
                                          : `Conexao cabeada ou sem identificacao Wi-Fi | ${network.ipv4Cidr || "-"}`}
                                      </p>
                                    )}
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Presenca e historico</CardTitle>
                          <CardDescription>
                            Pessoas presentes agora e os ultimos registros dessa
                            usina.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                          <div>
                            <p className="mb-3 inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                              <Building2 className="size-4" />
                              Presentes agora
                            </p>
                            <DataTable
                              data={selectedPlant.presentPeople}
                              columns={presentColumns}
                              getRowId={(entry) => entry.id}
                              queryStateScope="plantPresentPeople"
                              emptyMessage="Ninguem presente nesta usina."
                              showColumnVisibilityToggle={false}
                            />
                          </div>

                          <div>
                            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                              Historico recente
                            </p>
                            <DataTable
                              data={selectedPlant.history}
                              columns={historyColumns}
                              getRowId={(entry) => entry.id}
                              queryStateScope="plantHistory"
                              emptyMessage="Sem historico recente para esta usina."
                              showColumnVisibilityToggle={false}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ) : null}
                </div>
              )}
              emptyMessage="Nenhuma usina encontrada."
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
