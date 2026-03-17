import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function DomainPlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="max-w-3xl text-sm leading-7 text-muted">
          Este módulo já existe na nova arquitetura, mas ainda está em fase de port da
          lógica do legado para o stack Next.js + Elysia + Prisma. A rota foi criada
          agora para manter a navegação, o typed routing e a composição por domínios
          coerentes durante a migração.
        </p>
      </CardContent>
    </Card>
  );
}
