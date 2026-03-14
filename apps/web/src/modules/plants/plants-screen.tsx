"use client";

import { useEffect, useMemo, useState } from "react";
import { parseAsString, useQueryState } from "nuqs";
import {
  Building2,
  Clock3,
  MapPinned,
  Network,
  Plus,
  QrCode,
  Router,
  Trash2,
  Wifi,
} from "lucide-react";
import { toDataURL } from "qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime, formatMinutes } from "@/lib/utils";
import { usePlantsStore } from "@/store/plants-store";

function formatConnectionKind(connectionKind?: string | null) {
  if (connectionKind === "wifi") {
    return "Wi-Fi";
  }

  if (connectionKind === "ethernet") {
    return "Cabeada";
  }

  if (connectionKind === "mobile") {
    return "Movel";
  }

  return "Nao identificado";
}

function networkNeedsRepair(network: {
  ssid?: string | null;
  bssid?: string | null;
  ipv4Cidr?: string | null;
}) {
  return !network.ssid && !network.bssid && !network.ipv4Cidr;
}

export function PlantsScreen() {
  const [search, setSearch] = useQueryState("search", parseAsString.withDefault(""));
  const [status, setStatus] = useQueryState("status", parseAsString.withDefault("ALL"));
  const [plantId, setPlantId] = useQueryState("plantId", parseAsString);
  const plants = usePlantsStore((state) => state.plants);
  const selectedPlant = usePlantsStore((state) => state.selectedPlant);
  const form = usePlantsStore((state) => state.form);
  const detectedNetwork = usePlantsStore((state) => state.detectedNetwork);
  const selectedDetectedCandidateId = usePlantsStore((state) => state.selectedDetectedCandidateId);
  const detectedLocation = usePlantsStore((state) => state.detectedLocation);
  const feedback = usePlantsStore((state) => state.feedback);
  const saving = usePlantsStore((state) => state.saving);
  const detectingNetwork = usePlantsStore((state) => state.detectingNetwork);
  const detectingLocation = usePlantsStore((state) => state.detectingLocation);
  const setFormValue = usePlantsStore((state) => state.setFormValue);
  const updateAuthorizedNetwork = usePlantsStore((state) => state.updateAuthorizedNetwork);
  const appendAuthorizedNetwork = usePlantsStore((state) => state.appendAuthorizedNetwork);
  const removeAuthorizedNetwork = usePlantsStore((state) => state.removeAuthorizedNetwork);
  const detectCurrentNetwork = usePlantsStore((state) => state.detectCurrentNetwork);
  const setSelectedDetectedCandidateId = usePlantsStore(
    (state) => state.setSelectedDetectedCandidateId,
  );
  const applyDetectedNetwork = usePlantsStore((state) => state.applyDetectedNetwork);
  const detectCurrentLocation = usePlantsStore((state) => state.detectCurrentLocation);
  const applyDetectedLocation = usePlantsStore((state) => state.applyDetectedLocation);
  const resetForm = usePlantsStore((state) => state.resetForm);
  const savePlant = usePlantsStore((state) => state.savePlant);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const selectedDetectedCandidate = useMemo(
    () =>
      detectedNetwork?.candidates.find((candidate) => candidate.id === selectedDetectedCandidateId) ??
      detectedNetwork?.candidates.find((candidate) => candidate.isCurrent) ??
      detectedNetwork?.candidates[0] ??
      null,
    [detectedNetwork, selectedDetectedCandidateId],
  );

  useEffect(() => {
    if (!plantId && plants[0]?.id) {
      void setPlantId(plants[0].id);
    }
  }, [plantId, plants, setPlantId]);

  useEffect(() => {
    async function generateQrCode() {
      if (!selectedPlant?.qrToken) {
        setQrCodeUrl("");
        return;
      }

      const origin =
        typeof window !== "undefined"
          ? window.location.origin
          : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const registerUrl = `${origin}/register?uuid=${selectedPlant.id}`;
      const dataUrl = await toDataURL(registerUrl, {
        margin: 1,
        width: 180,
      });
      setQrCodeUrl(dataUrl);
    }

    void generateQrCode();
  }, [selectedPlant?.qrToken]);

  useEffect(() => {
    void detectCurrentNetwork();
    void detectCurrentLocation();
  }, [detectCurrentLocation, detectCurrentNetwork, plantId]);

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Usinas</CardTitle>
            <CardDescription>
              Cadastro, QRCode, redes autorizadas, geofence e politicas de fechamento.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
              <Input
                value={search}
                onChange={(event) => void setSearch(event.target.value)}
                placeholder="Buscar por nome, cidade ou codigo"
              />
              <Select value={status} onChange={(event) => void setStatus(event.target.value)}>
                <option value="ALL">Todos os status</option>
                <option value="ACTIVE">Ativa</option>
                <option value="INACTIVE">Inativa</option>
              </Select>
            </div>

            <div className="space-y-3">
              {plants.map((plant) => (
                <button
                  key={plant.id}
                  type="button"
                  onClick={() => void setPlantId(plant.id)}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                    plantId === plant.id
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card"
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold">{plant.name}</p>
                      <p className="text-sm opacity-80">
                        {plant.city} - {plant.state}
                      </p>
                    </div>
                    <div className="text-left text-sm sm:text-right">
                      <p>{plant._count?.employees ?? 0} pessoas</p>
                      <p>{plant._count?.timeEntries ?? 0} acessos abertos</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{form.id ? "Editar usina" : "Nova usina"}</CardTitle>
            <CardDescription>
              Politica da usina, QRCode e redes autorizadas com deteccao do equipamento atual.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                placeholder="Codigo"
                value={form.code}
                onChange={(event) => setFormValue("code", event.target.value)}
              />
              <Input
                placeholder="Nome"
                value={form.name}
                onChange={(event) => setFormValue("name", event.target.value)}
              />
              <Input
                placeholder="Cidade"
                value={form.city}
                onChange={(event) => setFormValue("city", event.target.value)}
              />
              <Input
                placeholder="Estado"
                value={form.state}
                onChange={(event) => setFormValue("state", event.target.value)}
              />
              <Input
                type="time"
                value={form.openingHour}
                onChange={(event) => setFormValue("openingHour", event.target.value)}
              />
              <Input
                type="time"
                value={form.closingHour}
                onChange={(event) => setFormValue("closingHour", event.target.value)}
              />
              <Input
                placeholder="QR token"
                value={form.qrToken}
                onChange={(event) => setFormValue("qrToken", event.target.value)}
              />
              <Input
                placeholder="Auto-close em horas"
                value={form.autoCloseLimitHours}
                onChange={(event) => setFormValue("autoCloseLimitHours", event.target.value)}
              />
              <Input
                placeholder="Alerta em minutos"
                value={form.lateAlertMinutes}
                onChange={(event) => setFormValue("lateAlertMinutes", event.target.value)}
              />
              <Select
                value={form.requireWifiMatch}
                onChange={(event) => setFormValue("requireWifiMatch", event.target.value)}
              >
                <option value="true">Exigir rede autorizada</option>
                <option value="false">Nao exigir rede</option>
              </Select>
              <Select
                value={form.requireSelfie}
                onChange={(event) => setFormValue("requireSelfie", event.target.value)}
              >
                <option value="false">Selfie opcional</option>
                <option value="true">Selfie obrigatoria</option>
              </Select>
              <Input
                placeholder="Latitude geofence"
                value={form.geofenceLatitude}
                onChange={(event) => setFormValue("geofenceLatitude", event.target.value)}
              />
              <Input
                placeholder="Longitude geofence"
                value={form.geofenceLongitude}
                onChange={(event) => setFormValue("geofenceLongitude", event.target.value)}
              />
              <Input
                placeholder="Raio geofence (m)"
                value={form.geofenceRadiusMeters}
                onChange={(event) => setFormValue("geofenceRadiusMeters", event.target.value)}
              />
            </div>

            <div className="space-y-4 rounded-2xl border border-border bg-muted/20 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">Rede autorizada da usina</p>
                  <p className="text-sm text-muted-foreground">
                    O sistema detecta automaticamente a rede ativa do equipamento e aplica a
                    configuracao atual na ficha da usina.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void detectCurrentNetwork()}
                  disabled={detectingNetwork}
                >
                  <Wifi className="mr-2 size-4" />
                  {detectingNetwork ? "Detectando..." : "Atualizar deteccao"}
                </Button>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="inline-flex items-center gap-2 text-sm font-semibold">
                      <Router className="size-4" />
                      Interface detectada
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Tipo selecionado: {formatConnectionKind(selectedDetectedCandidate?.connectionKind)}
                      {selectedDetectedCandidate?.interfaceName
                        ? ` | ${selectedDetectedCandidate.interfaceName}`
                        : ""}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      IP: {selectedDetectedCandidate?.ipAddress ?? detectedNetwork?.ipAddress ?? "-"}{" "}
                      | CIDR:{" "}
                      {selectedDetectedCandidate?.suggestedIpv4Cidr ??
                        detectedNetwork?.suggestedIpv4Cidr ??
                        "-"}
                    </p>
                    {selectedDetectedCandidate?.ssid || selectedDetectedCandidate?.bssid ? (
                      <p className="text-sm text-muted-foreground">
                        SSID: {selectedDetectedCandidate.ssid ?? "-"} | BSSID:{" "}
                        {selectedDetectedCandidate.bssid ?? "-"}
                      </p>
                    ) : selectedDetectedCandidate?.connectionKind === "ethernet" ? (
                      <p className="text-sm text-muted-foreground">
                        Conexao cabeada detectada. SSID e BSSID nao se aplicam.
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    onClick={applyDetectedNetwork}
                    disabled={!selectedDetectedCandidate}
                  >
                    Aplicar novamente
                  </Button>
                </div>
                {detectedNetwork ? (
                  <p className="mt-3 text-sm text-muted-foreground">{detectedNetwork.notes}</p>
                ) : null}
                <div className="mt-4">
                  <Select
                    value={selectedDetectedCandidateId ?? ""}
                    onChange={(event) =>
                      setSelectedDetectedCandidateId(event.target.value || null)
                    }
                  >
                    <option value="">Selecione a interface</option>
                    {(detectedNetwork?.candidates ?? []).map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.label}
                      </option>
                    ))}
                  </Select>
                </div>

                {(detectedNetwork?.candidates.length ?? 0) > 0 ? (
                  <div className="mt-4 space-y-2">
                    {detectedNetwork?.candidates.map((candidate) => (
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
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-semibold">{candidate.label}</p>
                            <p className="text-sm opacity-80">
                              {formatConnectionKind(candidate.connectionKind)}
                              {candidate.interfaceName ? ` | ${candidate.interfaceName}` : ""}
                            </p>
                          </div>
                          <div className="text-left text-sm sm:text-right">
                            <p>{candidate.ipAddress ?? "-"}</p>
                            <p>{candidate.suggestedIpv4Cidr ?? "-"}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="inline-flex items-center gap-2 text-sm font-semibold">
                      <MapPinned className="size-4" />
                      Localizacao do equipamento
                    </p>
                    <p className="text-sm text-muted-foreground">
                      A geolocalizacao e capturada automaticamente para sugerir o centro da
                      geofence desta usina.
                    </p>
                    <p className="text-sm text-muted-foreground">
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
                      <p className="text-sm text-muted-foreground">{detectedLocation.notes}</p>
                    ) : null}
                    {detectedLocation?.distanceMeters !== null &&
                    detectedLocation?.distanceMeters !== undefined ? (
                      <p className="text-sm text-muted-foreground">
                        Distancia do centro atual: {Math.round(detectedLocation.distanceMeters)} m
                      </p>
                    ) : null}
                  </div>
                  <div className="grid gap-2 sm:min-w-[220px]">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void detectCurrentLocation()}
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

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">Redes autorizadas salvas</p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => appendAuthorizedNetwork({ name: "Rede manual" })}
                  >
                    <Plus className="mr-2 size-4" />
                    Adicionar manualmente
                  </Button>
                </div>

                {form.authorizedNetworks.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-5 text-sm text-muted-foreground">
                    Nenhuma rede configurada ainda. A conexao atual e aplicada automaticamente; se
                    precisar, voce ainda pode adicionar uma rede manual.
                  </div>
                ) : (
                  form.authorizedNetworks.map((network, index) => (
                    <div
                      key={`${network.id ?? "draft"}-${index}`}
                      className="space-y-3 rounded-2xl border border-border bg-background p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold">Rede #{index + 1}</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAuthorizedNetwork(index)}
                        >
                          <Trash2 className="mr-2 size-4" />
                          Remover
                        </Button>
                      </div>
                      {networkNeedsRepair(network) ? (
                        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                          Cadastro antigo/incompleto. A deteccao automatica corrige isso ao abrir
                          a ficha; se necessario, atualize a deteccao e salve novamente.
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
                          placeholder="IPv4/CIDR autorizado"
                          value={network.ipv4Cidr}
                          onChange={(event) =>
                            updateAuthorizedNetwork(index, "ipv4Cidr", event.target.value)
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
                      <Input
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

            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                className="w-full"
                onClick={async () => {
                  const savedId = await savePlant();
                  if (savedId) {
                    void setPlantId(savedId);
                  }
                }}
                disabled={saving}
              >
                {saving ? "Salvando..." : "Salvar usina"}
              </Button>
              <Button
                className="w-full"
                variant="secondary"
                onClick={() => {
                  resetForm();
                  void setPlantId(null);
                }}
              >
                Nova ficha
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {selectedPlant ? (
        <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Operacao da usina</CardTitle>
              <CardDescription>{selectedPlant.name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">QRCode</p>
                  <p className="mt-2 font-mono text-sm">{selectedPlant.qrToken}</p>
                  <a
                    href={`/register?uuid=${selectedPlant.id}`}
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
                      className="mt-4 h-40 w-40 rounded-2xl border border-border bg-white p-2"
                    />
                  ) : (
                    <QrCode className="mt-3 size-5 text-muted-foreground" />
                  )}
                </div>
                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Horario</p>
                  <p className="mt-2 inline-flex items-center gap-2 text-sm">
                    <Clock3 className="size-4 text-muted-foreground" />
                    {selectedPlant.openingHour} - {selectedPlant.closingHour}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Politica</p>
                  <p className="mt-2 text-sm">
                    Wi-Fi: {selectedPlant.requireWifiMatch ? "obrigatorio" : "livre"} | Selfie:{" "}
                    {selectedPlant.requireSelfie ? "obrigatoria" : "opcional"}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Limites</p>
                  <p className="mt-2 text-sm">
                    Auto-close: {selectedPlant.autoCloseLimitHours}h | Alerta:{" "}
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
                  {selectedPlant.authorizedNetworks.map((network) => (
                    <div
                      key={`${network.name}-${network.ssid ?? network.ipv4Cidr ?? "network"}`}
                      className="rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                    >
                      <p className="font-semibold">{network.name}</p>
                      {networkNeedsRepair(network) ? (
                        <p className="break-words text-amber-700">
                          Cadastro antigo/incompleto. Atualize a deteccao automatica e salve a
                          usina novamente para corrigir a rede.
                        </p>
                      ) : (
                        <p className="break-words text-muted-foreground">
                          {network.ssid || network.bssid
                            ? `${network.ssid || "-"} | ${network.bssid || "-"} | ${network.ipv4Cidr || "-"}`
                            : `Conexao cabeada ou sem identificacao Wi-Fi | ${network.ipv4Cidr || "-"}`}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Presenca e historico</CardTitle>
              <CardDescription>
                Pessoas presentes agora e os ultimos registros dessa usina.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <p className="mb-3 inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  <Building2 className="size-4" />
                  Presentes agora
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pessoa</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Entrada</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedPlant.presentPeople.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-sm text-muted-foreground">
                          Ninguem presente nesta usina.
                        </TableCell>
                      </TableRow>
                    ) : (
                      selectedPlant.presentPeople.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>
                            <p className="font-semibold">{entry.employee.fullName}</p>
                            <p className="text-sm text-muted-foreground">{entry.employee.cpf}</p>
                          </TableCell>
                          <TableCell>{entry.employee.personType}</TableCell>
                          <TableCell>{formatDateTime(entry.openedAt)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div>
                <p className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Historico recente
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pessoa</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Horas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedPlant.history.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <p className="font-semibold">{entry.employee.fullName}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDateTime(entry.openedAt)}
                          </p>
                        </TableCell>
                        <TableCell>{entry.status}</TableCell>
                        <TableCell>{formatMinutes(entry.totalMinutes ?? 0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
