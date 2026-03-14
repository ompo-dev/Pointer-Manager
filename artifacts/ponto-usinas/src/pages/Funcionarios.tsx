import { useState } from "react";
import { useListFuncionarios, useCreateFuncionario, useListUsinas } from "@workspace/api-client-react";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Search, Plus, UserCircle, Building2 } from "lucide-react";
import { toast } from "sonner";
const funcionarioSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  cpf: z.string().min(11, "CPF inválido").max(14),
  empresa: z.string().min(1, "Empresa é obrigatória"),
  cargo: z.string().min(1, "Cargo é obrigatório"),
  usinaId: z.coerce.number().optional().nullable(),
  telefone: z.string().optional().nullable(),
  status: z.enum(["ativo", "inativo", "afastado"]),
});

type FuncionarioFormValues = z.infer<typeof funcionarioSchema>;

export default function Funcionarios() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [sheetOpen, setSheetOpen] = useState(false);
  
  const queryClient = useCreateFuncionario();

  const { data: funcionarios, isLoading, refetch } = useListFuncionarios(
    { 
      search: search || undefined,
      status: statusFilter !== "todos" ? statusFilter : undefined
    },
    { query: { queryKey: ["funcionarios", search, statusFilter] } }
  );

  const { data: usinas } = useListUsinas({}, { query: { queryKey: ["usinas_list"] }});

  const form = useForm<FuncionarioFormValues>({
    resolver: zodResolver(funcionarioSchema),
    defaultValues: {
      nome: "",
      cpf: "",
      empresa: "",
      cargo: "",
      status: "ativo",
      telefone: "",
      usinaId: null,
    }
  });

  const onSubmit = async (data: FuncionarioFormValues) => {
    try {
      await queryClient.mutateAsync({ data: { ...data, usinaId: data.usinaId || null } });
      toast.success("Funcionário cadastrado com sucesso");
      setSheetOpen(false);
      form.reset();
      refetch();
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Erro ao cadastrar funcionário");
    }
  };

  const formatCpf = (cpf: string) => {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  const maskCpf = (cpf: string) => {
    return `***.${cpf.substring(3, 6)}.${cpf.substring(6, 9)}-**`;
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Funcionários</h2>
          <p className="text-muted-foreground">Gerencie a equipe e alocações nas usinas.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou CPF..."
              className="pl-8 bg-card"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] bg-card">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Status</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
              <SelectItem value="afastado">Afastado</SelectItem>
            </SelectContent>
          </Select>

          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Novo Funcionário
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Cadastrar Funcionário</SheetTitle>
              </SheetHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-6">
                  <FormField
                    control={form.control}
                    name="nome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Completo</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cpf"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPF (apenas números)</FormLabel>
                        <FormControl><Input maxLength={11} {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="empresa"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Empresa (Terceirizada)</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="cargo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cargo</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="telefone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone (opcional)</FormLabel>
                        <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="usinaId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Usina Alocada (Opcional)</FormLabel>
                        <Select 
                          onValueChange={(val) => field.onChange(val === "null" ? null : parseInt(val))} 
                          value={field.value?.toString() || "null"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione uma usina" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="null">Não alocado</SelectItem>
                            {usinas?.map(u => (
                              <SelectItem key={u.id} value={u.id.toString()}>{u.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="ativo">Ativo</SelectItem>
                            <SelectItem value="inativo">Inativo</SelectItem>
                            <SelectItem value="afastado">Afastado</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="pt-4">
                    <Button type="submit" className="w-full" disabled={queryClient.isPending}>
                      {queryClient.isPending ? "Salvando..." : "Cadastrar"}
                    </Button>
                  </div>
                </form>
              </Form>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Funcionário</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Empresa / Cargo</TableHead>
                <TableHead>Alocação</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  </TableRow>
                ))
              ) : funcionarios?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    Nenhum funcionário encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                funcionarios?.map((f) => (
                  <TableRow key={f.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <UserCircle className="w-5 h-5 text-primary/50" />
                        </div>
                        <Link href={`/funcionarios/${f.id}`} className="hover:underline text-primary">
                          {f.nome}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">
                      {maskCpf(f.cpf)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{f.empresa}</div>
                      <div className="text-xs text-muted-foreground">{f.cargo}</div>
                    </TableCell>
                    <TableCell>
                      {f.usinaNome ? (
                        <div className="flex items-center text-sm">
                          <Building2 className="w-3 h-3 mr-1 text-muted-foreground" />
                          {f.usinaNome}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm italic">Não alocado</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {f.status === 'ativo' && <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Ativo</Badge>}
                      {f.status === 'inativo' && <Badge variant="outline" className="bg-muted text-muted-foreground">Inativo</Badge>}
                      {f.status === 'afastado' && <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Afastado</Badge>}
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
