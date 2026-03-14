import { auth } from "@point-manager/auth/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/modules/auth/login-form";

export default async function LoginPage() {
  const session = await auth.api.getSession({
    headers: new Headers(await headers()),
  });

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="grid min-h-screen place-items-center px-6 py-10">
      <LoginForm />
    </main>
  );
}
