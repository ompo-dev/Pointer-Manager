import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { useAuth } from "@/hooks/useAuth";

// Layout
import { AppLayout } from "@/components/layout/AppLayout";

// Pages
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Usinas from "@/pages/Usinas";
import UsinaDetalhe from "@/pages/UsinaDetalhe";
import Funcionarios from "@/pages/Funcionarios";
import FuncionarioDetalhe from "@/pages/FuncionarioDetalhe";
import Registros from "@/pages/Registros";
import RegistrosAtivos from "@/pages/RegistrosAtivos";
import Relatorios from "@/pages/Relatorios";
import ControleAcesso from "@/pages/ControleAcesso";
import Auditoria from "@/pages/Auditoria";
import PontoPagina from "@/pages/PontoPagina";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isInitializing } = useAuth();

  if (isInitializing) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/ponto/:token" component={PontoPagina} />
      
      <Route path="/">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/usinas">
        <ProtectedRoute component={Usinas} />
      </Route>
      <Route path="/usinas/:id">
        <ProtectedRoute component={UsinaDetalhe} />
      </Route>
      <Route path="/funcionarios">
        <ProtectedRoute component={Funcionarios} />
      </Route>
      <Route path="/funcionarios/:id">
        <ProtectedRoute component={FuncionarioDetalhe} />
      </Route>
      <Route path="/registros">
        <ProtectedRoute component={Registros} />
      </Route>
      <Route path="/registros/ativos">
        <ProtectedRoute component={RegistrosAtivos} />
      </Route>
      <Route path="/relatorios">
        <ProtectedRoute component={Relatorios} />
      </Route>
      <Route path="/controle-acesso">
        <ProtectedRoute component={ControleAcesso} />
      </Route>
      <Route path="/auditoria">
        <ProtectedRoute component={Auditoria} />
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
