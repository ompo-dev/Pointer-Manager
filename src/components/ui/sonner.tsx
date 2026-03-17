"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={(resolvedTheme ?? "light") as ToasterProps["theme"]}
      position="top-right"
      closeButton
      richColors
      toastOptions={{
        classNames: {
          toast:
            "group toaster rounded-2xl border border-border bg-background text-foreground shadow-lg",
          title: "text-sm font-semibold",
          description: "text-sm text-muted-foreground",
          actionButton:
            "rounded-xl bg-foreground text-background hover:bg-foreground/90",
          cancelButton:
            "rounded-xl border border-border bg-background text-foreground hover:bg-muted",
        },
      }}
      {...props}
    />
  );
}
