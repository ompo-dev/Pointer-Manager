import { AppProviders } from "@/providers/app-providers";

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppProviders>{children}</AppProviders>;
}
