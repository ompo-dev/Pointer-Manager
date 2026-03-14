"use client";

import { useEffect } from "react";
import { parseAsString, useQueryState } from "nuqs";
import { Download, IdCard, UsersRound } from "lucide-react";
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
import { buildPersonHistoryExportUrl } from "@/lib/api/people";
import { formatDateTime, formatMinutes } from "@/lib/utils";
import { usePeopleStore } from "@/store/people-store";

export function PeopleScreen() {
  const [search, setSearch] = useQueryState("search", parseAsString.withDefault(""));
  const [status, setStatus] = useQueryState("status", parseAsString.withDefault("ALL"));
  const [personType, setPersonType] = useQueryState("personType", parseAsString.withDefault("ALL"));
  const [plantFilter, setPlantFilter] = useQueryState("plantId", parseAsString.withDefault(""));
  const [personId, setPersonId] = useQueryState("personId", parseAsString);
  const people = usePeopleStore((state) => state.people);
  const plantOptions = usePeopleStore((state) => state.plantOptions);
  const selectedPerson = usePeopleStore((state) => state.selectedPerson);
  const form = usePeopleStore((state) => state.form);
  const feedback = usePeopleStore((state) => state.feedback);
  const saving = usePeopleStore((state) => state.saving);
  const setFormValue = usePeopleStore((state) => state.setFormValue);
  const resetForm = usePeopleStore((state) => state.resetForm);
  const savePerson = usePeopleStore((state) => state.savePerson);

  useEffect(() => {
    if (!personId && people[0]?.id) {
      void setPersonId(people[0].id);
    }
  }, [people, personId, setPersonId]);

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Pessoas autorizadas</CardTitle>
            <CardDescription>
              Funcionarios, visitantes, terceiros e qualquer pessoa que precise registrar acesso.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Input
                value={search}
                onChange={(event) => void setSearch(event.target.value)}
                placeholder="Buscar por nome, CPF ou empresa"
              />
              <Select value={status} onChange={(event) => void setStatus(event.target.value)}>
                <option value="ALL">Todos os status</option>
                <option value="ACTIVE">Ativo</option>
                <option value="INACTIVE">Inativo</option>
                <option value="LEAVE">Afastado</option>
              </Select>
              <Select value={personType} onChange={(event) => void setPersonType(event.target.value)}>
                <option value="ALL">Todos os tipos</option>
                <option value="EMPLOYEE">Funcionario</option>
                <option value="CONTRACTOR">Terceirizado</option>
                <option value="VISITOR">Visitante</option>
                <option value="SUPERVISOR">Supervisor</option>
                <option value="SERVICE_PROVIDER">Prestador</option>
                <option value="OTHER">Outro</option>
              </Select>
              <Select value={plantFilter} onChange={(event) => void setPlantFilter(event.target.value)}>
                <option value="">Todas as usinas</option>
                {plantOptions.map((plant) => (
                  <option key={plant.id} value={plant.id}>
                    {plant.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-3">
              {people.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => void setPersonId(person.id)}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                    personId === person.id ? "border-ink bg-ink text-white" : "border-line bg-white/70"
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold">{person.fullName}</p>
                      <p className={`text-sm ${personId === person.id ? "text-white/75" : "text-muted"}`}>
                        {person.personType} | {person.cpf}
                      </p>
                    </div>
                    <div className="text-left text-sm sm:text-right">
                      <p>{person.employer}</p>
                      <p>{person._count?.timeEntries ?? 0} abertos</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{form.id ? "Editar pessoa" : "Nova pessoa"}</CardTitle>
            <CardDescription>Cadastro unico para acesso recorrente e historico consolidado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input placeholder="Nome completo" value={form.fullName} onChange={(event) => setFormValue("fullName", event.target.value)} />
              <Input placeholder="CPF" value={form.cpf} onChange={(event) => setFormValue("cpf", event.target.value)} />
              <Select value={form.personType} onChange={(event) => setFormValue("personType", event.target.value)}>
                <option value="EMPLOYEE">Funcionario</option>
                <option value="CONTRACTOR">Terceirizado</option>
                <option value="VISITOR">Visitante</option>
                <option value="SUPERVISOR">Supervisor</option>
                <option value="SERVICE_PROVIDER">Prestador</option>
                <option value="OTHER">Outro</option>
              </Select>
              <Select value={form.status} onChange={(event) => setFormValue("status", event.target.value)}>
                <option value="ACTIVE">Ativo</option>
                <option value="INACTIVE">Inativo</option>
                <option value="LEAVE">Afastado</option>
              </Select>
              <Input placeholder="Empresa" value={form.employer} onChange={(event) => setFormValue("employer", event.target.value)} />
              <Input placeholder="Cargo" value={form.jobTitle} onChange={(event) => setFormValue("jobTitle", event.target.value)} />
              <Input placeholder="E-mail" value={form.email} onChange={(event) => setFormValue("email", event.target.value)} />
              <Input placeholder="Telefone" value={form.phone} onChange={(event) => setFormValue("phone", event.target.value)} />
              <Input placeholder="URL da foto" value={form.photoUrl} onChange={(event) => setFormValue("photoUrl", event.target.value)} />
              <Select value={form.primaryPlantId} onChange={(event) => setFormValue("primaryPlantId", event.target.value)}>
                <option value="">Sem usina principal</option>
                {plantOptions.map((plant) => (
                  <option key={plant.id} value={plant.id}>
                    {plant.name}
                  </option>
                ))}
              </Select>
            </div>
            <textarea
              className="min-h-[100px] w-full rounded-2xl border border-line bg-white/90 px-4 py-3 text-sm outline-none"
              value={form.notes}
              onChange={(event) => setFormValue("notes", event.target.value)}
              placeholder="Observacoes administrativas"
            />
            {feedback ? (
              <p className="rounded-2xl border border-line bg-black/5 px-4 py-3 text-sm">{feedback}</p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                className="w-full"
                onClick={async () => {
                  const savedId = await savePerson();
                  if (savedId) {
                    void setPersonId(savedId);
                  }
                }}
                disabled={saving}
              >
                {saving ? "Salvando..." : "Salvar pessoa"}
              </Button>
              <Button
                className="w-full"
                variant="secondary"
                onClick={() => {
                  resetForm();
                  void setPersonId(null);
                }}
              >
                Nova ficha
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {selectedPerson ? (
        <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
          <Card>
            <CardHeader>
              <CardTitle>Resumo da pessoa</CardTitle>
              <CardDescription>{selectedPerson.fullName}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-line bg-white/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">Documento</p>
                  <p className="mt-2 inline-flex items-center gap-2 text-sm">
                    <IdCard className="size-4 text-muted" />
                    {selectedPerson.cpf}
                  </p>
                </div>
                <div className="rounded-2xl border border-line bg-white/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">Total trabalhado</p>
                  <p className="mt-2 text-sm">{formatMinutes(selectedPerson.totalMinutes)}</p>
                </div>
                <div className="rounded-2xl border border-line bg-white/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">Tipo</p>
                  <p className="mt-2 text-sm">{selectedPerson.personType}</p>
                </div>
                <div className="rounded-2xl border border-line bg-white/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">Usina principal</p>
                  <p className="mt-2 text-sm">{selectedPerson.primaryPlant?.name ?? "-"}</p>
                </div>
              </div>
              <a
                href={buildPersonHistoryExportUrl(selectedPerson.id)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl border border-line bg-white/80 px-4 py-3 text-sm font-semibold"
              >
                <Download className="size-4" />
                Exportar historico CSV
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historico de acesso</CardTitle>
              <CardDescription>
                Entradas, saidas e tempo total acumulado por registro.
              </CardDescription>
            </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usina</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Saida</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedPerson.history.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-sm text-muted-foreground">
                      Ainda sem historico.
                    </TableCell>
                  </TableRow>
                ) : (
                  selectedPerson.history.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <p className="font-semibold">{entry.plant.name}</p>
                      </TableCell>
                      <TableCell>{formatDateTime(entry.openedAt)}</TableCell>
                      <TableCell>{formatDateTime(entry.closedAt)}</TableCell>
                      <TableCell>{entry.status}</TableCell>
                      <TableCell>{formatMinutes(entry.totalMinutes)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        </section>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Sem pessoa selecionada</CardTitle>
            <CardDescription>Escolha uma ficha ou crie uma nova.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="inline-flex items-center gap-2 text-sm text-muted">
              <UsersRound className="size-4" />
              O cadastro suporta funcionarios, visitantes e terceiros.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
