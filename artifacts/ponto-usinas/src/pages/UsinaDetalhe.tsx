import { useParams, Link } from "wouter";
import { useGetUsina, useGetUsinaQrcode, useGetUsinaFuncionarios, useUpdateUsina } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, MapPin, Clock, Wifi, QrCode, Download, Edit } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const updateUsinaSchema = z.object({
  nome: z.string().min(1),
  cidade: z.string().min(1),
  estado: z.string().min(2).max(2),
  wifiAutorizado: z.string().min(1),
  horarioInicio: z.string().min(1),
  horarioFim: z.string().min(1),
  ativo: z.boolean(),
});

export default function UsinaDetalhe() {
  const { id } = useParams();
  const usinaId = parseInt(id || "0", 10);
  
  const { data: usina, isLoading, refetch } = useGetUsina(usinaId, {
    query: { enabled: !!usinaId, queryKey: ["usina", usinaId] }
  });
  
  const { data: qrcode } = useGetUsinaQrcode(usinaId, {
    query: { enabled: !!usinaId, queryKey: ["usinaQrcode", usinaId] }
  });

  const { data: funcionariosAtivos, isLoading: isLoadingFuncs } = useGetUsinaFuncionarios(usinaId, {
    query: { enabled: !!usinaId, queryKey: ["usinaFuncionarios", usinaId], refetchInterval: 30000 }
  });

  const updateMutation = useUpdateUsina();
  const [editOpen, setEditOpen] = useState(false);

  const form = useForm<z.infer<typeof updateUsinaSchema>>({
    resolver: zodResolver(updateUsinaSchema),
    values: {
      nome: usina?.nome || "",
      cidade: usina?.cidade || "",
      estado: usina?.estado || "",
      wifiAutorizado: usina?.wifiAutorizado || "",
      horarioInicio: usina?.horarioInicio || "07:00",
      horarioFim: usina?.horarioFim || "17:00",
      ativo: usina?.ativo ?? true,
    }
  });

  const onSubmit = async (data: z.infer<typeof updateUsinaSchema>) => {
    try {
      await updateMutation.mutateAsync({ id: usinaId, data });
      toast.success("Usina atualizada com sucesso");
      setEditOpen(false);
      refetch();
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Erro ao atualizar usina");
    }
  };

  const handleDownloadQR = () => {
    const svg = document.getElementById("qr-code");
    if (!svg) return;
    
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `qrcode-${usina?.nome.replace(/\s+/g, '-').toLowerCase() || 'usina'}.png`;
      downloadLink.href = `${pngFile}`;
      downloadLink.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-10 w-48 mb-4" />
        <Skeleton className="h-32 w-full" />
        <div className="grid md:grid-cols-3 gap-6">
          <Skeleton className="col-span-2 h-96" />
          <Skeleton className="col-span-1 h-96" />
        </div>
      </div>
    );
  }

  if (!usina) return <div className="p-6">Usina não encontrada</div>;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/usinas">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            {usina.nome}
            {usina.ativo ? (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Ativa</Badge>
            ) : (
              <Badge variant="outline" className="bg-muted text-muted-foreground">Inativa</Badge>
            )}
          </h2>
          <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
            <div className="flex items-center"><MapPin className="h-4 w-4 mr-1" /> {usina.cidade}, {usina.estado}</div>
            <div className="flex items-center"><Clock className="h-4 w-4 mr-1" /> {usina.horarioInicio} às {usina.horarioFim}</div>
            <div className="flex items-center"><Wifi className="h-4 w-4 mr-1" /> {usina.wifiAutorizado}</div>
          </div>
        </div>
        
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogTrigger asChild>
            <Button variant="outline"><Edit className="w-4 h-4 mr-2" /> Editar</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Usina</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
                <FormField control={form.control} name="nome" render={({ field }) => (
                  <FormItem><FormLabel>Nome</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="cidade" render={({ field }) => (
                    <FormItem><FormLabel>Cidade</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="estado" render={({ field }) => (
                    <FormItem><FormLabel>Estado</FormLabel><FormControl><Input maxLength={2} {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="wifiAutorizado" render={({ field }) => (
                  <FormItem><FormLabel>Wi-Fi</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="horarioInicio" render={({ field }) => (
                    <FormItem><FormLabel>Horário Entrada</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="horarioFim" render={({ field }) => (
                    <FormItem><FormLabel>Horário Saída</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="ativo" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Status da Usina</FormLabel>
                      <CardDescription>Usinas inativas não permitem novos registros.</CardDescription>
                    </div>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  </FormItem>
                )} />
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Funcionários Presentes</CardTitle>
              <CardDescription>Atualizado em tempo real</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Tempo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingFuncs ? (
                    <TableRow><TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                  ) : funcionariosAtivos?.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum funcionário na usina no momento.</TableCell></TableRow>
                  ) : (
                    funcionariosAtivos?.map(f => (
                      <TableRow key={f.registroId}>
                        <TableCell className="font-medium">
                          <Link href={`/funcionarios/${f.funcionarioId}`} className="hover:underline">
                            {f.funcionarioNome}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{f.funcionarioCargo}</TableCell>
                        <TableCell className="text-sm">{new Date(f.dataHoraEntrada).toLocaleTimeString()}</TableCell>
                        <TableCell><Badge variant="secondary">{Math.floor(f.minutosNoLocal / 60)}h {f.minutosNoLocal % 60}m</Badge></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="text-center pb-2">
              <CardTitle className="flex items-center justify-center gap-2">
                <QrCode className="w-5 h-5" /> QR Code de Ponto
              </CardTitle>
              <CardDescription>Imprima e cole na entrada da usina</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center space-y-6 py-6">
              {qrcode ? (
                <>
                  <div className="bg-white p-4 rounded-xl shadow-sm border">
                    <QRCodeSVG 
                      id="qr-code"
                      value={qrcode.url} 
                      size={200}
                      level="H"
                      includeMargin={false}
                    />
                  </div>
                  <Button variant="secondary" className="w-full" onClick={handleDownloadQR}>
                    <Download className="w-4 h-4 mr-2" /> Baixar QR Code
                  </Button>
                  <p className="text-xs text-center text-muted-foreground break-all px-4">
                    {qrcode.url}
                  </p>
                </>
              ) : (
                <Skeleton className="w-[200px] h-[200px] rounded-xl" />
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resumo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Total de Funcionários</span>
                <span className="font-bold">{usina.totalFuncionarios}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Presentes Agora</span>
                <span className="font-bold text-primary">{usina.funcionariosAtivos}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cadastrada em</span>
                <span className="text-sm">{new Date(usina.createdAt).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
