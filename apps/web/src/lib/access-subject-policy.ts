"use client";

export type AccessSubjectFieldName = "fullName" | "employer" | "jobTitle";

export interface AccessSubjectFieldDefinition {
  name: AccessSubjectFieldName;
  label: string;
  placeholder: string;
}

export interface AccessSubjectPolicyDefinition {
  personType: string;
  label: string;
  description: string;
  requiredFields: AccessSubjectFieldDefinition[];
  defaults: {
    employer: string;
    jobTitle: string;
  };
}

export interface AccessSubjectFormFields {
  personType: string;
  fullName: string;
  employer: string;
  jobTitle: string;
}

const accessSubjectPolicies: AccessSubjectPolicyDefinition[] = [
  {
    personType: "EMPLOYEE",
    label: "Funcionario(a)",
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
      jobTitle: "Funcionario(a)",
    },
  },
  {
    personType: "CONTRACTOR",
    label: "Terceirizado(a)",
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
      jobTitle: "Terceirizado(a)",
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
    label: "Supervisor(a)",
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
      jobTitle: "Supervisor(a)",
    },
  },
  {
    personType: "SERVICE_PROVIDER",
    label: "Prestador(a) de servico",
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
      employer: "Prestador(a) de servico",
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

function normalizeValue(value?: string | null) {
  return value?.trim() ?? "";
}

function hasRequiredField(
  policy: AccessSubjectPolicyDefinition,
  fieldName: Exclude<AccessSubjectFieldName, "fullName">,
) {
  return policy.requiredFields.some((field) => field.name === fieldName);
}

export function listAccessSubjectPolicies() {
  return accessSubjectPolicies.map((policy) => ({
    ...policy,
    requiredFields: [...policy.requiredFields],
  }));
}

export function getAccessSubjectPolicy(personType?: string | null) {
  return (
    accessSubjectPolicies.find((policy) => policy.personType === personType) ??
    accessSubjectPolicies.find((policy) => policy.personType === "VISITOR")!
  );
}

export function seedAccessSubjectForm(
  personType?: string | null,
  reference?: Partial<AccessSubjectFormFields> | null,
): AccessSubjectFormFields {
  const policy = getAccessSubjectPolicy(personType);

  return {
    personType: policy.personType,
    fullName: normalizeValue(reference?.fullName),
    employer:
      normalizeValue(reference?.employer) ||
      (hasRequiredField(policy, "employer") ? "" : policy.defaults.employer),
    jobTitle:
      normalizeValue(reference?.jobTitle) ||
      (hasRequiredField(policy, "jobTitle") ? "" : policy.defaults.jobTitle),
  };
}

export function adaptAccessSubjectForm(
  nextPersonType: string,
  current: AccessSubjectFormFields,
  reference?: Partial<AccessSubjectFormFields> | null,
): AccessSubjectFormFields {
  const previousPolicy = getAccessSubjectPolicy(current.personType);
  const nextPolicy = getAccessSubjectPolicy(nextPersonType);
  const currentEmployer = normalizeValue(current.employer);
  const currentJobTitle = normalizeValue(current.jobTitle);
  const referenceEmployer = normalizeValue(reference?.employer);
  const referenceJobTitle = normalizeValue(reference?.jobTitle);

  const shouldResetEmployer =
    !currentEmployer ||
    currentEmployer === previousPolicy.defaults.employer ||
    (referenceEmployer !== "" && currentEmployer === referenceEmployer);
  const shouldResetJobTitle =
    !currentJobTitle ||
    currentJobTitle === previousPolicy.defaults.jobTitle ||
    (referenceJobTitle !== "" && currentJobTitle === referenceJobTitle);

  return {
    personType: nextPolicy.personType,
    fullName: normalizeValue(current.fullName) || normalizeValue(reference?.fullName),
    employer: hasRequiredField(nextPolicy, "employer")
      ? shouldResetEmployer
        ? ""
        : current.employer
      : shouldResetEmployer
        ? nextPolicy.defaults.employer
        : current.employer,
    jobTitle: hasRequiredField(nextPolicy, "jobTitle")
      ? shouldResetJobTitle
        ? ""
        : current.jobTitle
      : shouldResetJobTitle
        ? nextPolicy.defaults.jobTitle
        : current.jobTitle,
  };
}
