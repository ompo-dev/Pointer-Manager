# Deploy Vercel-Only

## Projeto

- Importe o repositorio inteiro na Vercel.
- Configure o projeto com **Root Directory vazio**.
- O arquivo [vercel.json](/C:/Projects/Teste/Point-Manager/vercel.json) ja define:
  - `framework: nextjs`
  - `installCommand: bun install`
  - `buildCommand: bun run --cwd apps/web build`
  - `outputDirectory: apps/web/.next`

- O limite da rota SSE esta configurado diretamente no handler com `export const maxDuration = 60`, entao nao e necessario usar `functions` no `vercel.json`.

## Variaveis obrigatorias

Defina no projeto da Vercel:

- `NODE_ENV=production`
- `DATABASE_URL=...`
- `DIRECT_URL=...`
- `BETTER_AUTH_URL=https://SEU-PROJETO.vercel.app`
- `BETTER_AUTH_SECRET=...`
- `BETTER_AUTH_AUDIENCE=point-manager-api`
- `CORS_ORIGIN=https://SEU-PROJETO.vercel.app`
- `NEXT_PUBLIC_APP_URL=https://SEU-PROJETO.vercel.app`
- `NEXT_PUBLIC_API_URL=https://SEU-PROJETO.vercel.app`

## Observacoes

- A API administrativa/publica agora tambem e servida pelo Next em [route.ts](/C:/Projects/Teste/Point-Manager/apps/web/app/api/v1/[...path]/route.ts).
- O tempo real do painel agora usa SSE em [route.ts](/C:/Projects/Teste/Point-Manager/apps/web/app/api/realtime/operations/route.ts), compativel com Vercel.
- O servidor Bun/Elysia separado continua existindo no repositorio para desenvolvimento e reaproveitamento de codigo, mas o deploy Vercel-only usa apenas o projeto Next.
