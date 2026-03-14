import { useState } from "react";
import { useListRegistros, useAjustarRegistro, useListUsinas } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, Filter, Edit2, Smartphone, Monitor, Info } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const ajustarSchema = z.object({
  dataHoraEntrada: z.string().optional(),
  dataHoraSaida: z.string().optional().nullable(),
  observacoes: z.string().min(5, "Motivo do ajuste é obrigatório"),
});

export default function Registros() {
  const d = new Date();
  const pDia = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  const uDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];

  const [dataInicio, setDataInicio] = useState(pDia);
  const [dataFim, setDataFim] = useState(uDia);
  const [usinaId, setUsinaId] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);

  const { data: usinas } = useListUsinas({}, { query: { queryKey: ["usinas_select"] }});

  const { data, isLoading, refetch } = useListRegistros(
    { 
      dataInicio, 
      dataFim, 
      usinaId: usinaId !== "all" ? parseInt(usinaId) : undefined,
      status: status !== "all" ? status : undefined,
      page,
      limit: 20
    },
    { query: { queryKey: ["registros", dataInicio, dataFim, usinaId, status, page] } }
  );

  const ajustarMutation = useAjustarRegistro();
  const [ajustarRegId, setAjustarRegId] = useState<number | null>(null);

  const form = useForm<z.infer<typeof ajustarSchema>>({
    resolver: zodResolver(ajustarSchema),
    defaultValues: { observacoes: "", dataHoraEntrada: "", dataHoraSaida: "" }
  });

  const handleAjustarClick = (reg: any) => {
    setAjustarRegId(reg.id);
    form.reset({
      dataHoraEntrada: new Date(reg.dataHoraEntrada).toISOString().slice(0, 16),
      dataHoraSaida: reg.dataHoraSaida ? new Date(reg.dataHoraSaida).toISOString().slice(0, 16) : "",
      observacoes: reg.observacoes || "",
    });
  };

  const onAjustar = async (formData: z.infer<typeof ajustarSchema>) => {
    if (!ajustarRegId) return;
    try {
      await ajustarMutation.mutateAsync({ 
        id: ajustarRegId, 
        data: {
          dataHoraEntrada: formData.dataHoraEntrada ? new Date(formData.dataHoraEntrada).toISOString() : undefined,
          dataHoraSaida: formData.dataHoraSaida ? new Date(formData.dataHoraSaida).toISOString() : null,
          observacoes: formData.observacoes
        } 
      });
      toast.success("Registro ajustado com sucesso");
      setAjustarRegId(null);
      refetch();
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Erro ao ajustar registro");
    }
  };

  const formatMinutos = (min: number | null) => {
    if (!min) return "--";
    return `${Math.floor(min/60)}h ${min%60}m`;
  };

  const getDeviceIcon = (device: string | null) => {
    if (!device) return null;
    if (device.toLowerCase().includes('mobile') || device.toLowerCase().includes('android') || device.toLowerCase().includes('iphone')) {
      return <Smartphone className="h-4 w-4 text-muted-foreground" />;
    }
    return <Monitor className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Registros de Ponto</h2>
        <p className="text-muted-foreground">Histórico completo de entradas e saídas.</p>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-4 flex flex-wrap gap-4 items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Início</label>
            <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-[140px]" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Fim</label>
            <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-[140px]" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Usina</label>
            <Select value={usinaId} onValueChange={setUsinaId}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Usinas</SelectItem>
                {usinas?.map(u => <SelectItem key={u.id} value={u.id.toString()}>{u.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Filter className="h-3 w-3" /> Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="aberto">Abertos</SelectItem>
                <SelectItem value="finalizado">Finalizados</SelectItem>
                <SelectItem value="ajustado">Ajustados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Funcionário</TableHead>
                <TableHead>Usina</TableHead>
                <TableHead>Horários</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : data?.data?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">Nenhum registro encontrado.</TableCell>
                </TableRow>
              ) : (
                data?.data.map((reg) => (
                  <TableRow key={reg.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium text-sm whitespace-nowrap">
                      {new Date(reg.dataHoraEntrada).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{reg.funcionarioNome}</div>
                      <div className="text-xs text-muted-foreground font-mono">{reg.funcionarioCpf}</div>
                    </TableCell>
                    <TableCell className="text-sm">{reg.usinaNome}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-sm">
                        <span className="flex items-center gap-2 text-green-600 dark:text-green-500">
                          E: {new Date(reg.dataHoraEntrada).toLocaleTimeString()}
                          <Tooltip>
                            <TooltipTrigger>{getDeviceIcon(reg.dispositivo)}</TooltipTrigger>
                            <TooltipContent><p className="text-xs">{reg.ip} - {reg.dispositivo}</p></TooltipContent>
                          </Tooltip>
                        </span>
                        {reg.dataHoraSaida ? (
                          <span className="text-orange-600 dark:text-orange-500">
                            S: {new Date(reg.dataHoraSaida).toLocaleTimeString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">Sem saída</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{formatMinutos(reg.totalMinutos)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {reg.status === 'aberto' && <Badge variant="outline" className="bg-blue-50 text-blue-700">Aberto</Badge>}
                        {reg.status === 'finalizado' && <Badge variant="outline" className="bg-green-50 text-green-700">Finalizado</Badge>}
                        {reg.status === 'ajustado' && <Badge variant="outline" className="bg-orange-50 text-orange-700">Ajustado</Badge>}
                        {reg.observacoes && (
                          <Tooltip>
                            <TooltipTrigger><Info className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
                            <TooltipContent><p className="max-w-[200px] text-xs">{reg.observacoes}</p></TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Dialog open={ajustarRegId === reg.id} onOpenChange={(open) => !open && setAjustarRegId(null)}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => handleAjustarClick(reg)} className="hover-elevate">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Ajustar Registro</DialogTitle></DialogHeader>
                          <Form {...form}>
                            <form onSubmit={form.handleSubmit(onAjustar)} className="space-y-4">
                              <FormField control={form.control} name="dataHoraEntrada" render={({ field }) => (
                                <FormItem><FormLabel>Entrada (Data e Hora)</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl></FormItem>
                              )} />
                              <FormField control={form.control} name="dataHoraSaida" render={({ field }) => (
                                <FormItem><FormLabel>Saída (Data e Hora)</FormLabel><FormControl><Input type="datetime-local" {...field} value={field.value || ''} /></FormControl></FormItem>
                              )} />
                              <FormField control={form.control} name="observacoes" render={({ field }) => (
                                <FormItem><FormLabel>Motivo do Ajuste</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                              )} />
                              <Button type="submit" className="w-full" disabled={ajustarMutation.isPending}>Salvar Ajuste</Button>
                            </form>
                          </Form>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {data && data.total > data.limit && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
          <span className="py-2 text-sm text-muted-foreground">Página {page} de {Math.ceil(data.total / data.limit)}</span>
          <Button variant="outline" disabled={page >= Math.ceil(data.total / data.limit)} onClick={() => setPage(p => p + 1)}>Próxima</Button>
        </div>
      )}
    </div>
  );
}
