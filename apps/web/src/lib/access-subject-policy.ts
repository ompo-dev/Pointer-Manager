"use client";

export type AccessSubjectFieldName = "fullName" | "employer" | "jobTitle";

export interface AccessSubjectFieldDefinition {
  name: AccessSubjectFieldName;
  label: string;
  placeholder: string;
}

export interface AccessSubjectFormFields {
  personType: string;
  fullName: string;
  employer: string;
  jobTitle: string;
}

export interface AccessSubjectPolicyDefinition {
  personType: string;
  label: string;
  description: string;
  requiredFields: AccessSubjectFieldDefinition[];
  defaults: Omit<AccessSubjectFormFields, "fullName" | "personType">;
}

const accessSubjectPolicies: AccessSubjectPolicyDefinition[] = [
  {
    personType: "EMPLOYEE",
    label: "Funcionario(a)",
    description: "Pessoa do quadro interno da operacao da usina.",
    requiredFields: [
      { name: "fullName", label: "Nome completo", placeholder: "Nome completo" },
      { name: "employer", label: "Empresa", placeholder: "Empresa contratante" },
      { name: "jobTitle", label: "Cargo", placeholder: "Cargo ou funcao" },
    ],
    defaults: {
      employer: "Operacao interna",
      jobTitle: "Funcionario(a)",
    },
  },
  {
    personType: "CONTRACTOR",
    label: "Terceirizado(a)",
    description: "Profissional terceirizado ou equipe contratada para executar servicos.",
    requiredFields: [
      { name: "fullName", label: "Nome completo", placeholder: "Nome completo" },
      { name: "employer", label: "Empresa terceirizada", placeholder: "Empresa terceirizada" },
      { name: "jobTitle", label: "Servico ou funcao", placeholder: "Servico ou funcao" },
    ],
    defaults: {
      employer: "Empresa terceirizada",
      jobTitle: "Servico terceirizado",
    },
  },
  {
    personType: "VISITOR",
    label: "Visitante",
    description: "Visitante eventual, reuniao, entrega, vistoria ou visita tecnica.",
    requiredFields: [
      { name: "fullName", label: "Nome completo", placeholder: "Nome completo" },
      { name: "jobTitle", label: "Motivo da visita", placeholder: "Motivo da visita" },
    ],
    defaults: {
      employer: "Visitante",
      jobTitle: "Visita",
    },
  },
  {
    personType: "SUPERVISOR",
    label: "Supervisor(a)",
    description: "Responsavel pela operacao, seguranca ou acompanhamento local.",
    requiredFields: [
      { name: "fullName", label: "Nome completo", placeholder: "Nome completo" },
      { name: "employer", label: "Area ou empresa", placeholder: "Area ou empresa" },
      { name: "jobTitle", label: "Funcao", placeholder: "Funcao" },
    ],
    defaults: {
      employer: "Supervisao",
      jobTitle: "Supervisor(a)",
    },
  },
  {
    personType: "SERVICE_PROVIDER",
    label: "Prestador(a)",
    description: "Prestador de servicos pontuais, manutencao, inspeção ou apoio especializado.",
    requiredFields: [
      { name: "fullName", label: "Nome completo", placeholder: "Nome completo" },
      { name: "employer", label: "Empresa prestadora", placeholder: "Empresa prestadora" },
      { name: "jobTitle", label: "Servico prestado", placeholder: "Servico prestado" },
    ],
    defaults: {
      employer: "Prestador de servico",
      jobTitle: "Servico prestado",
    },
  },
  {
    personType: "OTHER",
    label: "Outro",
    description: "Qualquer outro perfil de acesso que nao se encaixe nas categorias padrao.",
    requiredFields: [
      { name: "fullName", label: "Nome completo", placeholder: "Nome completo" },
      { name: "employer", label: "Empresa ou origem", placeholder: "Empresa ou origem" },
      { name: "jobTitle", label: "Detalhe do acesso", placeholder: "Detalhe do acesso" },
    ],
    defaults: {
      employer: "Nao informado",
      jobTitle: "Acesso eventual",
    },
  },
];

function normalizeText(value?: string | null) {
  return value?.trim() ?? "";
}

export function listAccessSubjectPolicies() {
  return accessSubjectPolicies;
}

export function getAccessSubjectPolicy(personType?: string | null) {
  return (
    accessSubjectPolicies.find((policy) => policy.personType === personType) ??
    accessSubjectPolicies.find((policy) => policy.personType === "OTHER")!
  );
}

export function seedAccessSubjectForm(
  personType?: string | null,
  reference?: Partial<AccessSubjectFormFields> | null,
): AccessSubjectFormFields {
  const policy = getAccessSubjectPolicy(personType);

  return {
    personType: policy.personType,
    fullName: normalizeText(reference?.fullName),
    employer: normalizeText(reference?.employer) || policy.defaults.employer,
    jobTitle: normalizeText(reference?.jobTitle) || policy.defaults.jobTitle,
  };
}

export function adaptAccessSubjectForm(
  personType: string,
  current?: Partial<AccessSubjectFormFields> | null,
  reference?: Partial<AccessSubjectFormFields> | null,
): AccessSubjectFormFields {
  const seeded = seedAccessSubjectForm(personType, reference);

  return {
    personType: seeded.personType,
    fullName: normalizeText(current?.fullName) || seeded.fullName,
    employer: normalizeText(current?.employer) || seeded.employer,
    jobTitle: normalizeText(current?.jobTitle) || seeded.jobTitle,
  };
}
