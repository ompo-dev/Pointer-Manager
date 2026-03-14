"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { signOutFromApp } from "@/lib/auth/logout";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleLogout() {
    setIsPending(true);

    await signOutFromApp();

    startTransition(() => {
      router.replace("/login");
      router.refresh();
    });

    setIsPending(false);
  }

  return (
    <Button type="button" variant="secondary" size="sm" onClick={handleLogout} disabled={isPending}>
      <LogOut className="mr-2 size-4" />
      {isPending ? "Saindo..." : "Sair"}
    </Button>
  );
}
