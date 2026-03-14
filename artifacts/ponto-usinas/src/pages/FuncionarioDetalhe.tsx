import { useParams, Link } from "wouter";
import { useGetFuncionario, useGetFuncionarioHistorico, useUpdateFuncionario, useListUsinas } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Building2, Briefcase, Phone, CreditCard, Edit, Calendar } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
const updateFuncionarioSchema = z.object({
  nome: z.string().min(1),
  cpf: z.string().min(11).max(14),
  empresa: z.string().min(1),
  cargo: z.string().min(1),
  telefone: z.string().optional().nullable(),
  usinaId: z.coerce.number().optional().nullable(),
  status: z.enum(["ativo", "inativo", "afastado"]),
});

export default function FuncionarioDetalhe() {
  const { id } = useParams();
  const funcionarioId = parseInt(id || "0", 10);
  
  const { data: funcionario, isLoading, refetch } = useGetFuncionario(funcionarioId, {
    query: { enabled: !!funcionarioId, queryKey: ["funcionario", funcionarioId] }
  });

  const { data: usinas } = useListUsinas({}, { query: { queryKey: ["usinas_list"] }});
  
  const d = new Date();
  const primeiroDia = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
  
  const [dataInicio, setDataInicio] = useState(primeiroDia);
  const [dataFim, setDataFim] = useState(ultimoDia);

  const { data: historico, isLoading: isLoadingHist } = useGetFuncionarioHistorico(funcionarioId, {
    query: { 
      enabled: !!funcionarioId, 
      queryKey: ["funcionarioHistorico", funcionarioId, dataInicio, dataFim] 
    }
  });

  const updateMutation = useUpdateFuncionario();
  const [editOpen, setEditOpen] = useState(false);

  const form = useForm<z.infer<typeof updateFuncionarioSchema>>({
    resolver: zodResolver(updateFuncionarioSchema),
    values: {
      nome: funcionario?.nome || "",
      cpf: funcionario?.cpf || "",
      empresa: funcionario?.empresa || "",
      cargo: funcionario?.cargo || "",
      telefone: funcionario?.telefone || "",
      usinaId: funcionario?.usinaId || null,
      status: funcionario?.status || "ativo",
    }
  });

  const onSubmit = async (data: z.infer<typeof updateFuncionarioSchema>) => {
    try {
      await updateMutation.mutateAsync({ id: funcionarioId, data: { ...data, usinaId: data.usinaId || null } });
      toast.success("Funcionário atualizado");
      setEditOpen(false);
      refetch();
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Erro ao atualizar funcionário");
    }
  };

  const formatCpf = (cpf: string) => {
    if (!cpf) return "";
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  const calcularHoras = (minutos: number | null) => {
    if (!minutos) return "--";
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return `${h}h ${m}m`;
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-10 w-48 mb-4" />
        <div className="grid md:grid-cols-4 gap-6">
          <Skeleton className="col-span-1 h-64" />
          <Skeleton className="col-span-3 h-96" />
        </div>
      </div>
    );
  }

  if (!funcionario) return <div className="p-6">Funcionário não encontrado</div>;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/funcionarios">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover-elevate">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h2 className="text-3xl font-bold tracking-tight">{funcionario.nome}</h2>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-6">
        <div className="col-span-1 space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <CardTitle>Perfil</CardTitle>
                <Dialog open={editOpen} onOpenChange={setEditOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover-elevate"><Edit className="h-4 w-4" /></Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Editar Funcionário</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
                        <FormField control={form.control} name="nome" render={({ field }) => (
                          <FormItem><FormLabel>Nome</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="cpf" render={({ field }) => (
                          <FormItem><FormLabel>CPF</FormLabel><FormControl><Input maxLength={11} {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField control={form.control} name="empresa" render={({ field }) => (
                            <FormItem><FormLabel>Empresa</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name="cargo" render={({ field }) => (
                            <FormItem><FormLabel>Cargo</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                        </div>
                        <FormField control={form.control} name="telefone" render={({ field }) => (
                          <FormItem><FormLabel>Telefone</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="usinaId" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Usina Alocada</FormLabel>
                            <Select onValueChange={(val) => field.onChange(val === "null" ? null : parseInt(val))} value={field.value?.toString() || "null"}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="null">Não alocado</SelectItem>
                                {usinas?.map(u => <SelectItem key={u.id} value={u.id.toString()}>{u.nome}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="status" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="ativo">Ativo</SelectItem>
                                <SelectItem value="inativo">Inativo</SelectItem>
                                <SelectItem value="afastado">Afastado</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <div className="flex justify-end pt-4">
                          <Button type="submit" disabled={updateMutation.isPending}>Salvando...</Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono text-sm">{formatCpf(funcionario.cpf)}</span>
              </div>
              <div className="flex items-center gap-3">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{funcionario.empresa}</span>
              </div>
              <div className="flex items-center gap-3">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{funcionario.cargo}</span>
              </div>
              {funcionario.telefone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{funcionario.telefone}</span>
                </div>
              )}
              
              <div className="pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">Alocação Atual</p>
                {funcionario.usinaNome ? (
                  <Badge variant="secondary" className="w-full justify-center text-sm py-1">
                    {funcionario.usinaNome}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="w-full justify-center text-muted-foreground text-sm py-1">
                    Não alocado
                  </Badge>
                )}
              </div>
              
              <div className="pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">Status</p>
                {funcionario.status === 'ativo' && <Badge className="bg-green-500 hover:bg-green-600 text-white w-full justify-center">Ativo</Badge>}
                {funcionario.status === 'inativo' && <Badge variant="secondary" className="w-full justify-center">Inativo</Badge>}
                {funcionario.status === 'afastado' && <Badge variant="destructive" className="w-full justify-center">Afastado</Badge>}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-3">
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle>Histórico de Ponto</CardTitle>
                <CardDescription>Registros de entrada e saída</CardDescription>
              </div>
              <div className="flex gap-2">
                <Input 
                  type="date" 
                  value={dataInicio} 
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-[140px] h-9 text-sm"
                />
                <Input 
                  type="date" 
                  value={dataFim} 
                  onChange={(e) => setDataFim(e.target.value)}
                  className="w-[140px] h-9 text-sm"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Usina</TableHead>
                      <TableHead>Entrada</TableHead>
                      <TableHead>Saída</TableHead>
                      <TableHead>Duração</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingHist ? (
                      [...Array(3)].map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell>
                        </TableRow>
                      ))
                    ) : historico?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                          Nenhum registro no período selecionado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      historico?.map((reg) => (
                        <TableRow key={reg.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {new Date(reg.dataHoraEntrada).toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{reg.usinaNome}</TableCell>
                          <TableCell className="text-sm">{new Date(reg.dataHoraEntrada).toLocaleTimeString()}</TableCell>
                          <TableCell className="text-sm">
                            {reg.dataHoraSaida ? new Date(reg.dataHoraSaida).toLocaleTimeString() : "--"}
                          </TableCell>
                          <TableCell className="text-sm font-mono">{calcularHoras(reg.totalMinutos)}</TableCell>
                          <TableCell>
                            {reg.status === 'aberto' && <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Aberto</Badge>}
                            {reg.status === 'finalizado' && <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Finalizado</Badge>}
                            {reg.status === 'ajustado' && <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Ajustado</Badge>}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
