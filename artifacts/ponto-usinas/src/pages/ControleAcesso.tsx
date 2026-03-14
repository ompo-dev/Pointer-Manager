import { useState } from "react";
import { useListUsuarios, useCreateUsuario, useListUsinas } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Shield, Plus, UserCog } from "lucide-react";
import { toast } from "sonner";
const usuarioSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo de 6 caracteres"),
  perfil: z.enum(["admin", "gestor", "operador"]),
  usinaId: z.coerce.number().optional().nullable(),
});

export default function ControleAcesso() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: usuarios, isLoading, refetch } = useListUsuarios();
  const { data: usinas } = useListUsinas();
  const createMutation = useCreateUsuario();

  const form = useForm<z.infer<typeof usuarioSchema>>({
    resolver: zodResolver(usuarioSchema),
    defaultValues: {
      nome: "",
      email: "",
      password: "",
      perfil: "supervisor",
      usinaId: null,
    }
  });

  const onSubmit = async (data: z.infer<typeof usuarioSchema>) => {
    try {
      await createMutation.mutateAsync({ data: { ...data, usinaId: data.usinaId || null } });
      toast.success("Usuário criado com sucesso");
      setDialogOpen(false);
      form.reset();
      refetch();
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Erro ao criar usuário");
    }
  };

  const getPerfilBadge = (perfil: string) => {
    switch (perfil) {
      case 'super_admin': return <Badge variant="default" className="bg-purple-600 hover:bg-purple-700">Super Admin</Badge>;
      case 'administrador': return <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">Admin</Badge>;
      case 'supervisor': return <Badge variant="secondary">Supervisor</Badge>;
      default: return <Badge variant="outline">{perfil}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" /> Controle de Acesso
          </h2>
          <p className="text-muted-foreground mt-1">Gerencie quem tem acesso ao painel do sistema.</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Usuário de Sistema</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
                <FormField control={form.control} name="nome" render={({ field }) => (
                  <FormItem><FormLabel>Nome</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem><FormLabel>Senha</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="perfil" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Perfil de Acesso</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="super_admin">Super Administrador (Tudo)</SelectItem>
                        <SelectItem value="administrador">Administrador</SelectItem>
                        <SelectItem value="supervisor">Supervisor de Usina</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="usinaId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Usina (Apenas para Supervisor)</FormLabel>
                    <Select onValueChange={(val) => field.onChange(val === "null" ? null : parseInt(val))} value={field.value?.toString() || "null"}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="null">Acesso Global</SelectItem>
                        {usinas?.map(u => <SelectItem key={u.id} value={u.id.toString()}>{u.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Criando..." : "Criar Usuário"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Usina Restrita</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  </TableRow>
                ))
              ) : usuarios?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">Nenhum usuário cadastrado.</TableCell>
                </TableRow>
              ) : (
                usuarios?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium flex items-center gap-2">
                      <UserCog className="h-4 w-4 text-muted-foreground" />
                      {user.nome}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                    <TableCell>{getPerfilBadge(user.perfil)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.usinaId ? usinas?.find(u => u.id === user.usinaId)?.nome || `ID: ${user.usinaId}` : "Global"}
                    </TableCell>
                    <TableCell>
                      {user.ativo ? <Badge variant="outline" className="bg-green-50 text-green-700">Ativo</Badge> : <Badge variant="outline">Inativo</Badge>}
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
