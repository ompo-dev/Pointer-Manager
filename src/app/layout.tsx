import type { Metadata } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Point Manager",
  description: "Plataforma de ponto operacional para usinas solares.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className="font-sans"
    >
      <body className={cn("bg-sidebar text-foreground antialiased")}>{children}</body>
    </html>
  );
}
