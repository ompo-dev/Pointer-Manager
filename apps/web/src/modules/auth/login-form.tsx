"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/auth-store";

const schema = z.object({
  email: z.email("Informe um e-mail valido."),
  password: z.string().min(6, "A senha precisa ter no minimo 6 caracteres."),
});

export function LoginForm() {
  const router = useRouter();
  const error = useAuthStore((state) => state.error);
  const isPending = useAuthStore((state) => state.isPending);
  const clearError = useAuthStore((state) => state.clearError);
  const setError = useAuthStore((state) => state.setError);
  const login = useAuthStore((state) => state.login);

  async function handleSubmit(formData: FormData) {
    clearError();

    const parsed = schema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Credenciais invalidas.");
      return;
    }

    const success = await login(parsed.data);

    if (success) {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="w-full max-w-xl"
    >
      <div className="mb-8 space-y-4 sm:mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted">
          Refactor Platform
        </p>
        <div className="space-y-2">
          <h1 className="max-w-lg text-4xl font-semibold tracking-tight sm:text-5xl">
            Controle de ponto com dominio, rastreabilidade e presenca ao vivo.
          </h1>
          <p className="max-w-xl text-base leading-7 text-muted">
            Nova base em Next.js, Elysia, Prisma, Orval e canais em tempo real
            com autoridade no servidor para auditoria e governanca.
          </p>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Acesso administrativo</CardTitle>
          <CardDescription>
            Entre com uma conta de operacao para abrir o novo painel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className="space-y-4">
            <Input name="email" type="email" placeholder="admin@cliente-solar.com" />
            <Input name="password" type="password" placeholder="********" />
            {error ? (
              <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Autenticando..." : "Entrar no painel"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
