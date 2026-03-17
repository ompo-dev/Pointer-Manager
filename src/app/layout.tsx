import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "@/providers/app-providers";
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
      <body className={cn("bg-sidebar text-foreground antialiased")}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
