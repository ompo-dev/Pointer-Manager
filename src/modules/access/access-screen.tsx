"use client";

import { useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { parseAsString, useQueryState } from "nuqs";
import { Plus, ShieldCheck, UserCog } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { ActiveStateBadge, UserRoleBadge } from "@/components/status-badges";
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
import { type AccessUser } from "@/lib/api/access";
import {
  defaultAccessPermissions,
  emptyAccessForm,
  useAccessStore,
} from "@/store/access-store";
import { formatModulePermissionLabel } from "@/lib/utils";

function buildComparableAccessForm(user?: AccessUser | null) {
  if (!user) {
    return emptyAccessForm;
  }

  return {
    name: user.name,
    email: user.email,
    password: "",
    role: user.role,
    status: user.status,
    plantId: user.plantId ?? "",
    modulePermissionsRaw: (
      user.modulePermissions ??
      defaultAccessPermissions[
        user.role as keyof typeof defaultAccessPermissions
      ] ??
      []
    ).join(", "),
  };
}

export function AccessScreen() {
  const [search, setSearch] = useQueryState(
    "search",
    parseAsString.withDefault(""),
  );
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const users = useAccessStore((state) => state.users);
  const plantOptions = useAccessStore((state) => state.plantOptions);
  const selectedUserId = useAccessStore((state) => state.selectedUserId);
  const form = useAccessStore((state) => state.form);
  const feedback = useAccessStore((state) => state.feedback);
  const saving = useAccessStore((state) => state.saving);
  const selectUser = useAccessStore((state) => state.selectUser);
  const setFormValue = useAccessStore((state) => state.setFormValue);
  const resetForm = useAccessStore((state) => state.resetForm);
  const saveUser = useAccessStore((state) => state.saveUser);

  const selectedUser = users.find((user) => user.id === selectedUserId) ?? null;
  const roleOptions = useMemo<SearchableOption[]>(
    () => [
      { value: "SUPER_ADMIN", label: "Super Admin" },
      { value: "ADMIN", label: "Administrador" },
      { value: "PLANT_SUPERVISOR", label: "Supervisor de Usina" },
    ],
    [],
  );
  const statusOptions = useMemo<SearchableOption[]>(
    () => [
      { value: "ACTIVE", label: "Ativo" },
      { value: "INACTIVE", label: "Inativo" },
    ],
    [],
  );
  const plantSelectOptions = useMemo<SearchableOption[]>(
    () => [
      { value: "", label: "Sem usina vinculada" },
      ...plantOptions.map((plant) => ({
        value: plant.id,
        label: plant.name,
        keywords: [plant.city, plant.state],
      })),
    ],
    [plantOptions],
  );
  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return users;
    }

    return users.filter((user) =>
      [user.name, user.email, user.role, user.status]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedSearch)),
    );
  }, [search, users]);

  const columns = useMemo<ColumnDef<AccessUser>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Usuario",
        cell: ({ row }) => (
          <div className="space-y-1 whitespace-normal">
            <p className="font-semibold">{row.original.name}</p>
            <p className="text-sm text-muted-foreground">
              {row.original.email}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "role",
        header: "Papel",
        cell: ({ row }) => <UserRoleBadge role={row.original.role} />,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <ActiveStateBadge status={row.original.status} />,
      },
    ],
    [],
  );

  const showSaveAction =
    JSON.stringify(form) !==
    JSON.stringify(
      isCreatingNew ? emptyAccessForm : buildComparableAccessForm(selectedUser),
    );

  async function handleSaveUser() {
    const savedId = await saveUser();
    if (savedId) {
      setIsCreatingNew(false);
      selectUser(savedId);
    }
  }

  function renderUserEditor(mode: "create" | "edit") {
    return (
      <div className="space-y-5 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h3 className="text-base font-semibold">
              {mode === "edit" ? "Editar usuario" : "Criar usuario"}
            </h3>
            <p className="text-sm text-muted-foreground">
              Governanca por modulo para o painel operacional.
            </p>
          </div>
          {showSaveAction ? (
            <Button
              onClick={() => void handleSaveUser()}
              disabled={saving}
              className="sm:self-start"
            >
              <UserCog className="mr-2 size-4" />
              {saving ? "Salvando..." : "Salvar usuario"}
            </Button>
          ) : null}
        </div>

        <div className="grid gap-3 xl:grid-cols-3">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input
              placeholder="Nome"
              value={form.name}
              onChange={(event) => setFormValue("name", event.target.value)}
            />
          </div>
          <div className="space-y-2 xl:col-span-2">
            <Label>E-mail</Label>
            <Input
              placeholder="E-mail"
              value={form.email}
              onChange={(event) => setFormValue("email", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Senha</Label>
            <Input
              placeholder={selectedUserId ? "Nova senha opcional" : "Senha"}
              type="password"
              value={form.password}
              onChange={(event) => setFormValue("password", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Papel</Label>
            <SearchableCombobox
              value={form.role}
              onValueChange={(role) => {
                setFormValue("role", role);
                setFormValue(
                  "modulePermissionsRaw",
                  defaultAccessPermissions[
                    role as keyof typeof defaultAccessPermissions
                  ].join(", "),
                );
              }}
              options={roleOptions}
              placeholder="Selecione o papel"
              searchPlaceholder="Buscar papel..."
              emptyMessage="Nenhum papel encontrado."
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <SearchableCombobox
              value={form.status}
              onValueChange={(value) => setFormValue("status", value)}
              options={statusOptions}
              placeholder="Selecione o status"
              searchPlaceholder="Buscar status..."
              emptyMessage="Nenhum status encontrado."
            />
          </div>
          <div className="space-y-2 xl:col-span-3">
            <Label>Usina vinculada</Label>
            <SearchableCombobox
              value={form.plantId}
              onValueChange={(value) => setFormValue("plantId", value)}
              options={plantSelectOptions}
              placeholder="Sem usina vinculada"
              searchPlaceholder="Buscar usina..."
              emptyMessage="Nenhuma usina encontrada."
            />
          </div>
          <div className="space-y-2 xl:col-span-3">
            <Label>Permissoes por modulo</Label>
            <Textarea
              value={form.modulePermissionsRaw}
              onChange={(event) =>
                setFormValue("modulePermissionsRaw", event.target.value)
              }
              placeholder="dashboard, plants, people, time-entries, reports, access, audit"
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
            <CardTitle>Controle de acesso administrativo</CardTitle>
            <CardDescription>
              Perfis Super Admin, Administrador e Supervisor de Usina com
              permissoes por modulo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              data={filteredUsers}
              columns={columns}
              getRowId={(user) => user.id}
              queryStateScope="accessUsers"
              onRowClick={(user) => {
                if (!isCreatingNew && user.id === selectedUserId) {
                  resetForm();
                  return;
                }

                setIsCreatingNew(false);
                selectUser(user.id);
              }}
              isRowActive={(user) => user.id === selectedUserId}
              initialPageSize={8}
              toolbar={
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <Input
                    value={search}
                    onChange={(event) => void setSearch(event.target.value)}
                    placeholder="Buscar por nome, e-mail ou papel"
                  />
                  <Button
                    type="button"
                    onClick={() => {
                      setIsCreatingNew(true);
                      resetForm();
                    }}
                    size="lg"
                  >
                    <Plus className=" size-4" />
                    Criar usuario
                  </Button>
                </div>
              }
              inlinePanel={
                isCreatingNew ? (
                  <div className="bg-muted/10">
                    {renderUserEditor("create")}
                  </div>
                ) : null
              }
              expandedRowId={!isCreatingNew ? selectedUserId : null}
              getDetailTitle={(row) => row.name}
              getDetailDescription={(row) => row.email}
              renderInlineDetails={(row) => (
                <div className="space-y-6 bg-muted/10">
                  {renderUserEditor("edit")}

                  {selectedUser?.id === row.id ? (
                    <div className="grid gap-4 px-4 pb-4 sm:px-6 sm:pb-6 xl:grid-cols-3">
                      <Card>
                        <CardHeader>
                          <CardTitle>Resumo do acesso</CardTitle>
                          <CardDescription>{selectedUser.name}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                          <p className="break-words">{selectedUser.email}</p>
                          <div className="flex flex-wrap gap-2">
                            <UserRoleBadge role={selectedUser.role} />
                            <ActiveStateBadge status={selectedUser.status} />
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Permissoes</CardTitle>
                          <CardDescription>
                            Escopo operacional efetivo
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          {selectedUser.modulePermissions?.length ? (
                            selectedUser.modulePermissions.map((permission) => (
                              <p
                                key={permission}
                                className="rounded-2xl border border-border bg-card px-3 py-2"
                              >
                                {formatModulePermissionLabel(permission)}
                              </p>
                            ))
                          ) : (
                            <p className="text-muted-foreground">
                              Sem permissoes explicitas.
                            </p>
                          )}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Ultima atividade</CardTitle>
                          <CardDescription>
                            Contexto do usuario administrativo
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                          <p>Ultimo login: {selectedUser.lastLoginAt ?? "-"}</p>
                          <p>
                            Usina vinculada:{" "}
                            {plantOptions.find(
                              (plant) => plant.id === selectedUser.plantId,
                            )?.name ?? "-"}
                          </p>
                          <p className="text-muted-foreground">
                            Usuarios administrativos podem operar conforme os
                            modulos liberados acima.
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  ) : null}
                </div>
              )}
              emptyMessage="Nenhum usuario encontrado."
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
