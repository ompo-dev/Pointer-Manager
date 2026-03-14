import { useState } from "react";
import { useParams } from "wouter";
import { useRegistrarEntrada, useRegistrarSaida } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export default function PontoPagina() {
  const { token } = useParams<{ token: string }>();
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; type: 'entrada' | 'saida'; message: string; name?: string } | null>(null);

  const entradaMutation = useRegistrarEntrada();
  const saidaMutation = useRegistrarSaida();

  // Mask CPF input
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 11) value = value.slice(0, 11);
    
    // Formatting: 000.000.000-00
    let formatted = value;
    if (value.length > 9) {
      formatted = value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    } else if (value.length > 6) {
      formatted = value.replace(/(\d{3})(\d{3})(\d{3})/, "$1.$2.$3");
    } else if (value.length > 3) {
      formatted = value.replace(/(\d{3})(\d{3})/, "$1.$2");
    }
    setCpf(formatted);
  };

  const getCleanCpf = () => cpf.replace(/\D/g, "");

  const handleAction = async (tipo: 'entrada' | 'saida') => {
    const cleanCpf = getCleanCpf();
    if (cleanCpf.length !== 11) {
      setResult({ success: false, type: tipo, message: "CPF inválido. Digite 11 números." });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      if (tipo === 'entrada') {
        const res = await entradaMutation.mutateAsync({ 
          data: { cpf: cleanCpf, usinaToken: token || "" } 
        });
        setResult({ 
          success: true, 
          type: 'entrada', 
          message: "Entrada registrada com sucesso!",
          name: res.funcionarioNome 
        });
      } else {
        const res = await saidaMutation.mutateAsync({ 
          data: { cpf: cleanCpf, usinaToken: token || "" } 
        });
        setResult({ 
          success: true, 
          type: 'saida', 
          message: "Saída registrada com sucesso!",
          name: res.funcionarioNome 
        });
      }
      setCpf(""); // clear on success
    } catch (error: any) {
      setResult({ 
        success: false, 
        type: tipo, 
        message: error.response?.data?.error || "Erro ao registrar ponto. Verifique se você está conectado no Wi-Fi correto da usina."
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md">
            <Sun className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">SolarPonto</h1>
          <p className="text-slate-500 mt-1">Registro de Ponto Digital</p>
        </div>

        <Card className="border-0 shadow-xl shadow-slate-200/50 bg-white overflow-hidden">
          <CardContent className="p-6 sm:p-8">
            <AnimatePresence mode="wait">
              {!result?.success ? (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Digite seu CPF</label>
                    <Input 
                      type="tel" 
                      placeholder="000.000.000-00" 
                      value={cpf}
                      onChange={handleCpfChange}
                      className="text-center text-xl h-14 font-mono tracking-wider border-slate-200 focus-visible:ring-primary focus-visible:border-primary"
                      disabled={loading}
                    />
                  </div>

                  {result && !result.success && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }} 
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-start gap-2 border border-red-100"
                    >
                      <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <p>{result.message}</p>
                    </motion.div>
                  )}

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <Button 
                      onClick={() => handleAction('entrada')} 
                      disabled={loading || getCleanCpf().length !== 11}
                      className="h-14 bg-green-600 hover:bg-green-700 text-white font-medium text-base shadow-sm hover-elevate-2 active-elevate-2"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "ENTRADA"}
                    </Button>
                    <Button 
                      onClick={() => handleAction('saida')} 
                      disabled={loading || getCleanCpf().length !== 11}
                      className="h-14 bg-orange-500 hover:bg-orange-600 text-white font-medium text-base shadow-sm hover-elevate-2 active-elevate-2"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "SAÍDA"}
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-6 space-y-4"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.1 }}
                    className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto"
                  >
                    <CheckCircle2 className="w-10 h-10" />
                  </motion.div>
                  
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-1">{result.message}</h2>
                    {result.name && <p className="text-slate-600">{result.name}</p>}
                    <p className="text-sm font-mono text-slate-400 mt-2">{new Date().toLocaleString()}</p>
                  </div>

                  <Button 
                    variant="outline" 
                    className="mt-6 w-full h-12 font-medium border-slate-200"
                    onClick={() => setResult(null)}
                  >
                    Novo Registro
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-400 mt-8 font-medium">
          Aviso: O registro requer conexão com o Wi-Fi da usina.
        </p>
      </div>
    </div>
  );
}
