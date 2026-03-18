"use client";

import { MapPinned, Plus, Router, Trash2, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SearchableCombobox,
  type SearchableOption,
} from "@/components/ui/searchable-combobox";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type {
  DetectedLocationState,
  DetectedNetworkState,
  PlantAuthorizedNetworkForm,
  PlantFormState,
} from "@/store/plants-store";

function formatConnectionKind(connectionKind?: string | null) {
  if (connectionKind === "wifi") return "Wi-Fi";
  if (connectionKind === "ethernet") return "Cabeada";
  if (connectionKind === "mobile") return "Movel";
  return "Nao identificado";
}

function networkNeedsRepair(network: {
  publicIpv4Cidr?: string | null;
  localIpv4Cidr?: string | null;
  ssid?: string | null;
  bssid?: string | null;
}) {
  return (
    !network.publicIpv4Cidr &&
    !network.localIpv4Cidr &&
    !network.ssid &&
    !network.bssid
  );
}

interface PlantEditorPanelProps {
  mode: "create" | "edit";
  showSaveAction: boolean;
  form: PlantFormState;
  stateOptions: SearchableOption[];
  cityOptions: SearchableOption[];
  loadingStates: boolean;
  loadingCities: boolean;
  detectedNetwork: DetectedNetworkState | null;
  selectedDetectedCandidateId: string | null;
  selectedDetectedCandidate: DetectedNetworkState["localCandidates"][number] | null;
  detectedLocation: DetectedLocationState | null;
  feedback: string | null;
  saving: boolean;
  detectingNetwork: boolean;
  detectingLocation: boolean;
  setFormValue: <K extends keyof PlantFormState>(key: K, value: PlantFormState[K]) => void;
  updateAuthorizedNetwork: (
    index: number,
    key: keyof PlantAuthorizedNetworkForm,
    value: string,
  ) => void;
  appendAuthorizedNetwork: (network?: Partial<PlantAuthorizedNetworkForm>) => void;
  removeAuthorizedNetwork: (index: number) => void;
  detectCurrentNetwork: (options?: { notify?: boolean }) => void | Promise<void>;
  setSelectedDetectedCandidateId: (candidateId: string | null) => void;
  applyDetectedNetwork: () => void;
  detectCurrentLocation: (options?: { notify?: boolean }) => void | Promise<void>;
  applyDetectedLocation: () => void;
  onSave: () => void | Promise<void>;
}

