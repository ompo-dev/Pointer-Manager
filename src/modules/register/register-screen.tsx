"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { parseAsString, useQueryState } from "nuqs";
import {
  ArrowRightLeft,
  Camera,
  CheckCircle2,
  Clock3,
  MapPinned,
  QrCode,
  ShieldCheck,
  TriangleAlert,
  UserRound,
  Wifi,
} from "lucide-react";
import { AccessFlowBadge, RealtimeBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import {
  showErrorToast,
  showInfoToast,
  showSuccessToast,
  showWarningToast,
} from "@/lib/toast";
import { formatPersonTypeLabel } from "@/lib/utils";
import { resolveAccessMode } from "@/modules/register/access-intake";
import { RegisterSuccessCard } from "@/modules/register/register-success-card";
import { useRegisterStore } from "@/store/register-store";

function formatCpf(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function RegisterScreen() {
  const [plantToken] = useQueryState("qrToken", parseAsString);
  const plant = useRegisterStore((state) => state.plant);
  const networkStatus = useRegisterStore((state) => state.networkStatus);
  const locationStatus = useRegisterStore((state) => state.locationStatus);
  const intake = useRegisterStore((state) => state.intake);
  const receipt = useRegisterStore((state) => state.receipt);
  const form = useRegisterStore((state) => state.form);
  const location = useRegisterStore((state) => state.location);
  const feedback = useRegisterStore((state) => state.feedback);
  const loadingPlant = useRegisterStore((state) => state.loadingPlant);
  const checkingNetwork = useRegisterStore((state) => state.checkingNetwork);
  const locating = useRegisterStore((state) => state.locating);
  const checkingCpf = useRegisterStore((state) => state.checkingCpf);
  const submitting = useRegisterStore((state) => state.submitting);
  const loadPlant = useRegisterStore((state) => state.loadPlant);
  const refreshNetworkStatus = useRegisterStore(
    (state) => state.refreshNetworkStatus,
  );
  const setCpf = useRegisterStore((state) => state.setCpf);
  const setPersonType = useRegisterStore((state) => state.setPersonType);
  const setFormValue = useRegisterStore((state) => state.setFormValue);
  const lookupAccess = useRegisterStore((state) => state.lookupAccess);
  const resetForm = useRegisterStore((state) => state.resetForm);
  const submit = useRegisterStore((state) => state.submit);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    if (!plantToken) {
      return;
    }

    void loadPlant(plantToken);
  }, [loadPlant, plantToken]);

  useEffect(() => {
    if (!plantToken) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshNetworkStatus(plantToken, { captureLocation: true });
    }, 10000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [plantToken, refreshNetworkStatus]);

  const deviceLabel = useMemo(() => {
    if (typeof navigator === "undefined") {
      return "browser";
    }

    return navigator.userAgent;
  }, []);

  const requiresSelfie =
    intake?.plant.requireSelfie ?? plant?.requireSelfie ?? false;
  const requiresGeolocation =
    intake?.plant.requireGeolocation ??
    Boolean(
      plant?.geofenceLatitude !== null &&
      plant?.geofenceLatitude !== undefined &&
      plant?.geofenceLongitude !== null &&
      plant?.geofenceLongitude !== undefined &&
      plant?.geofenceRadiusMeters !== null &&
      plant?.geofenceRadiusMeters !== undefined,
    );

  const selectedPolicy = useMemo(
    () =>
      intake?.personTypePolicies.find(
        (policy) => policy.personType === form.personType,
      ) ?? null,
    [form.personType, intake],
  );
  const suggestedMode = intake
    ? resolveAccessMode(intake, {
        id: plant?.id ?? null,
        name: plant?.name ?? null,
      })
    : null;
  const knownPerson = intake?.person ?? null;
  const openEntry = intake?.openEntry ?? null;
  const knownPersonPolicy = useMemo(
    () =>
      intake?.personTypePolicies.find(
        (policy) => policy.personType === knownPerson?.personType,
      ) ?? null,
    [intake, knownPerson?.personType],
  );
  const submitLabel =
    suggestedMode === "EXIT" ? "Registrar saida" : "Registrar entrada";
  const networkBlocked =
    plant?.requireWifiMatch && networkStatus?.status === "BLOCKED";
  const locationBlocked = locationStatus?.status === "BLOCKED";
  const locationPending =
    requiresGeolocation && locationStatus?.status === "PENDING";
  const environmentReady =
    !networkBlocked &&
    !locationBlocked &&
    !locationPending &&
    (!requiresGeolocation || locationStatus?.status === "AUTHORIZED");
  const showManualEnvironmentActions = !environmentReady;
  const canSubmit =
    Boolean(intake) &&
    suggestedMode !== "BLOCKED" &&
    environmentReady &&
    (!requiresSelfie || Boolean(form.selfieUrl)) &&
    (!requiresGeolocation || Boolean(location));

  function stopCamera() {
    const stream = streamRef.current;
    if (!stream) {
      return;
    }

    stream.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  useEffect(() => {
    if (!cameraOpen) {
      stopCamera();
      return;
    }

    let cancelled = false;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Camera indisponivel neste dispositivo.");
        showErrorToast(
          "Camera indisponivel",
          "Este dispositivo ou navegador nao permite captura de selfie.",
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: {
              ideal: "user",
            },
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        setCameraError(null);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        setCameraError("Nao foi possivel abrir a camera frontal.");
        showErrorToast(
          "Falha ao abrir camera",
          "Verifique a permissao da camera e tente novamente.",
        );
        setCameraOpen(false);
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [cameraOpen]);

  useEffect(() => () => stopCamera(), []);

  if (!plantToken) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-3xl items-start px-4 py-6 sm:px-6 sm:py-10">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Usina nao informada</CardTitle>
            <CardDescription>
              Abra o QRCode oficial da usina para iniciar o registro.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="rounded-2xl border border-amber-300/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-100">
              O fluxo publico agora usa <code>?qrToken=TOKEN_DA_USINA</code> no
              endereco.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  function captureSelfie() {
    const video = videoRef.current;

    if (!video) {
      setCameraError("A camera ainda nao esta pronta.");
      showWarningToast(
        "Camera ainda nao esta pronta",
        "Aguarde alguns instantes antes de capturar a selfie.",
      );
      return;
    }

    const width = video.videoWidth || 720;
    const height = video.videoHeight || 960;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("Falha ao capturar a selfie.");
      showErrorToast(
        "Falha ao capturar selfie",
        "Nao foi possivel gerar a imagem da camera.",
      );
      return;
    }

    context.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setFormValue("selfieUrl", dataUrl);
    setCameraOpen(false);
    setCameraError(null);
    showSuccessToast(
      "Selfie capturada",
      "A foto foi anexada ao registro com sucesso.",
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl items-start px-4 py-4 sm:px-6 sm:py-8">
      <div className="grid w-full gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <Card className="overflow-hidden">
          <CardContent className="grid-paper relative min-h-[280px] p-6 sm:min-h-[360px] sm:p-8">
            <div className="absolute inset-0 bg-gradient-to-br from-background/90 via-background/70 to-transparent" />
            <div className="relative space-y-5">
              <RealtimeBadge label="QR Access" />
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Controle de acesso da usina
                </h1>
                <p className="max-w-xl text-sm leading-7 text-muted">
                  O fluxo identifica a pessoa pelo CPF, sugere entrada ou saida
                  e pede somente o que for obrigatorio para aquele perfil.
                </p>
              </div>

              <div className="rounded-[28px] border border-border/70 bg-card/80 p-5">
                <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted">
                  <QrCode className="size-4" />
                  Usina
                </p>
                <p className="mt-3 text-xl font-semibold">
                  {plant?.name ?? "Carregando..."}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {plant?.city ?? "-"} - {plant?.state ?? "-"}
                </p>
                <div className="mt-4 grid gap-2 text-sm text-foreground/80">
                  <p className="inline-flex items-center gap-2">
                    <Wifi className="size-4 text-muted" />
                    {plant?.requireWifiMatch
                      ? "Wi-Fi autorizado obrigatorio"
                      : "Rede livre"}
                  </p>
                  <p className="inline-flex items-center gap-2">
                    <Camera className="size-4 text-muted" />
                    {requiresSelfie
                      ? "Selfie obrigatoria"
                      : "Selfie nao exigida"}
                  </p>
                  <p className="inline-flex items-center gap-2">
                    <MapPinned className="size-4 text-muted" />
                    {requiresGeolocation
                      ? "Geolocalizacao obrigatoria"
                      : "Geolocalizacao nao exigida"}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-1">
                <div className="rounded-3xl border border-border/70 bg-card/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    Fluxo
                  </p>
                  <p className="mt-2 text-sm leading-6 text-foreground/80">
                    CPF, contexto da pessoa, acao sugerida e validacao de
                    seguranca.
                  </p>
                </div>
              </div>

              <div className="rounded-[28px] border border-border/70 bg-card/80 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted">
                      <ShieldCheck className="size-4" />
                      Ambiente atual
                    </p>
                    <p className="text-base font-semibold">
                      {checkingNetwork || locating
                        ? "Validando rede e localizacao"
                        : environmentReady
                          ? "Dispositivo apto para registrar"
                          : networkBlocked || locationBlocked
                            ? "Dispositivo fora da politica da usina"
                            : "Aguardando validacao completa"}
                    </p>
                    <p className="text-sm text-muted">
                      {locationBlocked || locationPending
                        ? locationStatus?.message
                        : (networkStatus?.message ??
                          "Verifique a rede e a localizacao para confirmar se este dispositivo esta autorizado.")}
                    </p>
                    <div className="space-y-1 text-sm text-foreground/80">
                      <p>
                        Conexao detectada:{" "}
                        {networkStatus?.currentNetworkName ??
                          networkStatus?.matchedNetworkName ??
                          "nao identificada"}
                      </p>
                      <p>
                        IP observado:{" "}
                        {networkStatus?.observedIp ?? "nao identificado"}
                      </p>
                      <p>
                        Rede autorizada:{" "}
                        {networkStatus?.matchedNetworkName ??
                          "sem correspondencia"}
                      </p>
                      <p>
                        Localizacao atual:{" "}
                        {location
                          ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
                          : "nao capturada"}
                      </p>
                      {locationStatus?.required ? (
                        <p>
                          Geofence:{" "}
                          {locationStatus.distanceMeters !== null &&
                          locationStatus.distanceMeters !== undefined
                            ? `${Math.round(locationStatus.distanceMeters)} m do centro`
                            : "aguardando distancia"}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      void refreshNetworkStatus(plantToken, {
                        captureLocation: true,
                        notify: true,
                      })
                    }
                    disabled={checkingNetwork || locating}
                    className={showManualEnvironmentActions ? "" : "hidden"}
                  >
                    {checkingNetwork || locating
                      ? "Atualizando..."
                      : "Atualizar ambiente"}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="py-8">
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <CardTitle>Registrar acesso</CardTitle>
              {suggestedMode ? (
                <AccessFlowBadge
                  mode={
                    suggestedMode === "EXIT"
                      ? "EXIT"
                      : suggestedMode === "BLOCKED"
                        ? "BLOCKED"
                        : "ENTRY"
                  }
                />
              ) : null}
            </div>
            <CardDescription>
              Fluxo pensado para mobile: identificar, validar e concluir em
              poucos toques.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {receipt ? (
              <RegisterSuccessCard receipt={receipt} onReset={resetForm} />
            ) : null}

            <section className="space-y-3 rounded-[28px] border border-border bg-card/80 p-4 sm:p-5">
              <div className="space-y-1">
                <p className="text-sm font-semibold">1. Identificacao</p>
                <p className="text-sm text-muted">
                  Informe o CPF para descobrir se o sistema deve abrir entrada
                  ou encerrar saida.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <Input
                  inputMode="numeric"
                  placeholder="CPF"
                  value={formatCpf(form.cpf)}
                  onChange={(event) => setCpf(event.target.value)}
                />
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  disabled={checkingCpf || loadingPlant}
                  onClick={() => void lookupAccess(plantToken)}
                >
                  {checkingCpf ? "Consultando..." : "Continuar"}
                </Button>
              </div>

              {feedback && !intake && !receipt ? (
                <p
                  className={
                    networkBlocked || locationBlocked
                      ? "rounded-2xl border border-rose-300/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-200"
                      : "rounded-2xl border border-border bg-muted/70 px-4 py-3 text-sm"
                  }
                >
                  {feedback}
                </p>
              ) : null}
            </section>

            {intake ? (
              <section className="space-y-4 rounded-[28px] border border-border bg-card/70 p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm font-semibold">2. Contexto do acesso</p>
                  {suggestedMode === "EXIT" ? (
                    <AccessFlowBadge mode="EXIT" />
                  ) : suggestedMode === "BLOCKED" ? (
                    <AccessFlowBadge mode="BLOCKED" />
                  ) : (
                    <AccessFlowBadge mode="ENTRY" />
                  )}
                </div>

                <div className="space-y-4">
                  {knownPerson ? (
                    <div className="rounded-3xl border border-border bg-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="inline-flex items-center gap-2 text-base font-semibold">
                            <UserRound className="size-4" />
                            {knownPerson.fullName}
                          </p>
                          <p className="text-sm text-muted">
                            {knownPersonPolicy?.label ??
                              formatPersonTypeLabel(knownPerson.personType)}{" "}
                            / {knownPerson.employer}
                          </p>
                        </div>
                        <CheckCircle2 className="mt-1 size-5 text-emerald-600" />
                      </div>
                      <p className="mt-3 text-sm text-foreground/80">
                        {knownPerson.jobTitle}
                      </p>
                      <p className="mt-3 text-sm text-muted">
                        Dados recuperados do ultimo cadastro. Ajuste o perfil e
                        os campos abaixo sempre que este acesso for diferente.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-3xl border border-dashed border-border bg-card p-4">
                      <p className="text-sm font-semibold">Primeiro acesso</p>
                      <p className="mt-1 text-sm text-muted">
                        Escolha o perfil e preencha somente os campos
                        obrigatorios para essa situacao.
                      </p>
                    </div>
                  )}

                  {suggestedMode === "ENTRY" ? (
                    <>
                      <div className="space-y-3">
                        <Label htmlFor="personType">Perfil da pessoa</Label>
                        <SearchableCombobox
                          value={form.personType}
                          onValueChange={(value) => setPersonType(value)}
                          options={intake.personTypePolicies.map((policy) => ({
                            value: policy.personType,
                            label: policy.label,
                            keywords: [policy.description],
                          }))}
                          placeholder="Selecione o perfil"
                          searchPlaceholder="Buscar perfil..."
                          emptyMessage="Nenhum perfil encontrado."
                        />
                        {selectedPolicy ? (
                          <p className="text-sm text-muted">
                            {selectedPolicy.description}
                          </p>
                        ) : null}
                      </div>

                      {selectedPolicy ? (
                        <div className="grid gap-3">
                          {selectedPolicy.requiredFields.map((field) => (
                            <div key={field.name} className="space-y-2">
                              <label
                                className="text-sm font-medium text-foreground"
                                htmlFor={field.name}
                              >
                                {field.label}
                              </label>
                              <Input
                                id={field.name}
                                placeholder={field.placeholder}
                                value={form[field.name]}
                                onChange={(event) =>
                                  setFormValue(field.name, event.target.value)
                                }
                              />
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>

                {openEntry ? (
                  <div className="rounded-3xl border border-border bg-card p-4">
                    <p className="inline-flex items-center gap-2 text-sm font-semibold">
                      <Clock3 className="size-4" />
                      Registro em aberto
                    </p>
                    <p className="mt-2 text-sm text-foreground/80">
                      Entrada em {formatDateTime(openEntry.openedAt)} na usina{" "}
                      <strong>{openEntry.plantName}</strong>.
                    </p>
                  </div>
                ) : null}
              </section>
            ) : null}

            {requiresSelfie && intake ? (
              <section className="space-y-4 rounded-[28px] border border-border bg-card/80 p-4 sm:p-5">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">3. Selfie de presenca</p>
                  <p className="text-sm text-muted">
                    A selfie e capturada pela camera frontal e anexada ao
                    registro.
                  </p>
                </div>

                {cameraOpen ? (
                  <div className="space-y-3">
                    <div className="overflow-hidden rounded-[28px] border border-line bg-black">
                      <video
                        ref={videoRef}
                        playsInline
                        muted
                        autoPlay
                        className="aspect-[3/4] w-full object-cover"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Button type="button" onClick={captureSelfie}>
                        <Camera className="mr-2 size-4" />
                        Capturar selfie
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setCameraOpen(false)}
                      >
                        Fechar camera
                      </Button>
                    </div>
                  </div>
                ) : form.selfieUrl ? (
                  <div className="space-y-3">
                    <img
                      src={form.selfieUrl}
                      alt="Preview da selfie"
                      className="aspect-[3/4] w-40 rounded-[28px] border border-line object-cover"
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Button type="button" onClick={() => setCameraOpen(true)}>
                        Refazer selfie
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setFormValue("selfieUrl", "");
                          showInfoToast(
                            "Selfie removida",
                            "Voce pode capturar uma nova foto antes de enviar.",
                          );
                        }}
                      >
                        Remover selfie
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button type="button" onClick={() => setCameraOpen(true)}>
                    <Camera className="mr-2 size-4" />
                    Abrir camera
                  </Button>
                )}

                {cameraError ? (
                  <p className="rounded-2xl border border-rose-300/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-200">
                    {cameraError}
                  </p>
                ) : null}
              </section>
            ) : null}

            {requiresGeolocation && (intake || showManualEnvironmentActions) ? (
              <section className="space-y-4 rounded-[28px] border border-border bg-card/80 p-4 sm:p-5">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">4. Geolocalizacao</p>
                  <p className="text-sm text-muted">
                    Esta usina exige confirmacao de localizacao. A captura
                    acontece automaticamente ao abrir esta pagina e pode ser
                    refeita aqui.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      void refreshNetworkStatus(plantToken, {
                        captureLocation: true,
                        notify: true,
                      })
                    }
                    disabled={checkingNetwork || locating}
                  >
                    <MapPinned className="mr-2 size-4" />
                    {locating ? "Capturando..." : "Atualizar localizacao"}
                  </Button>
                  <div className="rounded-2xl border border-border bg-muted/70 px-4 py-3 text-sm">
                    {location ? (
                      <div className="space-y-1">
                        <p>
                          {location.latitude.toFixed(6)},{" "}
                          {location.longitude.toFixed(6)}
                        </p>
                        {location.accuracyMeters ? (
                          <p className="text-muted">
                            Precisao aproximada:{" "}
                            {Math.round(location.accuracyMeters)} m
                          </p>
                        ) : null}
                        <p className="text-muted">{locationStatus?.message}</p>
                      </div>
                    ) : (
                      (locationStatus?.message ??
                      "Localizacao ainda nao capturada.")
                    )}
                  </div>
                </div>
              </section>
            ) : null}

            {intake ? (
              <section className="space-y-4 rounded-[28px] border border-border bg-card/80 p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                  <ShieldCheck className="size-4" />
                  {plant?.requireWifiMatch
                    ? "Rede e geolocalizacao continuam sendo validadas pelo backend ate a confirmacao final."
                    : "Acesso sem restricao de Wi-Fi para esta usina."}
                </div>

                {networkStatus ? (
                  <p
                    className={
                      networkBlocked || locationBlocked
                        ? "rounded-2xl border border-rose-300/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-200"
                        : "rounded-2xl border border-border bg-muted/70 px-4 py-3 text-sm"
                    }
                  >
                    {locationBlocked || locationPending
                      ? locationStatus?.message
                      : networkStatus.message}
                  </p>
                ) : null}

                {feedback ? (
                  <p
                    className={
                      intake.blockedReason
                        ? "rounded-2xl border border-rose-300/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-200"
                        : "rounded-2xl border border-border bg-muted/70 px-4 py-3 text-sm"
                    }
                  >
                    {intake.blockedReason ? (
                      <span className="inline-flex items-start gap-2">
                        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                        <span>{feedback}</span>
                      </span>
                    ) : (
                      feedback
                    )}
                  </p>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <Button
                    type="button"
                    className="w-full"
                    disabled={!canSubmit || submitting}
                    onClick={() =>
                      void submit({
                        plantToken,
                        deviceLabel,
                      })
                    }
                  >
                    {submitting ? (
                      "Processando..."
                    ) : (
                      <>
                        <ArrowRightLeft className="mr-2 size-4" />
                        {submitLabel}
                      </>
                    )}
                  </Button>
                  <Button type="button" variant="secondary" onClick={resetForm}>
                    Nova consulta
                  </Button>
                </div>
              </section>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
