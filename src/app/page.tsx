import { auth } from "@point-manager/auth/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth.api.getSession({
    headers: new Headers(await headers()),
  });

  if (session?.user) {
    redirect("/dashboard");
  }

  redirect("/login");
}
