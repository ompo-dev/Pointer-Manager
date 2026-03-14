"use client";

import { useEffect } from "react";
import type { SessionUser } from "@/store/session-store";
import { useSessionStore } from "@/store/session-store";

export function SessionHydrator({ user }: { user: SessionUser }) {
  const setAuthenticatedUser = useSessionStore((state) => state.setAuthenticatedUser);

  useEffect(() => {
    setAuthenticatedUser(user);
  }, [setAuthenticatedUser, user]);

  return null;
}
