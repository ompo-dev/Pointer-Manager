# Importar dados do JSON para o MySQL

Este guia descreve como carregar o arquivo gerado pelo export do Postgres (`scripts/exports/point-manager-dados.json` ou outro caminho) no banco **MySQL** do Point Manager.

## Pré-requisitos

1. **MySQL acessível** com o **schema já criado** pelo Prisma (mesmas tabelas e colunas que o código espera).
2. Na máquina onde você roda o comando:

   ```bash
   bun run prisma:migrate:deploy
   ```

   (Execute na **raiz do repositório**; isso aplica as migrações em `apps/api/prisma` no banco apontado por `DATABASE_URL` do MySQL, se for o caso.)

3. Arquivo JSON válido exportado com o script de migração (versão `2`, campo `tables` com as tabelas do app).

## Variáveis de ambiente

O script de import lê o `.env` na **raiz do repo** e também `apps/api/.env` (sem sobrescrever o que já estiver definido no terminal).

Informe a URL do MySQL de **uma** destas formas:

| Variável | Uso |
|----------|-----|
| `TARGET_DATABASE_URL` | Recomendado quando o `.env` ainda aponta o Postgres para outro fluxo. |
| `DATABASE_URL` | Usada automaticamente se começar com `mysql://`. |

Exemplo de URL:

```text
mysql://USUARIO:SENHA@HOST:3306/NOME_DO_BANCO
```

## Comando

Na **raiz do repositório**:

```bash
bun run migrate:import-mysql -- --in scripts/exports/point-manager-dados.json
```

O caminho em `--in` é **relativo à raiz do monorepo** (não ao diretório `scripts/` do processo).

### JSON formatado (pretty) ou outro arquivo

```bash
bun run migrate:import-mysql -- --in caminho/para/seu-arquivo.json
```

## O que o import faz

1. Conecta no MySQL usando `TARGET_DATABASE_URL` ou `DATABASE_URL` (MySQL).
2. **Por padrão**, esvazia as tabelas do app (ordem segura com FKs desligadas) e **depois** insere os dados do JSON na ordem correta (`Organization` → … → `RealtimeEvent`).
3. Só grava colunas que existem **tanto** no JSON **quanto** no MySQL; o restante usa `DEFAULT` no destino.

## Flags opcionais

| Flag | Efeito |
|------|--------|
| `--no-truncate` | Não limpa as tabelas antes. Use só se o banco estiver vazio ou se quiser tentar inserir sem apagar (pode falhar por chave duplicada). |

Exemplo:

```bash
bun run migrate:import-mysql -- --in scripts/exports/point-manager-dados.json --no-truncate
```

## Executar a partir da pasta `scripts`

Também funciona:

```bash
cd scripts
bun run import-mysql-data -- --in scripts/exports/point-manager-dados.json
```

O `--in` continua sendo relativo à **raiz do repositório** (não ao diretório atual).

## Conferência rápida

Depois do import, valide no MySQL (client ou UI):

- Contagens em tabelas principais (`Organization`, `User`, `Employee`, `TimeEntry`, etc.).
- Login de um usuário conhecido na aplicação.

## Problemas comuns

- **`Defina TARGET_DATABASE_URL ou DATABASE_URL...`** — Nenhuma URL MySQL foi encontrada. Ajuste o `.env` ou exporte `TARGET_DATABASE_URL` no terminal antes do comando.
- **`Versão de arquivo não suportada`** — O JSON foi gerado por outra versão do script; gere de novo com `bun run migrate:export-pg`.
- **Erro de FK ou duplicata** — Rode sem `--no-truncate` para limpar antes, ou use um banco vazio com migrações aplicadas.
- **Caracteres estranhos em senhas na URL** — Use encoding na URL (por exemplo `@` → `%40`).

## Relação com o export

- **Export (Postgres → JSON):** `bun run migrate:export-pg -- --out scripts/exports/point-manager-dados.json`
- **Import (JSON → MySQL):** `bun run migrate:import-mysql -- --in scripts/exports/point-manager-dados.json`
- **Sync direto (Postgres → MySQL):** `bun run migrate:pg-to-mysql` (duas URLs no ambiente: origem Postgres e destino MySQL).

O arquivo JSON pode conter dados sensíveis; não faça commit dele (a pasta `scripts/exports/` está ignorada no Git para arquivos de dump).
