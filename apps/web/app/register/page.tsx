import { Suspense } from "react";
import { RegisterScreen } from "@/modules/register/register-screen";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function RegisterPageFallback() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl items-start px-4 py-6 sm:px-6 sm:py-10">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Carregando acesso da usina</CardTitle>
          <CardDescription>
            Estamos validando rede, localizacao e identificador publico da usina.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-24 animate-pulse rounded-3xl bg-muted/50" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterPageFallback />}>
      <RegisterScreen />
    </Suspense>
  );
}
