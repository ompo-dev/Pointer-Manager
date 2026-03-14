"use client";

import { useEffect } from "react";
import { ShieldCheck, UserCog } from "lucide-react";
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
import { defaultAccessPermissions, useAccessStore } from "@/store/access-store";

export function AccessScreen() {
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

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Controle de acesso administrativo</CardTitle>
            <CardDescription>
              Perfis Super Admin, Administrador e Supervisor de Usina com permissoes por modulo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow
                    key={user.id}
                    className="cursor-pointer"
                    onClick={() => selectUser(user.id)}
                  >
                    <TableCell>
                      <p className="font-semibold">{user.name}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </TableCell>
                    <TableCell>{user.role}</TableCell>
                    <TableCell>{user.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{selectedUserId ? "Editar usuario" : "Novo usuario"}</CardTitle>
            <CardDescription>Governanca por modulo para o painel operacional.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Nome" value={form.name} onChange={(event) => setFormValue("name", event.target.value)} />
            <Input placeholder="E-mail" value={form.email} onChange={(event) => setFormValue("email", event.target.value)} />
            <Input placeholder={selectedUserId ? "Nova senha opcional" : "Senha"} type="password" value={form.password} onChange={(event) => setFormValue("password", event.target.value)} />
            <Select
              value={form.role}
              onChange={(event) => {
                const role = event.target.value;
                setFormValue("role", role);
                setFormValue(
                  "modulePermissionsRaw",
                  defaultAccessPermissions[role as keyof typeof defaultAccessPermissions].join(", "),
                );
              }}
            >
              <option value="SUPER_ADMIN">Super Admin</option>
              <option value="ADMIN">Administrador</option>
              <option value="PLANT_SUPERVISOR">Supervisor de Usina</option>
            </Select>
            <Select value={form.status} onChange={(event) => setFormValue("status", event.target.value)}>
              <option value="ACTIVE">Ativo</option>
              <option value="INACTIVE">Inativo</option>
            </Select>
            <Select value={form.plantId} onChange={(event) => setFormValue("plantId", event.target.value)}>
              <option value="">Sem usina vinculada</option>
              {plantOptions.map((plant) => (
                <option key={plant.id} value={plant.id}>
                  {plant.name}
                </option>
              ))}
            </Select>
            <textarea
              className="min-h-[100px] w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none"
              value={form.modulePermissionsRaw}
              onChange={(event) => setFormValue("modulePermissionsRaw", event.target.value)}
              placeholder="dashboard, plants, people, time-entries, reports, access, audit"
            />
            {feedback ? (
              <p className="rounded-2xl border border-line bg-black/5 px-4 py-3 text-sm">{feedback}</p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <Button className="w-full" onClick={() => void saveUser()} disabled={saving}>
                <UserCog className="mr-2 size-4" />
                {saving ? "Salvando..." : "Salvar usuario"}
              </Button>
              <Button
                className="w-full"
                variant="secondary"
                onClick={() => {
                  resetForm();
                }}
              >
                <ShieldCheck className="mr-2 size-4" />
                Novo cadastro
              </Button>
            </div>

            {selectedUser ? (
              <div className="rounded-2xl border border-line bg-white/70 p-4 text-sm">
                <p className="font-semibold">{selectedUser.name}</p>
                <p className="break-words text-muted">Ultimo login: {selectedUser.lastLoginAt ?? "-"}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
