import { useState } from "react";
import { useRelatorioHorasFuncionario, useRelatorioHorasUsina, useRelatorioPresenca, useListUsinas } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Calendar as CalendarIcon, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Relatorios() {
  const d = new Date();
  const pDia = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  const uDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];

  const [dataInicio, setDataInicio] = useState(pDia);
  const [dataFim, setDataFim] = useState(uDia);
  const [usinaId, setUsinaId] = useState<string>("all");

  const { data: usinas } = useListUsinas({}, { query: { queryKey: ["usinas_relatorios"] }});

  const { data: horasFuncionario, isLoading: loadingFunc } = useRelatorioHorasFuncionario(
    { dataInicio, dataFim, usinaId: usinaId !== "all" ? parseInt(usinaId) : undefined },
    { query: { queryKey: ["rel_horas_func", dataInicio, dataFim, usinaId] } }
  );

  const { data: horasUsina, isLoading: loadingUsina } = useRelatorioHorasUsina(
    { dataInicio, dataFim },
    { query: { queryKey: ["rel_horas_usina", dataInicio, dataFim] } }
  );

  const { data: presenca, isLoading: loadingPresenca } = useRelatorioPresenca(
    { dataInicio, dataFim, usinaId: usinaId !== "all" ? parseInt(usinaId) : undefined },
    { query: { queryKey: ["rel_presenca", dataInicio, dataFim, usinaId] } }
  );

  const formatHoras = (horasDecimal: number) => {
    const h = Math.floor(horasDecimal);
    const m = Math.round((horasDecimal - h) * 60);
    return `${h}h ${m}m`;
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto print:p-0 print:m-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Relatórios</h2>
          <p className="text-muted-foreground">Análise de horas, presenças e produtividade.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" /> Imprimir
          </Button>
          <Button>
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
        </div>
      </div>

      <Card className="print:hidden border-border/50">
        <CardContent className="p-4 flex flex-wrap gap-4 items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Data Início</label>
            <div className="relative">
              <CalendarIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-[150px] pl-8" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Data Fim</label>
            <div className="relative">
              <CalendarIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-[150px] pl-8" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Filtrar por Usina</label>
            <Select value={usinaId} onValueChange={setUsinaId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Usinas</SelectItem>
                {usinas?.map(u => <SelectItem key={u.id} value={u.id.toString()}>{u.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold">Relatório de Ponto - SolarPonto</h1>
        <p className="text-muted-foreground">Período: {new Date(dataInicio).toLocaleDateString()} a {new Date(dataFim).toLocaleDateString()}</p>
      </div>

      <Tabs defaultValue="horas_func" className="space-y-6">
        <TabsList className="bg-muted/50 p-1 print:hidden">
          <TabsTrigger value="horas_func">Horas por Funcionário</TabsTrigger>
          <TabsTrigger value="horas_usina">Horas por Usina</TabsTrigger>
          <TabsTrigger value="presenca">Presença Diária</TabsTrigger>
        </TabsList>

        <TabsContent value="horas_func" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Total de Horas por Funcionário</CardTitle>
              <CardDescription>Soma de horas trabalhadas no período selecionado</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Usina Alocada</TableHead>
                    <TableHead className="text-center">Dias Trab.</TableHead>
                    <TableHead className="text-center">Registros</TableHead>
                    <TableHead className="text-right">Total Horas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingFunc ? (
                    <TableRow><TableCell colSpan={6} className="h-24 text-center">Carregando...</TableCell></TableRow>
                  ) : horasFuncionario?.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="h-24 text-center">Nenhum dado encontrado.</TableCell></TableRow>
                  ) : (
                    horasFuncionario?.map((item) => (
                      <TableRow key={item.funcionarioId}>
                        <TableCell className="font-medium">{item.funcionarioNome}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{item.empresa}</TableCell>
                        <TableCell className="text-sm">{item.usinaNome || "-"}</TableCell>
                        <TableCell className="text-center text-sm">{item.diasTrabalhados}</TableCell>
                        <TableCell className="text-center text-sm">{item.totalRegistros}</TableCell>
                        <TableCell className="text-right font-mono font-medium">{formatHoras(item.totalHoras)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="horas_usina" className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Resumo por Usina</CardTitle>
                <CardDescription>Horas totais trabalhadas em cada usina</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead>Usina</TableHead>
                      <TableHead className="text-center">Funcionários</TableHead>
                      <TableHead className="text-right">Total Horas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingUsina ? (
                      <TableRow><TableCell colSpan={3} className="h-24 text-center">Carregando...</TableCell></TableRow>
                    ) : horasUsina?.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="h-24 text-center">Nenhum dado encontrado.</TableCell></TableRow>
                    ) : (
                      horasUsina?.map((item) => (
                        <TableRow key={item.usinaId}>
                          <TableCell className="font-medium">{item.usinaNome}</TableCell>
                          <TableCell className="text-center text-sm">{item.totalFuncionarios}</TableCell>
                          <TableCell className="text-right font-mono font-medium">{formatHoras(item.totalHoras)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="print:hidden">
              <CardHeader>
                <CardTitle>Gráfico de Horas</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                {horasUsina && horasUsina.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={horasUsina} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="usinaNome" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} 
                        angle={-45} textAnchor="end" height={60}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} 
                      />
                      <Tooltip 
                        cursor={{ fill: "hsl(var(--muted)/0.5)" }}
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                      />
                      <Bar 
                        dataKey="totalHoras" 
                        name="Horas" 
                        fill="hsl(var(--primary))" 
                        radius={[4, 4, 0, 0]} 
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">Sem dados para o gráfico</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="presenca" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Diário de Presença</CardTitle>
              <CardDescription>Detalhamento de presença por dia</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Usina</TableHead>
                    <TableHead className="text-right">Horas Trab.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingPresenca ? (
                    <TableRow><TableCell colSpan={4} className="h-24 text-center">Carregando...</TableCell></TableRow>
                  ) : presenca?.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="h-24 text-center">Nenhum dado encontrado.</TableCell></TableRow>
                  ) : (
                    presenca?.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-sm font-medium">{new Date(item.data).toLocaleDateString()}</TableCell>
                        <TableCell>{item.funcionarioNome}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{item.usinaNome || "-"}</TableCell>
                        <TableCell className="text-right font-mono">{formatHoras(item.horasTrabalhadas)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
