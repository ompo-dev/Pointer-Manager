import { useState } from "react";
import { useListAuditoria } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Auditoria() {
  const [page, setPage] = useState(1);
  const [acaoFilter, setAcaoFilter] = useState("all");

  const { data, isLoading } = useListAuditoria(
    { 
      page, 
      limit: 20,
      acao: acaoFilter !== "all" ? acaoFilter : undefined
    },
    { query: { queryKey: ["auditoria", page, acaoFilter] } }
  );

  const getAcaoBadge = (acao: string) => {
    if (acao.startsWith('CREATE')) return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">{acao}</Badge>;
    if (acao.startsWith('UPDATE') || acao.startsWith('AJUSTE')) return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{acao}</Badge>;
    if (acao.startsWith('DELETE') || acao.startsWith('ENCERRAR')) return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">{acao}</Badge>;
    return <Badge variant="secondary">{acao}</Badge>;
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="h-8 w-8 text-primary" /> Auditoria
          </h2>
          <p className="text-muted-foreground mt-1">Histórico imutável de todas as ações realizadas no sistema.</p>
        </div>
        
        <Select value={acaoFilter} onValueChange={(val) => { setAcaoFilter(val); setPage(1); }}>
          <SelectTrigger className="w-[180px] bg-card">
            <SelectValue placeholder="Filtrar por ação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as ações</SelectItem>
            <SelectItem value="LOGIN">Login</SelectItem>
            <SelectItem value="CREATE_USINA">Criar Usina</SelectItem>
            <SelectItem value="UPDATE_USINA">Editar Usina</SelectItem>
            <SelectItem value="CREATE_FUNCIONARIO">Criar Func.</SelectItem>
            <SelectItem value="AJUSTE_PONTO">Ajuste de Ponto</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[180px]">Data / Hora</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Entidade</TableHead>
                <TableHead>Detalhes</TableHead>
                <TableHead className="text-right">IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(10)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : data?.data?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    Nenhum registro de auditoria encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                data?.data.map((log) => (
                  <TableRow key={log.id} className="text-sm font-mono hover:bg-muted/50">
                    <TableCell className="text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>{getAcaoBadge(log.acao)}</TableCell>
                    <TableCell className="font-sans font-medium">{log.usuarioNome || 'Sistema/App'}</TableCell>
                    <TableCell>{log.entidade} #{log.entidadeId}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate" title={log.detalhes || ''}>
                      {log.detalhes}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-xs">{log.ip}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {data && data.total > data.limit && (
        <div className="flex items-center justify-between px-2">
          <p className="text-sm text-muted-foreground">
            Mostrando <span className="font-medium">{(page - 1) * data.limit + 1}</span> a <span className="font-medium">{Math.min(page * data.limit, data.total)}</span> de <span className="font-medium">{data.total}</span> registros
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={page >= Math.ceil(data.total / data.limit)} onClick={() => setPage(p => p + 1)}>
              Próxima <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
