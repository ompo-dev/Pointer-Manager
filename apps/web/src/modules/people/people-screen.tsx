"use client";

import { useEffect, useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { parseAsString, useQueryState } from "nuqs";
import { Download, IdCard, Plus, UsersRound } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { TimeEntryStatusBadge } from "@/components/status-badges";
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
import {
  SearchableCombobox,
  type SearchableOption,
} from "@/components/ui/searchable-combobox";
import { Textarea } from "@/components/ui/textarea";
import {
  adaptAccessSubjectForm,
  getAccessSubjectPolicy,
  listAccessSubjectPolicies,
} from "@/lib/access-subject-policy";
import {
  downloadPersonHistoryExport,
  type Person,
  type PersonDetails,
} from "@/lib/api/people";
import {
  showErrorToast,
  showLoadingToast,
  showSuccessToast,
} from "@/lib/toast";
import { useOperationsRealtimeRefresh } from "@/lib/realtime/use-operations-realtime-refresh";
import {
  formatDateTime,
  formatMinutes,
  formatPersonTypeLabel,
} from "@/lib/utils";
import { emptyPersonForm, usePeopleStore } from "@/store/people-store";
import { resolveErrorMessage } from "@/store/store-utils";

type PersonRow = Person;
type PersonHistoryRow = PersonDetails["history"][number];

function buildProfileReference(person?: PersonDetails | Person | null) {
  return {
    personType: person?.personType,
    fullName: person?.fullName ?? "",
    employer: person?.employer ?? "",
    jobTitle: person?.jobTitle ?? "",
  };
}

function resolveProfileSummaryFields(person?: PersonDetails | Person | null) {
  if (!person) {
    return [];
  }

  const policy = getAccessSubjectPolicy(person.personType);
  const requiredLabels = new Map(
    policy.requiredFields.map((field) => [field.name, field.label]),
  );
  const items = [
    {
      key: "employer",
      label:
        requiredLabels.get("employer") ??
        (person.employer && person.employer !== policy.defaults.employer
          ? "Empresa / origem"
          : null),
      value: person.employer,
    },
    {
      key: "jobTitle",
      label:
        requiredLabels.get("jobTitle") ??
        (person.jobTitle && person.jobTitle !== policy.defaults.jobTitle
          ? "Detalhe do acesso"
          : null),
      value: person.jobTitle,
    },
  ];

  return items.filter(
    (item): item is { key: string; label: string; value: string } =>
      Boolean(item.label && item.value),
  );
}

function buildComparablePersonForm(person?: PersonDetails | Person | null) {
  if (!person) {
    return emptyPersonForm;
  }

  return {
    id: person.id,
    fullName: person.fullName,
    cpf: person.cpf,
    personType: person.personType,
    employer: person.employer,
    jobTitle: person.jobTitle,
    email: person.email ?? "",
    phone: person.phone ?? "",
    photoUrl: person.photoUrl ?? "",
    notes: person.notes ?? "",
    status: person.status,
    homePlantId: person.homePlantId ?? "",
  };
}

export function PeopleScreen() {
  const [search, setSearch] = useQueryState(
    "search",
    parseAsString.withDefault(""),
  );
  const [status, setStatus] = useQueryState(
    "status",
    parseAsString.withDefault("ALL"),
  );
  const [personType, setPersonType] = useQueryState(
    "personType",
    parseAsString.withDefault("ALL"),
  );
  const [plant] = useQueryState("plant", parseAsString.withDefault(""));
  const [personId, setPersonId] = useQueryState("personId", parseAsString);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [exportingHistory, setExportingHistory] = useState(false);
  const [hasSeededInitialSelection, setHasSeededInitialSelection] =
    useState(false);
  const people = usePeopleStore((state) => state.people);
  const plantOptions = usePeopleStore((state) => state.plantOptions);
  const selectedPerson = usePeopleStore((state) => state.selectedPerson);
  const form = usePeopleStore((state) => state.form);
  const feedback = usePeopleStore((state) => state.feedback);
  const saving = usePeopleStore((state) => state.saving);
  const loadPeople = usePeopleStore((state) => state.loadPeople);
  const setFormValue = usePeopleStore((state) => state.setFormValue);
  const resetForm = usePeopleStore((state) => state.resetForm);
  const savePerson = usePeopleStore((state) => state.savePerson);
  const currentPlant = plantOptions.find((item) => item.id === plant) ?? null;
  const formPolicy = useMemo(
    () => getAccessSubjectPolicy(form.personType),
    [form.personType],
  );
  const personSummaryFields = useMemo(
    () => resolveProfileSummaryFields(selectedPerson),
    [selectedPerson],
  );
  const statusOptions = useMemo<SearchableOption[]>(
    () => [
      { value: "ALL", label: "Todos os status" },
      { value: "ACTIVE", label: "Ativo" },
      { value: "INACTIVE", label: "Inativo" },
      { value: "LEAVE", label: "Afastado" },
    ],
    [],
  );
  const personTypeOptions = useMemo<SearchableOption[]>(
    () => [
      { value: "ALL", label: "Todos os tipos" },
      ...listAccessSubjectPolicies().map((policy) => ({
        value: policy.personType,
        label: policy.label,
        keywords: [policy.description],
      })),
    ],
    [],
  );
  const formPersonTypeOptions = useMemo(
    () => personTypeOptions.filter((option) => option.value !== "ALL"),
    [personTypeOptions],
  );
  const formStatusOptions = useMemo(
    () => statusOptions.filter((option) => option.value !== "ALL"),
    [statusOptions],
  );
  const plantSelectOptions = useMemo<SearchableOption[]>(
    () => [
      { value: "", label: "Sem usina principal" },
      ...plantOptions.map((plantOption) => ({
        value: plantOption.id,
        label: plantOption.name,
        keywords: [plantOption.city, plantOption.state],
      })),
    ],
    [plantOptions],
  );

  const peopleColumns = useMemo<ColumnDef<PersonRow>[]>(
    () => [
      {
        accessorKey: "fullName",
        header: "Pessoa",
        cell: ({ row }) => (
          <div className="space-y-1 whitespace-normal">
            <p className="font-semibold">{row.original.fullName}</p>
            <p className="text-sm text-muted-foreground">{row.original.cpf}</p>
          </div>
        ),
      },
      {
        accessorKey: "personType",
        header: "Perfil",
        cell: ({ row }) => (
          <div className="space-y-1 whitespace-normal text-sm">
            <p>{formatPersonTypeLabel(row.original.personType)}</p>
            <p className="text-muted-foreground">{row.original.jobTitle}</p>
          </div>
        ),
      },
      {
        accessorKey: "employer",
        header: "Empresa",
        cell: ({ row }) => row.original.employer,
      },
      {
        accessorKey: "_count.timeEntries",
        header: "Abertos",
        cell: ({ row }) => row.original._count?.timeEntries ?? 0,
      },
    ],
    [],
  );

  const historyColumns = useMemo<ColumnDef<PersonHistoryRow>[]>(
    () => [
      {
        accessorKey: "plant.name",
        header: "Usina",
        cell: ({ row }) => (
          <p className="font-semibold">{row.original.plant.name}</p>
        ),
      },
      {
        accessorKey: "openedAt",
        header: "Entrada",
        cell: ({ row }) => formatDateTime(row.original.openedAt),
      },
      {
        accessorKey: "closedAt",
        header: "Saida",
        cell: ({ row }) => formatDateTime(row.original.closedAt),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <TimeEntryStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "totalMinutes",
        header: "Total",
        cell: ({ row }) => formatMinutes(row.original.totalMinutes),
      },
    ],
    [],
  );

  useEffect(() => {
    if (personId || isCreatingNew) {
      if (!hasSeededInitialSelection) {
        setHasSeededInitialSelection(true);
      }
      return;
    }

    if (!hasSeededInitialSelection && people[0]?.id) {
      setHasSeededInitialSelection(true);
      void setPersonId(people[0].id);
    }
  }, [hasSeededInitialSelection, isCreatingNew, people, personId, setPersonId]);

  const showSaveAction =
    JSON.stringify(form) !==
    JSON.stringify(
      isCreatingNew
        ? emptyPersonForm
        : buildComparablePersonForm(selectedPerson),
    );

  useOperationsRealtimeRefresh({
    plantId: plant || undefined,
    matchers: ["people", "person"],
    onRefresh: async () => {
      await loadPeople({
        search,
        status,
        personType,
        plantId: plant || undefined,
      });

      if (personId && !isCreatingNew && !showSaveAction) {
        await usePeopleStore.getState().loadPerson(personId);
      }
    },
  });

  function handlePersonTypeChange(nextPersonType: string) {
    const nextSubject = adaptAccessSubjectForm(
      nextPersonType,
      {
        personType: form.personType,
        fullName: form.fullName,
        employer: form.employer,
        jobTitle: form.jobTitle,
      },
      buildProfileReference(isCreatingNew ? null : selectedPerson),
    );

    setFormValue("personType", nextSubject.personType);
    setFormValue("fullName", nextSubject.fullName);
    setFormValue("employer", nextSubject.employer);
    setFormValue("jobTitle", nextSubject.jobTitle);
  }

  async function handleSavePerson() {
    const savedId = await savePerson();
    if (savedId) {
      setIsCreatingNew(false);
      void setPersonId(savedId);
    }
  }

  async function handleExportHistory() {
    if (!selectedPerson) {
      return;
    }

    setExportingHistory(true);
    const toastId = showLoadingToast(
      "Exportando historico",
      `Gerando o CSV de ${selectedPerson.fullName}.`,
    );

    try {
      const fileName = await downloadPersonHistoryExport(selectedPerson.id);
      showSuccessToast("Historico exportado", fileName, { id: toastId });
    } catch (error) {
      showErrorToast(
        "Falha ao exportar historico",
        resolveErrorMessage(error, "Nao foi possivel exportar o historico."),
        { id: toastId },
      );
    } finally {
      setExportingHistory(false);
    }
  }

  function renderPersonEditor(mode: "create" | "edit") {
    return (
      <div className="space-y-5 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h3 className="text-base font-semibold">
              {mode === "edit" ? "Editar pessoa" : "Criar pessoa"}
            </h3>
            <p className="text-sm text-muted-foreground">
              Cadastro unico para acesso recorrente e historico consolidado.
            </p>
          </div>
          {showSaveAction ? (
            <Button
              onClick={() => void handleSavePerson()}
              disabled={saving}
              className="sm:self-start"
            >
              {saving ? "Salvando..." : "Salvar pessoa"}
            </Button>
          ) : null}
        </div>

        <div className="grid gap-3 xl:grid-cols-3">
          <div className="space-y-2 xl:col-span-2">
            <Label>Nome completo</Label>
            <Input
              placeholder="Nome completo"
              value={form.fullName}
              onChange={(event) => setFormValue("fullName", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>CPF</Label>
            <Input
              placeholder="CPF"
              value={form.cpf}
              onChange={(event) => setFormValue("cpf", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <SearchableCombobox
              value={form.personType}
              onValueChange={(value) => handlePersonTypeChange(value)}
              options={formPersonTypeOptions}
              placeholder="Selecione o tipo"
              searchPlaceholder="Buscar tipo..."
              emptyMessage="Nenhum tipo encontrado."
            />
            <p className="text-xs text-muted-foreground">
              {formPolicy.description}
            </p>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <SearchableCombobox
              value={form.status}
              onValueChange={(value) => setFormValue("status", value)}
              options={formStatusOptions}
              placeholder="Selecione o status"
              searchPlaceholder="Buscar status..."
              emptyMessage="Nenhum status encontrado."
            />
          </div>
          <div className="space-y-2">
            <Label>Usina principal</Label>
            <SearchableCombobox
              value={form.homePlantId}
              onValueChange={(value) => setFormValue("homePlantId", value)}
              options={plantSelectOptions}
              placeholder="Sem usina principal"
              searchPlaceholder="Buscar usina..."
              emptyMessage="Nenhuma usina encontrada."
            />
          </div>
          {formPolicy.requiredFields
            .filter((field) => field.name !== "fullName")
            .map((field) => (
              <div key={field.name} className="space-y-2">
                <Label>{field.label}</Label>
                <Input
                  placeholder={field.placeholder}
                  value={field.name === "employer" ? form.employer : form.jobTitle}
                  onChange={(event) =>
                    setFormValue(
                      field.name === "employer" ? "employer" : "jobTitle",
                      event.target.value,
                    )
                  }
                />
              </div>
            ))}
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input
              placeholder="E-mail"
              value={form.email}
              onChange={(event) => setFormValue("email", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input
              placeholder="Telefone"
              value={form.phone}
              onChange={(event) => setFormValue("phone", event.target.value)}
            />
          </div>
          <div className="space-y-2 xl:col-span-3">
            <Label>URL da foto</Label>
            <Input
              placeholder="URL da foto"
              value={form.photoUrl}
              onChange={(event) => setFormValue("photoUrl", event.target.value)}
            />
          </div>
          <div className="space-y-2 xl:col-span-3">
            <Label>Observacoes administrativas</Label>
            <Textarea
              value={form.notes}
              onChange={(event) => setFormValue("notes", event.target.value)}
              placeholder="Observacoes administrativas"
            />
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

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Pessoas autorizadas</CardTitle>
            <CardDescription>
              {currentPlant
                ? `Funcionarios, visitantes, terceiros e qualquer pessoa vinculada a ${currentPlant.name}.`
                : "Funcionarios, visitantes, terceiros e qualquer pessoa que precise registrar acesso."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              data={people}
              columns={peopleColumns}
              getRowId={(person) => person.id}
              queryStateScope="peopleList"
              onRowClick={(person) => {
                if (!isCreatingNew && person.id === personId) {
                  resetForm();
                  void setPersonId(null);
                  return;
                }

                setIsCreatingNew(false);
                void setPersonId(person.id);
              }}
              isRowActive={(person) => person.id === personId}
              toolbar={
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_220px_220px_auto]">
                  <Input
                    value={search}
                    onChange={(event) => void setSearch(event.target.value)}
                    placeholder="Buscar por nome, CPF ou empresa"
                  />
                  <SearchableCombobox
                    value={status}
                    onValueChange={(value) => void setStatus(value || "ALL")}
                    options={statusOptions}
                    placeholder="Todos os status"
                    searchPlaceholder="Buscar status..."
                    emptyMessage="Nenhum status encontrado."
                  />
                  <SearchableCombobox
                    value={personType}
                    onValueChange={(value) =>
                      void setPersonType(value || "ALL")
                    }
                    options={personTypeOptions}
                    placeholder="Todos os tipos"
                    searchPlaceholder="Buscar tipo..."
                    emptyMessage="Nenhum tipo encontrado."
                  />
                  <Button
                    type="button"
                    onClick={() => {
                      setIsCreatingNew(true);
                      resetForm();
                      void setPersonId(null);
                    }}
                    size="lg"
                  >
                    <Plus className=" size-4" />
                    Criar pessoa
                  </Button>
                </div>
              }
              inlinePanel={
                isCreatingNew ? (
                  <div className="bg-muted/10">
                    {renderPersonEditor("create")}
                  </div>
                ) : null
              }
              expandedRowId={!isCreatingNew ? personId : null}
              renderInlineDetails={(row) => (
                <div className="space-y-6 bg-muted/10">
                  {renderPersonEditor("edit")}

                  {selectedPerson?.id === row.id ? (
                    <div className="grid gap-4 px-4 pb-4 sm:px-6 sm:pb-6 xl:grid-cols-[0.85fr_1.15fr]">
                      <Card>
                        <CardHeader>
                          <CardTitle>Resumo da pessoa</CardTitle>
                          <CardDescription>
                            {selectedPerson.fullName}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-border bg-card p-4">
                              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                Documento
                              </p>
                              <p className="mt-2 inline-flex items-center gap-2 text-sm">
                                <IdCard className="size-4 text-muted-foreground" />
                                {selectedPerson.cpf}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-border bg-card p-4">
                              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                Total trabalhado
                              </p>
                              <p className="mt-2 text-sm">
                                {formatMinutes(selectedPerson.totalMinutes)}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-border bg-card p-4">
                              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                Perfil
                              </p>
                              <p className="mt-2 text-sm">
                                {formatPersonTypeLabel(selectedPerson.personType)}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-border bg-card p-4">
                              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                Usina principal
                              </p>
                              <p className="mt-2 text-sm">
                                {selectedPerson.homePlant?.name ?? "-"}
                              </p>
                            </div>
                            {personSummaryFields.map((field) => (
                              <div
                                key={field.key}
                                className="rounded-2xl border border-border bg-card p-4"
                              >
                                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                  {field.label}
                                </p>
                                <p className="mt-2 text-sm">{field.value}</p>
                              </div>
                            ))}
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => void handleExportHistory()}
                            disabled={exportingHistory}
                            className="inline-flex items-center gap-2"
                          >
                            <Download className="size-4" />
                            {exportingHistory
                              ? "Exportando historico..."
                              : "Exportar historico CSV"}
                          </Button>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Historico de acesso</CardTitle>
                          <CardDescription>
                            Entradas, saidas e tempo total acumulado por
                            registro.
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <DataTable
                            data={selectedPerson.history}
                            columns={historyColumns}
                            getRowId={(entry) => entry.id}
                            queryStateScope="personHistory"
                            emptyMessage="Ainda sem historico."
                            showColumnVisibilityToggle={false}
                          />
                        </CardContent>
                      </Card>
                    </div>
                  ) : null}
                </div>
              )}
              emptyMessage="Nenhuma pessoa encontrada."
            />
          </CardContent>
        </Card>
      </section>

      {!isCreatingNew && !personId ? (
        <Card>
          <CardHeader>
            <CardTitle>Sem pessoa selecionada</CardTitle>
            <CardDescription>
              Escolha uma ficha ou crie uma nova.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <UsersRound className="size-4" />O cadastro suporta funcionarios,
              visitantes e terceiros.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
