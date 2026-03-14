import { useState } from "react";
import { useListUsinas, useCreateUsina } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Search, Plus, MapPin, Wifi } from "lucide-react";
import { toast } from "sonner";

const usinaSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  cidade: z.string().min(1, "Cidade é obrigatória"),
  estado: z.string().min(2, "Estado é obrigatório").max(2),
  wifiAutorizado: z.string().min(1, "BSSID/Nome da rede é obrigatório"),
  horarioInicio: z.string().min(1, "Horário de início é obrigatório"),
  horarioFim: z.string().min(1, "Horário de fim é obrigatório"),
});

type UsinaFormValues = z.infer<typeof usinaSchema>;

export default function Usinas() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useCreateUsina();

  const { data: usinas, isLoading, refetch } = useListUsinas(
    { search: search || undefined },
    { query: { queryKey: ["usinas", search] } }
  );

  const form = useForm<UsinaFormValues>({
    resolver: zodResolver(usinaSchema),
    defaultValues: {
      nome: "",
      cidade: "",
      estado: "",
      wifiAutorizado: "",
      horarioInicio: "07:00",
      horarioFim: "17:00",
    }
  });

  const onSubmit = async (data: UsinaFormValues) => {
    try {
      await queryClient.mutateAsync({ data });
      toast.success("Usina criada com sucesso");
      setDialogOpen(false);
      form.reset();
      refetch();
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Erro ao criar usina");
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Usinas</h2>
          <p className="text-muted-foreground">Gerencie as usinas solares e seus horários.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar usinas..."
              className="pl-8 bg-card"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Nova Usina
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Usina</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
                  <FormField
                    control={form.control}
                    name="nome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome da Usina</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Usina Solar Alpha" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="cidade"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cidade</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: São Paulo" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="estado"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estado (UF)</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: SP" maxLength={2} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="wifiAutorizado"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Wi-Fi Autorizado (BSSID ou Nome)</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: WIFI_USINA_01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="horarioInicio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Horário Entrada</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="horarioFim"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Horário Saída</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={queryClient.isPending}>
                      {queryClient.isPending ? "Salvando..." : "Salvar Usina"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Localização</TableHead>
                <TableHead>Rede Wi-Fi</TableHead>
                <TableHead>Horário</TableHead>
                <TableHead>Trabalhando</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-8" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  </TableRow>
                ))
              ) : usinas?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    Nenhuma usina encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                usinas?.map((usina) => (
                  <TableRow key={usina.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="font-medium">
                      <Link href={`/usinas/${usina.id}`} className="hover:underline text-primary">
                        {usina.nome}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center text-muted-foreground text-sm">
                        <MapPin className="h-3 w-3 mr-1" />
                        {usina.cidade}/{usina.estado}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center text-muted-foreground text-sm">
                        <Wifi className="h-3 w-3 mr-1" />
                        {usina.wifiAutorizado}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {usina.horarioInicio} - {usina.horarioFim}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono">
                        {usina.funcionariosAtivos} / {usina.totalFuncionarios}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {usina.ativo ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                          Ativa
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-muted text-muted-foreground">
                          Inativa
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
