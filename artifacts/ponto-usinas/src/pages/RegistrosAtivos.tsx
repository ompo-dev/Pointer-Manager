import { useState, useEffect } from "react";
import { useListRegistrosAtivos, useEncerrarRegistro, useListUsinas } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserCircle, MapPin, Clock, LogOut } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";

export default function RegistrosAtivos() {
  const [usinaId, setUsinaId] = useState<string>("all");
  const [now, setNow] = useState(new Date());

  // Update timer every minute for local display
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const { data: usinas } = useListUsinas({}, { query: { queryKey: ["usinas_select_ativos"] }});

  const { data: ativos, isLoading, refetch } = useListRegistrosAtivos(
    { usinaId: usinaId !== "all" ? parseInt(usinaId) : undefined },
    { query: { queryKey: ["registrosAtivos", usinaId], refetchInterval: 30000 } }
  );

  const encerrarMutation = useEncerrarRegistro();

  const handleEncerrar = async (id: number) => {
    if (!confirm("Tem certeza que deseja encerrar o ponto deste funcionário?")) return;
    try {
      await encerrarMutation.mutateAsync({ id });
      toast.success("Registro encerrado");
      refetch();
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Erro ao encerrar registro");
    }
  };

  const calcTempoNoLocal = (entrada: string) => {
    const start = new Date(entrada).getTime();
    const current = now.getTime();
    const diffMins = Math.floor((current - start) / 60000);
    const h = Math.floor(diffMins / 60);
    const m = diffMins % 60;
    return { h, m, totalMins: diffMins };
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            Ativos Agora
            <Badge variant="secondary" className="animate-pulse bg-green-500/10 text-green-600 hover:bg-green-500/20">
              Ao Vivo
            </Badge>
          </h2>
          <p className="text-muted-foreground mt-1">Monitore quem está trabalhando nas usinas neste momento.</p>
        </div>
        
        <Select value={usinaId} onValueChange={setUsinaId}>
          <SelectTrigger className="w-[200px] bg-card">
            <SelectValue placeholder="Filtrar por Usina" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Usinas</SelectItem>
            {usinas?.map(u => <SelectItem key={u.id} value={u.id.toString()}>{u.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : ativos?.length === 0 ? (
        <div className="text-center py-20 px-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
            <LogOut className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">Nenhum funcionário ativo</h3>
          <p className="text-muted-foreground max-w-sm mx-auto mt-2">
            Não há registros de ponto abertos nas usinas selecionadas no momento.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence>
            {ativos?.map((reg) => {
              const { h, m, totalMins } = calcTempoNoLocal(reg.dataHoraEntrada);
              const isOvertime = totalMins > 600; // 10 hours

              return (
                <motion.div
                  key={reg.registroId}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  layout
                >
                  <Card className={`overflow-hidden border transition-colors ${isOvertime ? 'border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.1)]' : 'border-border'}`}>
                    <div className={`h-2 ${isOvertime ? 'bg-orange-500' : 'bg-primary'}`} />
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                            {reg.funcionarioFotoUrl ? (
                              <img src={reg.funcionarioFotoUrl} alt={reg.funcionarioNome} className="w-full h-full object-cover" />
                            ) : (
                              <UserCircle className="w-6 h-6 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <h3 className="font-semibold text-sm line-clamp-1" title={reg.funcionarioNome}>{reg.funcionarioNome}</h3>
                            <p className="text-xs text-muted-foreground">{reg.funcionarioCargo}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-3 mb-5">
                        <div className="flex items-center text-sm text-muted-foreground">
                          <MapPin className="w-4 h-4 mr-2 shrink-0" />
                          <span className="truncate">{reg.usinaNome}</span>
                        </div>
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Clock className="w-4 h-4 mr-2 shrink-0" />
                          <span>Entrada: {new Date(reg.dataHoraEntrada).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        
                        <div className={`flex items-center justify-center p-2 rounded-md font-mono text-lg font-bold ${isOvertime ? 'bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400' : 'bg-secondary/50 text-foreground'}`}>
                          {h}h {m.toString().padStart(2, '0')}m
                        </div>
                      </div>
                      
                      <Button 
                        variant="outline" 
                        className={`w-full hover-elevate ${isOvertime ? 'border-orange-200 text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-950/50' : ''}`}
                        onClick={() => handleEncerrar(reg.registroId)}
                        disabled={encerrarMutation.isPending}
                      >
                        <LogOut className="w-4 h-4 mr-2" /> Encerrar Ponto
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
