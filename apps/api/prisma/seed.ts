import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import {
  AccessProfileStatus,
  EntryOrigin,
  PersonType,
  Prisma,
  PrismaClient,
  TimeEntryStatus,
  UserRole,
  UserStatus,
  type AccessProfile,
  type Plant,
  type User,
} from "@prisma/client";

const prisma = new PrismaClient();

const timezoneOffset = "-03:00";
const referenceDay = "2026-03-17";
const referenceMoment = new Date(`${referenceDay}T13:30:00${timezoneOffset}`);
const fullModuleSet = [
  "dashboard",
  "plants",
  "people",
  "time-entries",
  "reports",
  "access",
  "audit",
] as const;

type ModulePermission = (typeof fullModuleSet)[number];

type PlantSeed = {
  code: string;
  name: string;
  city: string;
  state: string;
  openingHour: string;
  closingHour: string;
  qrToken: string;
  status: "ACTIVE" | "INACTIVE";
  requireWifiMatch: boolean;
  requireSelfie: boolean;
  autoCloseLimitHours: number;
  lateAlertMinutes: number;
  geofenceLatitude?: number;
  geofenceLongitude?: number;
  geofenceRadiusMeters?: number;
  authorizedNetworks: Array<{
    name: string;
    publicIpv4Cidr?: string;
    localIpv4Cidr?: string;
    ssid?: string;
    bssid?: string;
    notes?: string;
    isActive?: boolean;
  }>;
};

type UserSeed = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  status?: UserStatus;
  plantCode?: string;
  modulePermissions: ModulePermission[];
  lastLoginAt?: Date;
};

type ProfileSeed = {
  cpf: string;
  fullName: string;
  homePlantCode: string;
  personType: PersonType;
  employer: string;
  jobTitle: string;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
  notes: string | null;
  status: AccessProfileStatus;
};

type OrganizationSeed = {
  code: string;
  name: string;
  domain: string;
  plants: PlantSeed[];
  users: UserSeed[];
  generatedProfiles: ProfileSeed[];
};

type CreatedOrganizationContext = {
  organizationId: string;
  organizationCode: string;
  organizationName: string;
  plantsByCode: Map<
    string,
    Plant & {
      authorizedNetworks: Array<{
        ssid: string | null;
        bssid: string | null;
        publicIpv4Cidr: string | null;
        localIpv4Cidr: string | null;
      }>;
    }
  >;
  usersByEmail: Map<string, User>;
  profiles: Array<AccessProfile & { person: { id: string; cpf: string; fullName: string } }>;
};

type SharedProfileSeed = {
  cpf: string;
  fullName: string;
  photoUrl: string | null;
  profiles: Array<{
    organizationCode: string;
    homePlantCode: string;
    personType: PersonType;
    employer: string;
    jobTitle: string;
    email: string | null;
    phone: string | null;
    notes: string | null;
    status: AccessProfileStatus;
  }>;
};

type DemoEntrySeed = Prisma.TimeEntryCreateManyInput;
type DemoAuditSeed = Prisma.AuditLogCreateManyInput;
type DemoRealtimeSeed = Prisma.RealtimeEventCreateManyInput;

