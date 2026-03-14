import { PersonType } from "@prisma/client";

export type AccessRequiredFieldName = "fullName" | "employer" | "jobTitle";

export interface AccessRequiredFieldDefinition {
  name: AccessRequiredFieldName;
  label: string;
  placeholder: string;
}

interface AccessSubjectPolicyDefinition {
  personType: PersonType;
  label: string;
  description: string;
  requiredFields: AccessRequiredFieldDefinition[];
  defaults: {
    employer: string;
    jobTitle: string;
  };
}

const accessSubjectPolicies: AccessSubjectPolicyDefinition[] = [
  {
    personType: "EMPLOYEE",
    label: "Funcionario",
    description: "Cadastro operacional da propria usina ou equipe interna.",
    requiredFields: [
      {
        name: "fullName",
        label: "Nome completo",
        placeholder: "Nome e sobrenome",
      },
      {
        name: "employer",
        label: "Empresa",
        placeholder: "Empresa contratante",
      },
      {
        name: "jobTitle",
        label: "Cargo",
        placeholder: "Funcao ou cargo",
      },
    ],
    defaults: {
      employer: "Operacao interna",
      jobTitle: "Funcionario",
    },
  },
  {
    personType: "CONTRACTOR",
    label: "Terceirizado",
    description: "Profissional alocado por empresa terceira.",
    requiredFields: [
      {
        name: "fullName",
        label: "Nome completo",
        placeholder: "Nome e sobrenome",
      },
      {
        name: "employer",
        label: "Empresa terceirizada",
        placeholder: "Empresa responsavel",
      },
      {
        name: "jobTitle",
        label: "Funcao",
        placeholder: "Funcao executada na usina",
      },
    ],
    defaults: {
      employer: "Terceirizada",
      jobTitle: "Terceirizado",
    },
  },
  {
    personType: "VISITOR",
    label: "Visitante",
    description: "Acesso eventual com foco em identificacao e motivo da visita.",
    requiredFields: [
      {
        name: "fullName",
        label: "Nome completo",
        placeholder: "Nome e sobrenome",
      },
      {
        name: "jobTitle",
        label: "Motivo da visita",
        placeholder: "Ex.: reuniao, inspecao, entrega",
      },
    ],
    defaults: {
      employer: "Visitante",
      jobTitle: "Visita",
    },
  },
  {
    personType: "SUPERVISOR",
    label: "Supervisor",
    description: "Lider operacional com acesso recorrente.",
    requiredFields: [
      {
        name: "fullName",
        label: "Nome completo",
        placeholder: "Nome e sobrenome",
      },
    ],
    defaults: {
      employer: "Supervisao",
      jobTitle: "Supervisor",
    },
  },
  {
    personType: "SERVICE_PROVIDER",
    label: "Prestador de servico",
    description: "Servico eventual ou especializado executado por fornecedor.",
    requiredFields: [
      {
        name: "fullName",
        label: "Nome completo",
        placeholder: "Nome e sobrenome",
      },
      {
        name: "employer",
        label: "Empresa prestadora",
        placeholder: "Fornecedor responsavel",
      },
      {
        name: "jobTitle",
        label: "Servico",
        placeholder: "Servico ou atividade executada",
      },
    ],
    defaults: {
      employer: "Prestador de servico",
      jobTitle: "Servico programado",
    },
  },
  {
    personType: "OTHER",
    label: "Outro acesso",
    description: "Acesso eventual fora das categorias padrao.",
    requiredFields: [
      {
        name: "fullName",
        label: "Nome completo",
        placeholder: "Nome e sobrenome",
      },
      {
        name: "jobTitle",
        label: "Motivo do acesso",
        placeholder: "Descreva rapidamente o motivo",
      },
    ],
    defaults: {
      employer: "Acesso eventual",
      jobTitle: "Acesso autorizado",
    },
  },
];

export function listAccessSubjectPolicies() {
  return accessSubjectPolicies.map(({ defaults: _defaults, ...policy }) => ({
    ...policy,
    requiredFields: [...policy.requiredFields],
  }));
}

export function getAccessSubjectPolicy(personType?: PersonType | null) {
  return (
    accessSubjectPolicies.find((policy) => policy.personType === personType) ??
    accessSubjectPolicies.find((policy) => policy.personType === "VISITOR")!
  );
}

export function normalizeCpf(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

export function normalizeOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