export function PlantEditorPanel({
  mode,
  showSaveAction,
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
  onSave,
}: PlantEditorPanelProps) {
  const detectedCandidateOptions = (detectedNetwork?.localCandidates ?? []).map((candidate) => ({
    value: candidate.id,
    label: candidate.label,
    keywords: [
      candidate.connectionKind,
      candidate.interfaceName ?? "",
      candidate.localIpAddress ?? "",
      candidate.ssid ?? "",
      candidate.bssid ?? "",
    ],
  }));

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h3 className="text-base font-semibold">
            {mode === "edit" ? "Editar usina" : "Criar usina"}
          </h3>
          <p className="text-sm text-muted-foreground">
            Politica da usina, QRCode e ambiente de rede autorizado com deteccao do equipamento atual.
          </p>
        </div>
        {showSaveAction ? (
          <Button onClick={() => void onSave()} disabled={saving} className="sm:self-start">
            {saving ? "Salvando..." : "Salvar usina"}
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <div className="space-y-2 xl:col-span-3">
          <Label>Nome da usina</Label>
          <Input
            placeholder="Nome"
            value={form.name}
            onChange={(event) => setFormValue("name", event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Estado</Label>
          <SearchableCombobox
            value={form.state}
            onValueChange={(value) => {
              const nextState = value.toUpperCase();
              setFormValue("state", nextState);
              if (nextState !== form.state) setFormValue("city", "");
            }}
            options={stateOptions}
            placeholder="Selecione o estado"
            searchPlaceholder="Buscar estado..."
            emptyMessage="Nenhum estado encontrado."
            loading={loadingStates}
          />
        </div>

        <div className="space-y-2">
          <Label>Cidade</Label>
          <SearchableCombobox
            value={form.city}
            onValueChange={(value) => setFormValue("city", value)}
            options={cityOptions}
            placeholder={form.state ? "Selecione a cidade" : "Escolha um estado antes"}
            searchPlaceholder="Buscar cidade..."
            emptyMessage="Nenhuma cidade encontrada."
            disabled={!form.state}
            loading={loadingCities}
          />
        </div>

        <div className="space-y-2">
          <Label>Horario de abertura</Label>
          <Input
            type="time"
            value={form.openingHour}
            onChange={(event) => setFormValue("openingHour", event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Horario de fechamento</Label>
          <Input
            type="time"
            value={form.closingHour}
            onChange={(event) => setFormValue("closingHour", event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Auto-close em horas</Label>
          <Input
            placeholder="Auto-close em horas"
            value={form.autoCloseLimitHours}
            onChange={(event) => setFormValue("autoCloseLimitHours", event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Alerta em minutos</Label>
          <Input
            placeholder="Alerta em minutos"
            value={form.lateAlertMinutes}
            onChange={(event) => setFormValue("lateAlertMinutes", event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Latitude geofence</Label>
          <Input
            placeholder="Latitude geofence"
            value={form.geofenceLatitude}
            onChange={(event) => setFormValue("geofenceLatitude", event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Longitude geofence</Label>
          <Input
            placeholder="Longitude geofence"
            value={form.geofenceLongitude}
            onChange={(event) => setFormValue("geofenceLongitude", event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Raio da geofence (m)</Label>
          <Input
            placeholder="Raio geofence (m)"
            value={form.geofenceRadiusMeters}
            onChange={(event) => setFormValue("geofenceRadiusMeters", event.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <Label className="text-sm font-semibold">Exigir ambiente autorizado</Label>
            <p className="text-sm text-muted-foreground">
              Permite registro apenas dentro do ambiente de rede aprovado da usina.
            </p>
          </div>
          <Switch
            checked={form.requireWifiMatch === "true"}
            onCheckedChange={(checked) => setFormValue("requireWifiMatch", String(checked))}
          />
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <Label className="text-sm font-semibold">Exigir selfie</Label>
            <p className="text-sm text-muted-foreground">
              Obriga captura pela camera no momento do acesso.
            </p>
          </div>
          <Switch
            checked={form.requireSelfie === "true"}
            onCheckedChange={(checked) => setFormValue("requireSelfie", String(checked))}
          />
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-border bg-background/70 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Ambiente de rede autorizado</p>
            <p className="text-sm text-muted-foreground">
              O sistema usa a saida publica como sinal principal em producao e complementa com LAN local e identidade Wi-Fi quando disponiveis.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void detectCurrentNetwork({ notify: true })}
            disabled={detectingNetwork}
            className="w-full sm:w-auto"
          >
            <Wifi className="mr-2 size-4" />
            {detectingNetwork ? "Detectando..." : "Atualizar deteccao"}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="min-w-0 rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-col gap-3">
            <div className="space-y-1">
              <p className="inline-flex items-center gap-2 text-sm font-semibold">
                <Router className="size-4" />
                Ambiente detectado
              </p>
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="space-y-1">
                  <p className="font-medium text-foreground">Saida publica observada</p>
                  <p className="break-words">
                    IP: {detectedNetwork?.observedPublicIp ?? "-"} | CIDR sugerido:{" "}
                    {detectedNetwork?.suggestedPublicIpv4Cidr ?? "-"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">Rede local detectada</p>
                  <p className="break-words">
                    Tipo selecionado: {formatConnectionKind(selectedDetectedCandidate?.connectionKind)}
                    {selectedDetectedCandidate?.interfaceName
                      ? ` | ${selectedDetectedCandidate.interfaceName}`
                      : ""}
                  </p>
                  <p className="break-words">
                    IP local: {selectedDetectedCandidate?.localIpAddress ?? detectedNetwork?.localIpAddress ?? "-"} | CIDR local:{" "}
                    {selectedDetectedCandidate?.localIpv4Cidr ??
                      detectedNetwork?.localIpv4Cidr ??
                      "-"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">Identidade Wi-Fi</p>
                  {selectedDetectedCandidate?.ssid || selectedDetectedCandidate?.bssid ? (
                    <p className="break-words">
                      SSID: {selectedDetectedCandidate.ssid ?? "-"} | BSSID:{" "}
                      {selectedDetectedCandidate.bssid ?? "-"}
                    </p>
                  ) : selectedDetectedCandidate?.connectionKind === "ethernet" ? (
                    <p>Conexao cabeada detectada. SSID e BSSID nao se aplicam.</p>
                  ) : (
                    <p>SSID e BSSID nao puderam ser lidos automaticamente neste navegador.</p>
                  )}
                </div>
              </div>
            </div>
            <Button
              type="button"
              onClick={applyDetectedNetwork}
              disabled={!selectedDetectedCandidate && !detectedNetwork?.suggestedPublicIpv4Cidr}
              className="w-full sm:w-auto"
            >
              Aplicar ambiente
            </Button>
          </div>
          {detectedNetwork ? (
            <p className="mt-3 break-words text-sm text-muted-foreground">
              {detectedNetwork.notes}
            </p>
          ) : null}
          <div className="mt-4">
            <SearchableCombobox
              value={selectedDetectedCandidateId ?? ""}
              onValueChange={(value) => setSelectedDetectedCandidateId(value || null)}
              options={detectedCandidateOptions}
              placeholder="Selecione a interface"
              searchPlaceholder="Buscar interface..."
              emptyMessage="Nenhuma interface encontrada."
              disabled={detectedCandidateOptions.length === 0}
            />
          </div>

          {(detectedNetwork?.localCandidates.length ?? 0) > 0 ? (
            <div className="mt-4 grid grid-cols-1 gap-2">
              {detectedNetwork?.localCandidates.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => setSelectedDetectedCandidateId(candidate.id)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    selectedDetectedCandidateId === candidate.id
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background"
                  }`}
                >
                  <div className="space-y-2">
                    <div>
                      <p className="font-semibold">{candidate.label}</p>
                      <p className="text-sm opacity-80">
                        {formatConnectionKind(candidate.connectionKind)}
                        {candidate.interfaceName ? ` | ${candidate.interfaceName}` : ""}
                      </p>
                    </div>
                    <div className="text-sm opacity-80">
                      <p>{candidate.localIpAddress ?? "-"}</p>
                      <p>{candidate.localIpv4Cidr ?? "-"}</p>
                      {candidate.ssid || candidate.bssid ? (
                        <p>
                          {candidate.ssid ?? "-"} | {candidate.bssid ?? "-"}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
          </div>

          <div className="min-w-0 rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-col gap-3">
              <div className="space-y-1">
                <p className="inline-flex items-center gap-2 text-sm font-semibold">
                  <MapPinned className="size-4" />
                  Localizacao do equipamento
                </p>
                <p className="text-sm text-muted-foreground">
                  A geolocalizacao e capturada automaticamente para sugerir o centro da geofence
                  desta usina.
                </p>
                <p className="break-words text-sm text-muted-foreground">
                  {detectedLocation
                    ? `${detectedLocation.latitude.toFixed(6)}, ${detectedLocation.longitude.toFixed(6)}`
                    : "Localizacao ainda nao capturada"}
                </p>
                {detectedLocation?.accuracyMeters ? (
                  <p className="text-sm text-muted-foreground">
                    Precisao aproximada: {Math.round(detectedLocation.accuracyMeters)} m
                  </p>
                ) : null}
                {detectedLocation ? (
                  <p className="break-words text-sm text-muted-foreground">
                    {detectedLocation.notes}
                  </p>
                ) : null}
                {detectedLocation?.distanceMeters !== null &&
                detectedLocation?.distanceMeters !== undefined ? (
                  <p className="text-sm text-muted-foreground">
                    Distancia do centro atual: {Math.round(detectedLocation.distanceMeters)} m
                  </p>
                ) : null}
              </div>
              <div className="grid w-full gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void detectCurrentLocation({ notify: true })}
                  disabled={detectingLocation}
                >
                  <MapPinned className="mr-2 size-4" />
                  {detectingLocation ? "Capturando..." : "Atualizar localizacao"}
                </Button>
                <Button
                  type="button"
                  onClick={applyDetectedLocation}
                  disabled={!detectedLocation}
                >
                  Usar local atual
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold">Ambientes autorizados salvos</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => appendAuthorizedNetwork({ name: "Ambiente manual" })}
              className="w-full sm:w-auto"
            >
              <Plus className="mr-2 size-4" />
              Adicionar manualmente
            </Button>
          </div>

          {form.authorizedNetworks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-5 text-sm text-muted-foreground">
              Nenhum ambiente configurado ainda. A deteccao atual pode aplicar automaticamente a saida publica, a LAN local e a identidade Wi-Fi; se precisar, voce ainda pode cadastrar manualmente.
            </div>
          ) : (
            form.authorizedNetworks.map((network, index) => (
              <div
                key={`${network.id ?? "draft"}-${index}`}
                className="space-y-3 rounded-2xl border border-border bg-background p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-semibold">Ambiente #{index + 1}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAuthorizedNetwork(index)}
                    className="w-full sm:w-auto"
                  >
                    <Trash2 className="mr-2 size-4" />
                    Remover
                  </Button>
                </div>
                {networkNeedsRepair(network) ? (
                  <p className="rounded-2xl border border-amber-300/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-100">
                    Cadastro antigo/incompleto. Atualize a deteccao e salve novamente para incluir a saida publica desta usina.
                  </p>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    placeholder="Nome da rede"
                    value={network.name}
                    onChange={(event) =>
                      updateAuthorizedNetwork(index, "name", event.target.value)
                    }
                  />
                  <Input
                    placeholder="CIDR publico autorizado"
                    value={network.publicIpv4Cidr}
                    onChange={(event) =>
                      updateAuthorizedNetwork(index, "publicIpv4Cidr", event.target.value)
                    }
                  />
                  <Input
                    placeholder="CIDR local autorizado"
                    value={network.localIpv4Cidr}
                    onChange={(event) =>
                      updateAuthorizedNetwork(index, "localIpv4Cidr", event.target.value)
                    }
                  />
                  <Input
                    placeholder="SSID (opcional)"
                    value={network.ssid}
                    onChange={(event) =>
                      updateAuthorizedNetwork(index, "ssid", event.target.value)
                    }
                  />
                  <Input
                    placeholder="BSSID (opcional)"
                    value={network.bssid}
                    onChange={(event) =>
                      updateAuthorizedNetwork(index, "bssid", event.target.value)
                    }
                  />
                </div>
                <Textarea
                  placeholder="Observacoes"
                  value={network.notes}
                  onChange={(event) =>
                    updateAuthorizedNetwork(index, "notes", event.target.value)
                  }
                />
              </div>
            ))
          )}
        </div>
      </div>

      {feedback ? (
        <p className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm">
          {feedback}
        </p>
      ) : null}

    </div>
  );
}