function localDate(day: string, time: string) {
  return new Date(`${day}T${time}:00${timezoneOffset}`);
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function formatDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildDaySeries(length: number) {
  return Array.from({ length }, (_, index) => formatDay(addDays(referenceMoment, -index))).reverse();
}

function buildCpf(seed: number) {
  return (70000000000n + BigInt(seed)).toString();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildEmail(fullName: string, domain: string) {
  return `${slugify(fullName).replace(/-/g, ".")}@${domain}`;
}

function buildPhone(seed: number) {
  const firstBlock = (90000 + seed).toString().slice(-5);
  const secondBlock = (1000 + ((seed * 37) % 9000)).toString().slice(-4);
  return `+55 87 9${firstBlock}-${secondBlock}`;
}

function buildPhotoUrl(fullName: string) {
  return `https://cdn.point-manager.local/demo/${slugify(fullName)}.jpg`;
}

function buildIpFromCidr(cidr: string | null | undefined, host: number) {
  if (!cidr) {
    return null;
  }

  const [network] = cidr.split("/");
  const parts = network.split(".");

  if (parts.length !== 4) {
    return null;
  }

  return `${parts[0]}.${parts[1]}.${parts[2]}.${host}`;
}

function createGeneratedProfiles(
  names: string[],
  options: {
    cpfOffset: number;
    domain: string;
    organizationName: string;
    plantCodes: string[];
  },
) {
  const contractorEmployers = ["Mandacaru Montagens", "Aurora Engenharia", "Sertao Obras Industriais"];
  const serviceEmployers = ["SafeGrid Inspecoes", "TecGrid Servicos", "Nordeste Manutencao Especial"];
  const employeeJobs = ["Eletricista de Campo", "Tecnico de Operacao", "Analista de O&M", "Operador de Planta", "Tecnico de Instrumentacao"];
  const contractorJobs = ["Montador Eletromecanico", "Encarregado Civil", "Tecnico de Cabeamento"];
  const serviceJobs = ["Inspetor Termografico", "Tecnico de String Box", "Especialista em Tracker"];
  const visitorJobs = ["Auditoria de Cliente", "Visita Tecnica", "Acompanhamento de Fornecedor"];
  const supervisorJobs = ["Supervisor de Campo", "Supervisor de Operacao"];
  const otherJobs = ["Apoio Operacional", "Logistica de Canteiro"];
  const typeRotation: PersonType[] = [
    PersonType.EMPLOYEE,
    PersonType.EMPLOYEE,
    PersonType.EMPLOYEE,
    PersonType.CONTRACTOR,
    PersonType.SERVICE_PROVIDER,
    PersonType.EMPLOYEE,
    PersonType.SUPERVISOR,
    PersonType.EMPLOYEE,
    PersonType.VISITOR,
    PersonType.OTHER,
  ];

  return names.map((fullName, index) => {
    const personType = typeRotation[index % typeRotation.length];
    const homePlantCode = options.plantCodes[index % options.plantCodes.length];
    const status =
      personType === PersonType.VISITOR
        ? AccessProfileStatus.ACTIVE
        : (index + 1) % 17 === 0
          ? AccessProfileStatus.LEAVE
          : (index + 1) % 13 === 0
            ? AccessProfileStatus.INACTIVE
            : AccessProfileStatus.ACTIVE;
    const employer =
      personType === PersonType.EMPLOYEE || personType === PersonType.SUPERVISOR
        ? options.organizationName
        : personType === PersonType.CONTRACTOR
          ? contractorEmployers[index % contractorEmployers.length]
          : personType === PersonType.SERVICE_PROVIDER
            ? serviceEmployers[index % serviceEmployers.length]
            : personType === PersonType.VISITOR
              ? "Visitante"
              : "Apoio Operacional";
    const jobTitle =
      personType === PersonType.EMPLOYEE
        ? employeeJobs[index % employeeJobs.length]
        : personType === PersonType.CONTRACTOR
          ? contractorJobs[index % contractorJobs.length]
          : personType === PersonType.SERVICE_PROVIDER
            ? serviceJobs[index % serviceJobs.length]
            : personType === PersonType.VISITOR
              ? visitorJobs[index % visitorJobs.length]
              : personType === PersonType.SUPERVISOR
                ? supervisorJobs[index % supervisorJobs.length]
                : otherJobs[index % otherJobs.length];
    const cpf = buildCpf(options.cpfOffset + index + 1);
    const email =
      personType === PersonType.VISITOR && index % 2 === 0
        ? null
        : buildEmail(fullName, options.domain);
    const notes =
      status === AccessProfileStatus.LEAVE
        ? `Afastado desde 05/03/2026 por pausa operacional da equipe ${homePlantCode}.`
        : status === AccessProfileStatus.INACTIVE
          ? "Cadastro mantido apenas para historico e auditoria."
          : personType === PersonType.VISITOR
            ? "Visitante recorrente com liberacao validada por recepcao."
            : personType === PersonType.SERVICE_PROVIDER
              ? "Prestador homologado para atividades criticas."
              : null;

    return {
      cpf,
      fullName,
      homePlantCode,
      personType,
      employer,
      jobTitle,
      email,
      phone: buildPhone(options.cpfOffset + index + 1),
      photoUrl: buildPhotoUrl(fullName),
      notes,
      status,
    } satisfies ProfileSeed;
  });
}

const organizationSeeds: OrganizationSeed[] = [
  {
    code: "solar-client",
    name: "Cliente Solar Nordeste",
    domain: "cliente-solar.com",
    plants: [
      {
        code: "usina-norte-01",
        name: "Usina Norte 01",
        city: "Petrolina",
        state: "PE",
        openingHour: "06:00",
        closingHour: "18:00",
        qrToken: "qr-usina-norte-01-2026",
        status: "ACTIVE",
        requireWifiMatch: true,
        requireSelfie: false,
        autoCloseLimitHours: 14,
        lateAlertMinutes: 120,
        authorizedNetworks: [
          { name: "WiFi Operacao Norte", publicIpv4Cidr: "203.0.113.11/32", localIpv4Cidr: "10.11.0.0/24", ssid: "USINA_NORTE_01", bssid: "AA:01:10:00:00:01", notes: "Rede principal de operacao e acesso QR." },
          { name: "Rede Cabeada Norte", publicIpv4Cidr: "203.0.113.11/32", localIpv4Cidr: "10.11.10.0/24", notes: "Backoffice e sala eletrica." },
        ],
      },
      {
        code: "usina-leste-02",
        name: "Usina Leste 02",
        city: "Juazeiro",
        state: "BA",
        openingHour: "06:00",
        closingHour: "18:00",
        qrToken: "qr-usina-leste-02-2026",
        status: "ACTIVE",
        requireWifiMatch: true,
        requireSelfie: true,
        autoCloseLimitHours: 12,
        lateAlertMinutes: 150,
        geofenceLatitude: -9.414258,
        geofenceLongitude: -40.503998,
        geofenceRadiusMeters: 250,
        authorizedNetworks: [
          { name: "WiFi Operacao Leste", publicIpv4Cidr: "203.0.113.12/32", localIpv4Cidr: "10.12.0.0/24", ssid: "USINA_LESTE_02", bssid: "AA:01:20:00:00:02", notes: "Rede validada para operacao com selfie obrigatoria." },
          { name: "Rede Cabeada Leste", publicIpv4Cidr: "203.0.113.12/32", localIpv4Cidr: "10.12.20.0/24", notes: "Sala de controle e supervisao." },
        ],
      },
      {
        code: "usina-sertao-03",
        name: "Usina Sertao 03",
        city: "Casa Nova",
        state: "BA",
        openingHour: "05:30",
        closingHour: "17:30",
        qrToken: "qr-usina-sertao-03-2026",
        status: "ACTIVE",
        requireWifiMatch: true,
        requireSelfie: false,
        autoCloseLimitHours: 10,
        lateAlertMinutes: 110,
        geofenceLatitude: -9.165,
        geofenceLongitude: -40.97,
        geofenceRadiusMeters: 350,
        authorizedNetworks: [
          { name: "WiFi Operacao Sertao", publicIpv4Cidr: "203.0.113.13/32", localIpv4Cidr: "10.13.0.0/24", ssid: "USINA_SERTAO_03", bssid: "AA:01:30:00:00:03", notes: "Rede de equipes de manutencao pesada." },
          { name: "Rede Cabeada Sertao", publicIpv4Cidr: "203.0.113.13/32", localIpv4Cidr: "10.13.30.0/24", notes: "Backbone interno do site." },
        ],
      },
      {
        code: "usina-vale-04",
        name: "Usina Vale 04",
        city: "Salgueiro",
        state: "PE",
        openingHour: "07:00",
        closingHour: "19:00",
        qrToken: "qr-usina-vale-04-2026",
        status: "ACTIVE",
        requireWifiMatch: false,
        requireSelfie: false,
        autoCloseLimitHours: 16,
        lateAlertMinutes: 240,
        authorizedNetworks: [
          { name: "WiFi Administrativo Vale", publicIpv4Cidr: "203.0.113.14/32", localIpv4Cidr: "10.14.0.0/24", ssid: "USINA_VALE_04", bssid: "AA:01:40:00:00:04", notes: "Rede opcional, sem obrigatoriedade de match." },
        ],
      },
    ],
    users: [
      { name: "Super Admin Cliente Solar", email: "super.admin@cliente-solar.com", password: "Pm!SuperAdmin2026", role: UserRole.SUPER_ADMIN, modulePermissions: [...fullModuleSet], lastLoginAt: localDate(referenceDay, "12:48") },
      { name: "Administrador Operacional", email: "admin@cliente-solar.com", password: "Pm!Admin2026", role: UserRole.ADMIN, modulePermissions: [...fullModuleSet], lastLoginAt: localDate(referenceDay, "12:15") },
      { name: "Analista de Relatorios", email: "relatorios@cliente-solar.com", password: "Pm!Relatorios2026", role: UserRole.ADMIN, modulePermissions: ["dashboard", "people", "reports", "audit"], lastLoginAt: localDate(referenceDay, "11:25") },
      { name: "Supervisor Usina Norte 01", email: "supervisor.norte01@cliente-solar.com", password: "Pm!Supervisor2026", role: UserRole.PLANT_SUPERVISOR, plantCode: "usina-norte-01", modulePermissions: ["dashboard", "plants", "people", "time-entries", "reports"], lastLoginAt: localDate(referenceDay, "10:52") },
      { name: "Supervisor Usina Leste 02", email: "supervisor.leste02@cliente-solar.com", password: "Pm!SupervisorLeste2026", role: UserRole.PLANT_SUPERVISOR, plantCode: "usina-leste-02", modulePermissions: ["dashboard", "plants", "people", "time-entries", "reports"], lastLoginAt: localDate(referenceDay, "10:40") },
      { name: "Administrador Inativo", email: "admin.inativo@cliente-solar.com", password: "Pm!AdminInativo2026", role: UserRole.ADMIN, status: UserStatus.INACTIVE, modulePermissions: ["dashboard", "reports"] },
    ],
    generatedProfiles: createGeneratedProfiles(
      [
        "Joao Pedro Lima", "Mariana Araujo Costa", "Carlos Eduardo Nascimento", "Ana Beatriz Moura", "Rafael Alves Diniz",
        "Camila Freitas Rocha", "Diego Santana Barros", "Larissa Moraes Brito", "Tiago Henrique Souza", "Paula Cristina Teles",
        "Fernando Vieira Melo", "Bianca Ribeiro Couto", "Mateus Cardoso Pires", "Juliana Dias Falcao", "Rodrigo Monteiro Sales",
        "Leticia Barreto Neves", "Vinicius Gomes Prado", "Sara Oliveira Batista", "Bruno Carvalho Reis", "Isabela Matos Fonseca",
        "Gustavo Freire Coelho", "Patricia Dantas Leal", "Leonardo Azevedo Campos", "Vanessa Nogueira Mota", "Caio Martins Aguiar",
        "Renata Queiroz Pacheco", "Danilo Peixoto Tavares", "Alice Sampaio Lacerda", "Ricardo Medeiros Braga", "Tatiane Barreto Lima",
      ],
      {
        cpfOffset: 1000,
        domain: "cliente-solar.com",
        organizationName: "Cliente Solar Nordeste",
        plantCodes: ["usina-norte-01", "usina-leste-02", "usina-sertao-03", "usina-vale-04"],
      },
    ),
  },
  {
    code: "energia-horizonte-2026",
    name: "Energia Horizonte",
    domain: "energia-horizonte.com",
    plants: [
      {
        code: "usina-ponte-01",
        name: "Usina Ponte 01",
        city: "Barreiras",
        state: "BA",
        openingHour: "06:00",
        closingHour: "18:00",
        qrToken: "qr-usina-ponte-01-2026",
        status: "ACTIVE",
        requireWifiMatch: true,
        requireSelfie: false,
        autoCloseLimitHours: 12,
        lateAlertMinutes: 140,
        authorizedNetworks: [
          { name: "WiFi Operacao Ponte", publicIpv4Cidr: "203.0.113.21/32", localIpv4Cidr: "10.21.0.0/24", ssid: "USINA_PONTE_01", bssid: "BB:02:10:00:00:01", notes: "Rede principal da usina ponte." },
        ],
      },
      {
        code: "usina-sul-02",
        name: "Usina Sul 02",
        city: "Bom Jesus da Lapa",
        state: "BA",
        openingHour: "06:30",
        closingHour: "18:30",
        qrToken: "qr-usina-sul-02-2026",
        status: "ACTIVE",
        requireWifiMatch: true,
        requireSelfie: true,
        autoCloseLimitHours: 13,
        lateAlertMinutes: 180,
        geofenceLatitude: -13.257,
        geofenceLongitude: -43.411,
        geofenceRadiusMeters: 300,
        authorizedNetworks: [
          { name: "WiFi Operacao Sul", publicIpv4Cidr: "203.0.113.22/32", localIpv4Cidr: "10.22.0.0/24", ssid: "USINA_SUL_02", bssid: "BB:02:20:00:00:02", notes: "Rede da operacao com selfie obrigatoria." },
          { name: "Rede Cabeada Sul", publicIpv4Cidr: "203.0.113.22/32", localIpv4Cidr: "10.22.20.0/24", notes: "Sala de automacao." },
        ],
      },
    ],
    users: [
      { name: "Super Admin Energia Horizonte", email: "super.admin@energia-horizonte.com", password: "Pm!HorizonteSuper2026", role: UserRole.SUPER_ADMIN, modulePermissions: [...fullModuleSet], lastLoginAt: localDate(referenceDay, "12:20") },
      { name: "Administrador Horizonte", email: "admin@energia-horizonte.com", password: "Pm!HorizonteAdmin2026", role: UserRole.ADMIN, modulePermissions: ["dashboard", "plants", "people", "time-entries", "reports", "audit"], lastLoginAt: localDate(referenceDay, "11:10") },
      { name: "Supervisor Ponte 01", email: "supervisor.ponte01@energia-horizonte.com", password: "Pm!HorizonteSupervisor2026", role: UserRole.PLANT_SUPERVISOR, plantCode: "usina-ponte-01", modulePermissions: ["dashboard", "plants", "people", "time-entries", "reports"], lastLoginAt: localDate(referenceDay, "09:55") },
    ],
    generatedProfiles: createGeneratedProfiles(
      [
        "Helena Prado Melo", "Igor Tavares Nunes", "Karen Rocha Bessa", "Samuel Duarte Leite", "Nadia Cunha Ramos",
        "Otavio Nogueira Silva", "Priscila Amaral Diniz", "Tiago Fernandes Lopes", "Monica Freire Teles", "Gabriel Medeiros Paz",
        "Aline Duarte Maciel", "Cesar Pacheco Araujo", "Fabiana Ribeiro Luz", "Yuri Soares Campos",
      ],
      {
        cpfOffset: 2000,
        domain: "energia-horizonte.com",
        organizationName: "Energia Horizonte",
        plantCodes: ["usina-ponte-01", "usina-sul-02"],
      },
    ),
  },
];

const sharedProfileSeeds: SharedProfileSeed[] = [
  {
    cpf: buildCpf(3001),
    fullName: "Rita Nogueira Campos",
    photoUrl: buildPhotoUrl("Rita Nogueira Campos"),
    profiles: [
      { organizationCode: "solar-client", homePlantCode: "usina-leste-02", personType: PersonType.SERVICE_PROVIDER, employer: "SafeGrid Inspecoes", jobTitle: "Inspetora Termografica", email: "rita.campos@safegrid.com", phone: buildPhone(3001), notes: "Prestadora compartilhada entre grupos de usinas do Vale do Sao Francisco.", status: AccessProfileStatus.ACTIVE },
      { organizationCode: "energia-horizonte-2026", homePlantCode: "usina-ponte-01", personType: PersonType.SERVICE_PROVIDER, employer: "SafeGrid Inspecoes", jobTitle: "Inspetora Termografica", email: "rita.campos@safegrid.com", phone: buildPhone(3001), notes: "Atendimento quinzenal de manutencao preditiva.", status: AccessProfileStatus.ACTIVE },
    ],
  },
  {
    cpf: buildCpf(3002),
    fullName: "Eduardo Moreira Pires",
    photoUrl: buildPhotoUrl("Eduardo Moreira Pires"),
    profiles: [
      { organizationCode: "solar-client", homePlantCode: "usina-sertao-03", personType: PersonType.CONTRACTOR, employer: "Mandacaru Montagens", jobTitle: "Encarregado Civil", email: "eduardo.pires@mandacaru.com", phone: buildPhone(3002), notes: "Equipe compartilhada de ampliacao de patio tecnico.", status: AccessProfileStatus.ACTIVE },
      { organizationCode: "energia-horizonte-2026", homePlantCode: "usina-sul-02", personType: PersonType.CONTRACTOR, employer: "Mandacaru Montagens", jobTitle: "Encarregado Civil", email: "eduardo.pires@mandacaru.com", phone: buildPhone(3002), notes: "Suporte a obras complementares em 03/2026.", status: AccessProfileStatus.ACTIVE },
    ],
  },
  {
    cpf: buildCpf(3003),
    fullName: "Patricia Gomes Farias",
    photoUrl: buildPhotoUrl("Patricia Gomes Farias"),
    profiles: [
      { organizationCode: "solar-client", homePlantCode: "usina-vale-04", personType: PersonType.VISITOR, employer: "Visitante", jobTitle: "Auditoria de Cliente", email: "patricia.farias@cliente-auditoria.com", phone: buildPhone(3003), notes: "Auditoria executiva agendada para a semana de 17/03/2026.", status: AccessProfileStatus.ACTIVE },
      { organizationCode: "energia-horizonte-2026", homePlantCode: "usina-sul-02", personType: PersonType.VISITOR, employer: "Visitante", jobTitle: "Auditoria de Cliente", email: "patricia.farias@cliente-auditoria.com", phone: buildPhone(3003), notes: "Visita de benchmark entre grupos.", status: AccessProfileStatus.ACTIVE },
    ],
  },
  {
    cpf: buildCpf(3004),
    fullName: "Mateus Lima Rocha",
    photoUrl: buildPhotoUrl("Mateus Lima Rocha"),
    profiles: [
      { organizationCode: "solar-client", homePlantCode: "usina-norte-01", personType: PersonType.SERVICE_PROVIDER, employer: "TecGrid Servicos", jobTitle: "Especialista em Tracker", email: "mateus.rocha@tecgrid.com", phone: buildPhone(3004), notes: "Especialista compartilhado para backlog de tracker.", status: AccessProfileStatus.ACTIVE },
      { organizationCode: "energia-horizonte-2026", homePlantCode: "usina-ponte-01", personType: PersonType.SERVICE_PROVIDER, employer: "TecGrid Servicos", jobTitle: "Especialista em Tracker", email: "mateus.rocha@tecgrid.com", phone: buildPhone(3004), notes: "Atendimento remoto e presencial no mesmo CPF global.", status: AccessProfileStatus.ACTIVE },
    ],
  },
  {
    cpf: buildCpf(3005),
    fullName: "Luciana Torres Braga",
    photoUrl: buildPhotoUrl("Luciana Torres Braga"),
    profiles: [
      { organizationCode: "solar-client", homePlantCode: "usina-leste-02", personType: PersonType.SUPERVISOR, employer: "Cliente Solar Nordeste", jobTitle: "Supervisora de SSMA", email: "luciana.braga@cliente-solar.com", phone: buildPhone(3005), notes: "Atua tambem em auditorias cruzadas com grupos parceiros.", status: AccessProfileStatus.ACTIVE },
      { organizationCode: "energia-horizonte-2026", homePlantCode: "usina-sul-02", personType: PersonType.SUPERVISOR, employer: "Energia Horizonte", jobTitle: "Supervisora de SSMA", email: "luciana.braga@energia-horizonte.com", phone: buildPhone(3005), notes: "Perfil compartilhado em duas organizacoes para demonstrar isolamento de tenant.", status: AccessProfileStatus.ACTIVE },
    ],
  },
];

function collectDemoEmails() {
  return organizationSeeds.flatMap((organization) => organization.users.map((user) => user.email));
}

function collectDemoCpfs() {
  return [
    ...organizationSeeds.flatMap((organization) => organization.generatedProfiles.map((profile) => profile.cpf)),
    ...sharedProfileSeeds.map((profile) => profile.cpf),
  ];
}

function buildValidationMode(plant: PlantSeed) {
  return plant.geofenceLatitude !== undefined ? "network+geofence" : "network";
}

function buildValidationNotes(
  plant: PlantSeed,
  networkName: string | null,
  matchedBy: "public-ip" | "local-cidr" | "ssid" | "bssid" | "open" = "ssid",
) {
  if (!plant.requireWifiMatch) {
    return "Esta usina nao exige ambiente de rede especifico no momento.";
  }

  if (!networkName) {
    return "Acesso validado pelo ambiente de rede autorizado da usina.";
  }

  if (matchedBy === "public-ip") {
    return `Acesso validado pela rede publica da usina (${networkName}).`;
  }

  if (matchedBy === "local-cidr") {
    return `Acesso validado pela LAN local da usina (${networkName}).`;
  }

  const label = matchedBy === "bssid" ? "BSSID" : "Wi-Fi autorizado";
  return `Acesso validado na rede ${networkName} por ${label}.`;
}

function resolveGeoCoordinate(base: number | undefined, seed: number) {
  if (base === undefined) {
    return null;
  }

  return Number((base + ((seed % 5) - 2) * 0.00018).toFixed(6));
}

function pickAssignedActor(context: CreatedOrganizationContext, plantCode: string, fallbackEmail: string) {
  for (const user of context.usersByEmail.values()) {
    if (user.role === UserRole.PLANT_SUPERVISOR && user.plantId === context.plantsByCode.get(plantCode)?.id) {
      return user;
    }
  }

  return context.usersByEmail.get(fallbackEmail) ?? Array.from(context.usersByEmail.values())[0];
}

async function cleanupDemoData() {
  const organizationCodes = organizationSeeds.map((organization) => organization.code);
  const personCpfs = collectDemoCpfs();
  const userEmails = collectDemoEmails();

  await prisma.organization.deleteMany({ where: { code: { in: organizationCodes } } });
  await prisma.user.deleteMany({ where: { email: { in: userEmails } } });
  await prisma.person.deleteMany({
    where: {
      cpf: { in: personCpfs },
      accessProfiles: { none: {} },
    },
  });
}

async function createOrganizations() {
  const contexts = new Map<string, CreatedOrganizationContext>();

  for (const organizationSeed of organizationSeeds) {
    const organization = await prisma.organization.create({
      data: { code: organizationSeed.code, name: organizationSeed.name },
    });
    const plantsByCode = new Map<
      string,
      Plant & {
        authorizedNetworks: Array<{
          ssid: string | null;
          bssid: string | null;
          publicIpv4Cidr: string | null;
          localIpv4Cidr: string | null;
        }>;
      }
    >();

    for (const plantSeed of organizationSeed.plants) {
      const plant = await prisma.plant.create({
        data: {
          organizationId: organization.id,
          code: plantSeed.code,
          name: plantSeed.name,
          city: plantSeed.city,
          state: plantSeed.state,
          openingHour: plantSeed.openingHour,
          closingHour: plantSeed.closingHour,
          qrToken: plantSeed.qrToken,
          status: plantSeed.status,
          requireWifiMatch: plantSeed.requireWifiMatch,
          requireSelfie: plantSeed.requireSelfie,
          autoCloseLimitHours: plantSeed.autoCloseLimitHours,
          lateAlertMinutes: plantSeed.lateAlertMinutes,
          geofenceLatitude: plantSeed.geofenceLatitude ?? null,
          geofenceLongitude: plantSeed.geofenceLongitude ?? null,
          geofenceRadiusMeters: plantSeed.geofenceRadiusMeters ?? null,
          authorizedNetworks: {
            create: plantSeed.authorizedNetworks.map((network) => ({
              name: network.name,
              publicIpv4Cidr: network.publicIpv4Cidr ?? null,
              localIpv4Cidr: network.localIpv4Cidr ?? null,
              ssid: network.ssid ?? null,
              bssid: network.bssid ?? null,
              notes: network.notes ?? null,
              isActive: network.isActive ?? true,
            })),
          },
        },
        include: {
          authorizedNetworks: {
            select: { ssid: true, bssid: true, publicIpv4Cidr: true, localIpv4Cidr: true },
          },
        },
      });

      plantsByCode.set(plantSeed.code, plant);
    }

    const usersByEmail = new Map<string, User>();

    for (const userSeed of organizationSeed.users) {
      const passwordHash = await bcrypt.hash(userSeed.password, 12);
      const user = await prisma.user.create({
        data: {
          organizationId: organization.id,
          plantId: userSeed.plantCode ? plantsByCode.get(userSeed.plantCode)?.id ?? null : null,
          name: userSeed.name,
          email: userSeed.email,
          emailVerified: true,
          image: null,
          passwordHash,
          role: userSeed.role,
          status: userSeed.status ?? UserStatus.ACTIVE,
          modulePermissions: userSeed.modulePermissions,
          lastLoginAt: userSeed.lastLoginAt ?? null,
          accounts: {
            create: {
              id: randomUUID(),
              accountId: userSeed.email,
              providerId: "credential",
              password: passwordHash,
            },
          },
        },
      });

      usersByEmail.set(user.email, user);
    }

    contexts.set(organizationSeed.code, {
      organizationId: organization.id,
      organizationCode: organizationSeed.code,
      organizationName: organizationSeed.name,
      plantsByCode,
      usersByEmail,
      profiles: [],
    });
  }

  return contexts;
}

async function createProfiles(contexts: Map<string, CreatedOrganizationContext>) {
  const peopleByCpf = new Map<string, { id: string; cpf: string; fullName: string }>();

  const ensurePerson = async (cpf: string, fullName: string) => {
    const cached = peopleByCpf.get(cpf);

    if (cached) {
      return cached;
    }

    const person = await prisma.person.create({
      data: {
        cpf,
        fullName,
      },
    });

    const normalized = { id: person.id, cpf: person.cpf, fullName: person.fullName };
    peopleByCpf.set(cpf, normalized);

    return normalized;
  };

  for (const organizationSeed of organizationSeeds) {
    const context = contexts.get(organizationSeed.code);

    if (!context) {
      continue;
    }

    for (const profileSeed of organizationSeed.generatedProfiles) {
      const person = await ensurePerson(profileSeed.cpf, profileSeed.fullName);
      const accessProfile = await prisma.accessProfile.create({
        data: {
          organizationId: context.organizationId,
          personId: person.id,
          homePlantId: context.plantsByCode.get(profileSeed.homePlantCode)?.id ?? null,
          personType: profileSeed.personType,
          employer: profileSeed.employer,
          jobTitle: profileSeed.jobTitle,
          email: profileSeed.email,
          phone: profileSeed.phone,
          photoUrl: profileSeed.photoUrl,
          notes: profileSeed.notes,
          status: profileSeed.status,
        },
        include: {
          person: {
            select: { id: true, cpf: true, fullName: true },
          },
        },
      });

      context.profiles.push(accessProfile);
    }
  }

  for (const sharedProfileSeed of sharedProfileSeeds) {
    const person = await ensurePerson(sharedProfileSeed.cpf, sharedProfileSeed.fullName);

    for (const profileSeed of sharedProfileSeed.profiles) {
      const context = contexts.get(profileSeed.organizationCode);

      if (!context) {
        continue;
      }

      const accessProfile = await prisma.accessProfile.create({
        data: {
          organizationId: context.organizationId,
          personId: person.id,
          homePlantId: context.plantsByCode.get(profileSeed.homePlantCode)?.id ?? null,
          personType: profileSeed.personType,
          employer: profileSeed.employer,
          jobTitle: profileSeed.jobTitle,
          email: profileSeed.email,
          phone: profileSeed.phone,
          photoUrl: sharedProfileSeed.photoUrl,
          notes: profileSeed.notes,
          status: profileSeed.status,
        },
        include: {
          person: {
            select: { id: true, cpf: true, fullName: true },
          },
        },
      });

      context.profiles.push(accessProfile);
    }
  }
}

function buildEntryDeviceLabel(personType: PersonType, seed: number) {
  const labels = {
    [PersonType.EMPLOYEE]: ["Chrome no Android", "PWA no tablet", "Samsung Internet"],
    [PersonType.CONTRACTOR]: ["Chrome no Android", "Moto G da equipe"],
    [PersonType.VISITOR]: ["Safari no iPhone", "Chrome no Android"],
    [PersonType.SUPERVISOR]: ["Edge no notebook", "Chrome no tablet da supervisao"],
    [PersonType.SERVICE_PROVIDER]: ["PWA de manutencao", "Chrome no Android"],
    [PersonType.OTHER]: ["Terminal de apoio", "Chrome no Android"],
  };

  const options = labels[personType];
  return options[seed % options.length];
}

function buildEntryPayload(options: {
  entryId: string;
  organizationId: string;
  accessProfileId: string;
  plantId: string;
  openedAt: Date;
  closedAt?: Date | null;
  totalMinutes?: number | null;
  status: TimeEntryStatus;
  origin: EntryOrigin;
  deviceIp: string | null;
  deviceLabel: string | null;
  wifiSsid: string | null;
  wifiBssid: string | null;
  selfieUrl: string | null;
  geoLatitude: number | null;
  geoLongitude: number | null;
  validationMode: string;
  validationNotes: string;
  notes: string | null;
  adjustedByUserId?: string | null;
  closedReason?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: options.entryId,
    organizationId: options.organizationId,
    accessProfileId: options.accessProfileId,
    plantId: options.plantId,
    openedAt: options.openedAt,
    closedAt: options.closedAt ?? null,
    totalMinutes: options.totalMinutes ?? null,
    status: options.status,
    origin: options.origin,
    deviceIp: options.deviceIp,
    deviceLabel: options.deviceLabel,
    wifiSsid: options.wifiSsid,
    wifiBssid: options.wifiBssid,
    selfieUrl: options.selfieUrl,
    geoLatitude: options.geoLatitude,
    geoLongitude: options.geoLongitude,
    validationMode: options.validationMode,
    validationNotes: options.validationNotes,
    notes: options.notes,
    adjustedByUserId: options.adjustedByUserId ?? null,
    closedReason: options.closedReason ?? null,
    createdAt: options.createdAt ?? options.openedAt,
    updatedAt: options.updatedAt ?? options.closedAt ?? options.openedAt,
  } satisfies DemoEntrySeed;
}

function buildTimeEntries(contexts: Map<string, CreatedOrganizationContext>) {
  const historicalDays = buildDaySeries(17).filter((day) => day < referenceDay);
  const entries: DemoEntrySeed[] = [];
  const entryMeta = new Map<
    string,
    {
      organizationId: string;
      plantId: string;
      plantName: string;
      personId: string;
      personName: string;
      status: TimeEntryStatus;
      openedAt: Date;
      closedAt: Date | null;
      totalMinutes: number | null;
      actorUserId: string | null;
    }
  >();

  for (const organizationSeed of organizationSeeds) {
    const context = contexts.get(organizationSeed.code);

    if (!context) {
      continue;
    }

    const adminUser =
      context.usersByEmail.get(
        organizationSeed.code === "solar-client"
          ? "admin@cliente-solar.com"
          : "admin@energia-horizonte.com",
      ) ?? Array.from(context.usersByEmail.values())[0];

    context.profiles
      .sort((left, right) => left.person.fullName.localeCompare(right.person.fullName))
      .forEach((profile, profileIndex) => {
        const homePlant =
          Array.from(context.plantsByCode.values()).find((plant) => plant.id === profile.homePlantId) ??
          Array.from(context.plantsByCode.values())[profileIndex % context.plantsByCode.size];
        const plantSeed = organizationSeed.plants.find((plant) => plant.code === homePlant.code)!;
        const firstNetwork = plantSeed.authorizedNetworks.find((network) => network.isActive ?? true);
        const validationMode = buildValidationMode(plantSeed);
        const validationNotes = buildValidationNotes(
          plantSeed,
          firstNetwork?.name ?? null,
          firstNetwork?.localIpv4Cidr
            ? "local-cidr"
            : firstNetwork?.publicIpv4Cidr
              ? "public-ip"
              : firstNetwork?.bssid
                ? "bssid"
                : "ssid",
        );
        const actor = pickAssignedActor(
          context,
          homePlant.code,
          organizationSeed.code === "solar-client"
            ? "admin@cliente-solar.com"
            : "admin@energia-horizonte.com",
        );

        for (const [dayIndex, day] of historicalDays.entries()) {
          const weekday = localDate(day, "12:00").getDay();

          if (
            weekday === 0 &&
            profile.personType !== PersonType.VISITOR &&
            profile.personType !== PersonType.SERVICE_PROVIDER
          ) {
            continue;
          }

          if (profile.status === AccessProfileStatus.INACTIVE && day > "2026-03-09") {
            continue;
          }

          if (profile.status === AccessProfileStatus.LEAVE && day > "2026-03-05") {
            continue;
          }

          const shouldAttend =
            profile.personType === PersonType.VISITOR
              ? (profileIndex + dayIndex) % 5 === 0
              : (profileIndex * 3 + dayIndex * 5) % 4 !== 0;

          if (!shouldAttend) {
            continue;
          }

          const startHour = 6 + ((profileIndex + dayIndex) % 4);
          const startMinute = ((profileIndex * 11 + dayIndex * 7) % 4) * 15;
          const openedAt = localDate(
            day,
            `${startHour.toString().padStart(2, "0")}:${startMinute.toString().padStart(2, "0")}`,
          );
          const baseDuration =
            profile.personType === PersonType.VISITOR
              ? 90 + ((profileIndex + dayIndex) % 4) * 45
              : profile.personType === PersonType.SERVICE_PROVIDER
                ? 240 + ((profileIndex * 13 + dayIndex * 11) % 181)
                : profile.personType === PersonType.SUPERVISOR
                  ? 420 + ((profileIndex * 7 + dayIndex * 13) % 121)
                  : 480 + ((profileIndex * 17 + dayIndex * 19) % 181);
          const entryId = `seed-${organizationSeed.code}-${profile.id}-${day.replace(/-/g, "")}`;
          let status: TimeEntryStatus = TimeEntryStatus.CLOSED;
          let origin: EntryOrigin = EntryOrigin.QR_CODE;
          let adjustedByUserId: string | null = null;
          let notes: string | null = null;
          let closedReason = "QR_EXIT";
          let closedAt = addMinutes(openedAt, baseDuration);
          let totalMinutes = baseDuration;

          if ((profileIndex + dayIndex) % 19 === 0) {
            status = TimeEntryStatus.ADJUSTED;
            origin = EntryOrigin.MANUAL_ADJUSTMENT;
            adjustedByUserId = adminUser.id;
            notes = "Horario ajustado pela administracao apos conferencia do lider.";
            closedReason = "ADJUSTED";
          } else if ((profileIndex + dayIndex) % 23 === 0) {
            status = TimeEntryStatus.AUTO_CLOSED;
            origin = EntryOrigin.AUTO_CLOSED;
            closedReason = dayIndex % 2 === 0 ? "LIMIT_REACHED" : "DAY_TURNOVER";
            totalMinutes =
              closedReason === "LIMIT_REACHED"
                ? plantSeed.autoCloseLimitHours * 60
                : Math.max(
                    0,
                    Math.round((localDate(day, "23:59").getTime() - openedAt.getTime()) / 60_000),
                  );
            closedAt =
              closedReason === "LIMIT_REACHED"
                ? addMinutes(openedAt, totalMinutes)
                : localDate(day, "23:59");
            notes =
              closedReason === "LIMIT_REACHED"
                ? "Encerramento automatico por limite maximo configurado."
                : "Encerramento automatico na virada do dia.";
          } else if ((profileIndex + dayIndex) % 11 === 0) {
            origin = EntryOrigin.PANEL;
            adjustedByUserId = actor.id;
            closedReason = "MANUAL_PANEL";
            notes = "Registro encerrado manualmente pelo painel do supervisor.";
          }

          const deviceIp =
            buildIpFromCidr(firstNetwork?.localIpv4Cidr, 20 + ((profileIndex + dayIndex) % 120)) ??
            `172.16.${profileIndex % 10}.${30 + dayIndex}`;
          const selfieUrl =
            plantSeed.requireSelfie || profile.personType === PersonType.VISITOR
              ? `${profile.photoUrl ?? buildPhotoUrl(profile.person.fullName)}?day=${day}`
              : null;
          const geoLatitude = resolveGeoCoordinate(plantSeed.geofenceLatitude, profileIndex + dayIndex);
          const geoLongitude = resolveGeoCoordinate(
            plantSeed.geofenceLongitude,
            profileIndex + dayIndex + 3,
          );

          const entry = buildEntryPayload({
            entryId,
            organizationId: context.organizationId,
            accessProfileId: profile.id,
            plantId: homePlant.id,
            openedAt,
            closedAt,
            totalMinutes,
            status,
            origin,
            deviceIp,
            deviceLabel: buildEntryDeviceLabel(profile.personType, profileIndex + dayIndex),
            wifiSsid: firstNetwork?.ssid ?? null,
            wifiBssid: firstNetwork?.bssid ?? null,
            selfieUrl,
            geoLatitude,
            geoLongitude,
            validationMode,
            validationNotes,
            notes,
            adjustedByUserId,
            closedReason,
          });

          entries.push(entry);
          entryMeta.set(entryId, {
            organizationId: context.organizationId,
            plantId: homePlant.id,
            plantName: homePlant.name,
            personId: profile.person.id,
            personName: profile.person.fullName,
            status,
            openedAt,
            closedAt,
            totalMinutes,
            actorUserId: adjustedByUserId,
          });
        }

        if (profile.status !== AccessProfileStatus.ACTIVE) {
          return;
        }

        const todaySeed = profileIndex + 1;
        const shouldOpenToday = todaySeed % 6 === 0;
        const shouldCloseToday = !shouldOpenToday && todaySeed % 2 === 0;

        if (!shouldOpenToday && !shouldCloseToday) {
          return;
        }

        const startHour = shouldOpenToday ? 8 + (todaySeed % 3) : 6 + (todaySeed % 4);
        const startMinute = shouldOpenToday ? (todaySeed % 2) * 20 : ((todaySeed * 7) % 4) * 15;
        const openedAt = localDate(
          referenceDay,
          `${startHour.toString().padStart(2, "0")}:${startMinute.toString().padStart(2, "0")}`,
        );
        const deviceIp =
          buildIpFromCidr(firstNetwork?.localIpv4Cidr, 80 + (todaySeed % 40)) ??
          `172.18.${profileIndex % 10}.${60 + todaySeed}`;
        const entryId = `seed-${organizationSeed.code}-${profile.id}-${referenceDay.replace(/-/g, "")}-today`;
        const selfieUrl =
          plantSeed.requireSelfie || profile.personType === PersonType.VISITOR
            ? `${profile.photoUrl ?? buildPhotoUrl(profile.person.fullName)}?day=${referenceDay}`
            : null;
        const geoLatitude = resolveGeoCoordinate(plantSeed.geofenceLatitude, todaySeed);
        const geoLongitude = resolveGeoCoordinate(plantSeed.geofenceLongitude, todaySeed + 5);

        if (shouldOpenToday) {
          const entry = buildEntryPayload({
            entryId,
            organizationId: context.organizationId,
            accessProfileId: profile.id,
            plantId: homePlant.id,
            openedAt,
            status: TimeEntryStatus.OPEN,
            origin: EntryOrigin.QR_CODE,
            deviceIp,
            deviceLabel: buildEntryDeviceLabel(profile.personType, todaySeed),
            wifiSsid: firstNetwork?.ssid ?? null,
            wifiBssid: firstNetwork?.bssid ?? null,
            selfieUrl,
            geoLatitude,
            geoLongitude,
            validationMode,
            validationNotes,
            notes:
              profile.personType === PersonType.VISITOR
                ? "Acesso em andamento para auditoria presencial."
                : "Acesso ativo no momento da carga demo.",
          });

          entries.push(entry);
          entryMeta.set(entryId, {
            organizationId: context.organizationId,
            plantId: homePlant.id,
            plantName: homePlant.name,
            personId: profile.person.id,
            personName: profile.person.fullName,
            status: TimeEntryStatus.OPEN,
            openedAt,
            closedAt: null,
            totalMinutes: null,
            actorUserId: null,
          });
          return;
        }

        const adjustedToday = todaySeed % 10 === 0;
        const totalMinutes = 300 + (todaySeed % 6) * 35;
        const closedAt = addMinutes(openedAt, totalMinutes);
        const entry = buildEntryPayload({
          entryId,
          organizationId: context.organizationId,
          accessProfileId: profile.id,
          plantId: homePlant.id,
          openedAt,
          closedAt,
          totalMinutes,
          status: adjustedToday ? TimeEntryStatus.ADJUSTED : TimeEntryStatus.CLOSED,
          origin: adjustedToday ? EntryOrigin.MANUAL_ADJUSTMENT : EntryOrigin.PANEL,
          deviceIp,
          deviceLabel: buildEntryDeviceLabel(profile.personType, todaySeed),
          wifiSsid: firstNetwork?.ssid ?? null,
          wifiBssid: firstNetwork?.bssid ?? null,
          selfieUrl,
          geoLatitude,
          geoLongitude,
          validationMode,
          validationNotes,
          notes: adjustedToday
            ? "Saida corrigida manualmente pela supervisao durante a manha de 17/03/2026."
            : "Registro finalizado manualmente pelo painel durante a operacao.",
          adjustedByUserId: adjustedToday ? adminUser.id : actor.id,
          closedReason: adjustedToday ? "ADJUSTED" : "MANUAL_PANEL",
        });

        entries.push(entry);
        entryMeta.set(entryId, {
          organizationId: context.organizationId,
          plantId: homePlant.id,
          plantName: homePlant.name,
          personId: profile.person.id,
          personName: profile.person.fullName,
          status: adjustedToday ? TimeEntryStatus.ADJUSTED : TimeEntryStatus.CLOSED,
          openedAt,
          closedAt,
          totalMinutes,
          actorUserId: adjustedToday ? adminUser.id : actor.id,
        });
      });
  }

  return { entries, entryMeta };
}

function buildAdministrativeAudits(contexts: Map<string, CreatedOrganizationContext>) {
  const audits: DemoAuditSeed[] = [];

  for (const organizationSeed of organizationSeeds) {
    const context = contexts.get(organizationSeed.code);

    if (!context) {
      continue;
    }

    const superAdmin = Array.from(context.usersByEmail.values()).find((user) => user.role === UserRole.SUPER_ADMIN);
    const admin =
      Array.from(context.usersByEmail.values()).find(
        (user) => user.role === UserRole.ADMIN && user.status === UserStatus.ACTIVE,
      ) ?? superAdmin;

    for (const user of context.usersByEmail.values()) {
      if (!user.lastLoginAt) {
        continue;
      }

      audits.push({
        organizationId: context.organizationId,
        actorUserId: user.id,
        action: "AUTH.LOGIN",
        entity: "User",
        entityId: user.id,
        metadata: {
          email: user.email,
          role: user.role,
          modulePermissions: user.modulePermissions,
        } satisfies Prisma.InputJsonValue,
        ipAddress: user.role === UserRole.PLANT_SUPERVISOR ? "10.0.10.12" : "10.0.0.10",
        createdAt: user.lastLoginAt,
      });
    }

    organizationSeed.plants.forEach((plant, index) => {
      const storedPlant = context.plantsByCode.get(plant.code);

      if (!storedPlant || !superAdmin || !admin) {
        return;
      }

      audits.push({
        organizationId: context.organizationId,
        actorUserId: superAdmin.id,
        action: "PLANT.CREATED",
        entity: "Plant",
        entityId: storedPlant.id,
        metadata: {
          after: {
            code: storedPlant.code,
            name: storedPlant.name,
            city: storedPlant.city,
            state: storedPlant.state,
            requireWifiMatch: storedPlant.requireWifiMatch,
            requireSelfie: storedPlant.requireSelfie,
          },
        } satisfies Prisma.InputJsonValue,
        ipAddress: "10.0.0.15",
        createdAt: localDate("2026-03-01", `${(8 + index).toString().padStart(2, "0")}:15`),
      });

      if (index % 2 === 0) {
        audits.push({
          organizationId: context.organizationId,
          actorUserId: admin.id,
          action: "PLANT.UPDATED",
          entity: "Plant",
          entityId: storedPlant.id,
          metadata: {
            before: { lateAlertMinutes: Math.max(60, plant.lateAlertMinutes - 30) },
            after: { lateAlertMinutes: plant.lateAlertMinutes },
          } satisfies Prisma.InputJsonValue,
          ipAddress: "10.0.0.18",
          createdAt: localDate("2026-03-08", `${(9 + index).toString().padStart(2, "0")}:10`),
        });
      }
    });

    context.profiles.slice(0, 10).forEach((profile, index) => {
      if (!admin) {
        return;
      }

      audits.push({
        organizationId: context.organizationId,
        actorUserId: admin.id,
        action: "PERSON.CREATED",
        entity: "AccessProfile",
        entityId: profile.id,
        metadata: {
          after: {
            personId: profile.person.id,
            fullName: profile.person.fullName,
            cpf: profile.person.cpf,
            personType: profile.personType,
            employer: profile.employer,
            jobTitle: profile.jobTitle,
          },
        } satisfies Prisma.InputJsonValue,
        ipAddress: "10.0.0.21",
        createdAt: localDate("2026-03-02", `${(8 + (index % 4)).toString().padStart(2, "0")}:05`),
      });

      if (index % 3 === 0) {
        audits.push({
          organizationId: context.organizationId,
          actorUserId: admin.id,
          action: "PERSON.UPDATED",
          entity: "AccessProfile",
          entityId: profile.id,
          metadata: {
            before: { notes: null },
            after: { notes: profile.notes },
          } satisfies Prisma.InputJsonValue,
          ipAddress: "10.0.0.22",
          createdAt: localDate("2026-03-10", `${(10 + (index % 3)).toString().padStart(2, "0")}:20`),
        });
      }
    });

    Array.from(context.usersByEmail.values())
      .filter((user) => user.role !== UserRole.SUPER_ADMIN)
      .forEach((user, index) => {
        if (!superAdmin) {
          return;
        }

        audits.push({
          organizationId: context.organizationId,
          actorUserId: superAdmin.id,
          action: "ACCESS_USER.CREATED",
          entity: "User",
          entityId: user.id,
          metadata: {
            after: {
              email: user.email,
              role: user.role,
              status: user.status,
              modulePermissions: user.modulePermissions,
            },
          } satisfies Prisma.InputJsonValue,
          ipAddress: "10.0.0.11",
          createdAt: localDate("2026-03-01", `${(7 + index).toString().padStart(2, "0")}:40`),
        });

        if (index % 2 === 0) {
          audits.push({
            organizationId: context.organizationId,
            actorUserId: superAdmin.id,
            action: "ACCESS_USER.UPDATED",
            entity: "User",
            entityId: user.id,
            metadata: {
              before: { modulePermissions: ["dashboard", "reports"] },
              after: { modulePermissions: user.modulePermissions },
            } satisfies Prisma.InputJsonValue,
            ipAddress: "10.0.0.12",
            createdAt: localDate("2026-03-12", `${(9 + index).toString().padStart(2, "0")}:35`),
          });
        }
      });
  }

  return audits;
}

function buildEntryAuditsAndRealtime(
  entryMeta: Map<
    string,
    {
      organizationId: string;
      plantId: string;
      plantName: string;
      personId: string;
      personName: string;
      status: TimeEntryStatus;
      openedAt: Date;
      closedAt: Date | null;
      totalMinutes: number | null;
      actorUserId: string | null;
    }
  >,
) {
  const audits: DemoAuditSeed[] = [];
  const realtimeEvents: DemoRealtimeSeed[] = [];

  for (const [entryId, meta] of entryMeta.entries()) {
    audits.push({
      organizationId: meta.organizationId,
      actorUserId: null,
      action: "TIME_ENTRY.OPENED",
      entity: "TimeEntry",
      entityId: entryId,
      metadata: {
        personId: meta.personId,
        plantId: meta.plantId,
        status: "OPEN",
      } satisfies Prisma.InputJsonValue,
      ipAddress: "10.255.0.10",
      createdAt: meta.openedAt,
    });

    if (formatDay(meta.openedAt) === referenceDay) {
      realtimeEvents.push({
        organizationId: meta.organizationId,
        plantId: meta.plantId,
        channel: "operations",
        type: "entry.created",
        payload: {
          entryId,
          personName: meta.personName,
          plantName: meta.plantName,
          openedAt: meta.openedAt.toISOString(),
          status: meta.status === TimeEntryStatus.OPEN ? "OPEN" : "CLOSED",
        } satisfies Prisma.InputJsonValue,
        createdAt: meta.openedAt,
      });
    }

    if ((meta.status === TimeEntryStatus.CLOSED || meta.status === TimeEntryStatus.ADJUSTED || meta.status === TimeEntryStatus.AUTO_CLOSED) && meta.closedAt) {
      const action =
        meta.status === TimeEntryStatus.CLOSED
          ? "TIME_ENTRY.CLOSED"
          : meta.status === TimeEntryStatus.ADJUSTED
            ? "TIME_ENTRY.ADJUSTED"
            : "TIME_ENTRY.AUTO_CLOSED";

      audits.push({
        organizationId: meta.organizationId,
        actorUserId: meta.actorUserId,
        action,
        entity: "TimeEntry",
        entityId: entryId,
        metadata: {
          personId: meta.personId,
          plantId: meta.plantId,
          totalMinutes: meta.totalMinutes,
        } satisfies Prisma.InputJsonValue,
        ipAddress: meta.status === TimeEntryStatus.AUTO_CLOSED ? "10.255.0.13" : "10.255.0.11",
        createdAt: meta.closedAt,
      });

      if (formatDay(meta.closedAt) === referenceDay) {
        realtimeEvents.push({
          organizationId: meta.organizationId,
          plantId: meta.plantId,
          channel: "operations",
          type: meta.status === TimeEntryStatus.ADJUSTED ? "entry.adjusted" : "entry.closed",
          payload: {
            entryId,
            personName: meta.personName,
            plantName: meta.plantName,
            totalMinutes: meta.totalMinutes ?? 0,
            status: meta.status,
          } satisfies Prisma.InputJsonValue,
          createdAt: meta.closedAt,
        });
      }
    }
  }

  return { audits, realtimeEvents };
}

function collectCredentialSummary() {
  return organizationSeeds.flatMap((organization) =>
    organization.users.map((user) => ({
      organization: organization.name,
      role: user.role,
      email: user.email,
      password: user.password,
      scope: user.plantCode ?? "global",
    })),
  );
}

function collectPlantSummary() {
  return organizationSeeds.flatMap((organization) =>
    organization.plants.map((plant) => ({
      organization: organization.name,
      plant: plant.name,
      code: plant.code,
      qrToken: plant.qrToken,
      wifiRequired: plant.requireWifiMatch ? "yes" : "no",
      selfieRequired: plant.requireSelfie ? "yes" : "no",
    })),
  );
}

async function main() {
  await cleanupDemoData();

  const contexts = await createOrganizations();
  await createProfiles(contexts);

  const { entries, entryMeta } = buildTimeEntries(contexts);
  if (entries.length > 0) {
    await prisma.timeEntry.createMany({ data: entries });
  }

  const administrativeAudits = buildAdministrativeAudits(contexts);
  const { audits: entryAudits, realtimeEvents } = buildEntryAuditsAndRealtime(entryMeta);

  if (administrativeAudits.length + entryAudits.length > 0) {
    await prisma.auditLog.createMany({ data: [...administrativeAudits, ...entryAudits] });
  }

  if (realtimeEvents.length > 0) {
    await prisma.realtimeEvent.createMany({ data: realtimeEvents });
  }

  const organizationIds = Array.from(contexts.values()).map((context) => context.organizationId);
  const [organizationsCount, plantsCount, usersCount, peopleCount, profilesCount, entriesCount, auditsCount, realtimeCount] =
    await Promise.all([
      prisma.organization.count({ where: { id: { in: organizationIds } } }),
      prisma.plant.count({ where: { organizationId: { in: organizationIds } } }),
      prisma.user.count({ where: { organizationId: { in: organizationIds } } }),
      prisma.person.count({ where: { accessProfiles: { some: { organizationId: { in: organizationIds } } } } }),
      prisma.accessProfile.count({ where: { organizationId: { in: organizationIds } } }),
      prisma.timeEntry.count({ where: { organizationId: { in: organizationIds } } }),
      prisma.auditLog.count({ where: { organizationId: { in: organizationIds } } }),
      prisma.realtimeEvent.count({ where: { organizationId: { in: organizationIds } } }),
    ]);

  console.log(`Carga demo concluida com data de referencia em ${referenceDay}.`);
  console.table([
    { metric: "organizations", value: organizationsCount },
    { metric: "plants", value: plantsCount },
    { metric: "users", value: usersCount },
    { metric: "people", value: peopleCount },
    { metric: "accessProfiles", value: profilesCount },
    { metric: "timeEntries", value: entriesCount },
    { metric: "auditLogs", value: auditsCount },
    { metric: "realtimeEvents", value: realtimeCount },
  ]);

  console.log("Credenciais administrativas seed:");
  console.table(collectCredentialSummary());
  console.log("QR tokens e configuracao publica:");
  console.table(collectPlantSummary());
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
