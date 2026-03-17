const personTypeLabels: Record<string, string> = {
  EMPLOYEE: "Funcionario(a)",
  CONTRACTOR: "Terceirizado(a)",
  VISITOR: "Visitante",
  SUPERVISOR: "Supervisor(a)",
  SERVICE_PROVIDER: "Prestador(a)",
  OTHER: "Outro",
};

const userRoleLabels: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Administrador",
  PLANT_SUPERVISOR: "Supervisor de Usina",
  OPERACAO: "Operacao",
};

const activeStatusLabels: Record<string, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  LEAVE: "Afastado",
  BLOCKED: "Bloqueado",
  UNKNOWN: "Desconhecido",
};

const timeEntryStatusLabels: Record<string, string> = {
  OPEN: "Aberto",
  CLOSED: "Finalizado",
  ADJUSTED: "Ajustado",
  AUTO_CLOSED: "Auto fechado",
  UNKNOWN: "Desconhecido",
};

const modulePermissionLabels: Record<string, string> = {
  dashboard: "Dashboard",
  plants: "Usinas",
  people: "Pessoas",
  "time-entries": "Registros",
  reports: "Relatorios",
  access: "Usuarios",
  audit: "Auditoria",
};

const validationModeLabels: Record<string, string> = {
  network: "Rede autorizada",
  "network+geofence": "Rede autorizada + geolocalizacao",
  geofence: "Geolocalizacao",
  selfie: "Selfie",
  cellular: "Rede movel",
};

const timeEntryOriginLabels: Record<string, string> = {
  QR_CODE: "QRCode publico",
  PANEL: "Painel administrativo",
  MANUAL_ADJUSTMENT: "Ajuste manual",
  AUTO_CLOSED: "Fechamento automatico",
};

function titleCaseLabel(value: string) {
  return value
    .replace(/\+/g, " + ")
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatMappedLabel(
  value: string | null | undefined,
  labels: Record<string, string>,
) {
  if (!value) {
    return "-";
  }

  return labels[value] ?? titleCaseLabel(value);
}

export function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatDateOnly(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(new Date(value));
}

export function formatMinutes(value?: number | null) {
  if (!value || value <= 0) {
    return "0h 00m";
  }

  const hours = Math.floor(value / 60);
  const minutes = value % 60;

  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

export function formatPersonTypeLabel(value?: string | null) {
  return formatMappedLabel(value, personTypeLabels);
}

export function formatUserRoleLabel(value?: string | null) {
  return formatMappedLabel(value, userRoleLabels);
}

export function formatActiveStatusLabel(value?: string | null) {
  return formatMappedLabel(value, activeStatusLabels);
}

export function formatTimeEntryStatusLabel(value?: string | null) {
  return formatMappedLabel(value, timeEntryStatusLabels);
}

export function formatModulePermissionLabel(value?: string | null) {
  return formatMappedLabel(value, modulePermissionLabels);
}

export function formatValidationModeLabel(value?: string | null) {
  return formatMappedLabel(value, validationModeLabels);
}

export function formatTimeEntryOriginLabel(value?: string | null) {
  return formatMappedLabel(value, timeEntryOriginLabels);
}
