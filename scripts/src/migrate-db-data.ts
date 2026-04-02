/**
 * Migração de dados Point Manager: Postgres → arquivo JSON → MySQL.
 *
 * Ao rodar com `bun run --cwd scripts`, o cwd é `scripts/`; este arquivo carrega o `.env` da **raiz do repo**.
 *
 * URLs (prioridade):
 *   Postgres: SOURCE_DATABASE_URL → senão DATABASE_URL se começar com postgresql://
 *   MySQL:    TARGET_DATABASE_URL → senão DATABASE_URL se começar com mysql://
 *
 * Flags: --dry-run, --no-truncate, --pretty (só export)
 */

import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import mysql from "mysql2/promise";
import {
  COPY_ORDER,
  type DataExportFile,
  applySnapshotToMysql,
  loadSnapshotFromPostgres,
  mysqlColumns,
  pgColumns,
  pgSslOption,
  syncTablePgToMysql,
  truncateMysql,
} from "./lib/point-manager-data-migration";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(scriptDir, "../..");

function resolveWorkspacePath(userPath: string): string {
  if (isAbsolute(userPath)) {
    return userPath;
  }
  return resolve(REPO_ROOT, userPath);
}

/** Preenche process.env a partir de arquivos .env (não sobrescreve variáveis já definidas no shell). */
function mergeEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return;
  }
  const text = readFileSync(filePath, "utf8");
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) {
      continue;
    }
    const eq = t.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

mergeEnvFile(resolve(scriptDir, "../../.env"));
mergeEnvFile(resolve(scriptDir, "../../apps/api/.env"));

function postgresUrlForExportOrSync(): string {
  const s = process.env.SOURCE_DATABASE_URL?.trim();
  if (s) {
    return s;
  }
  const d = process.env.DATABASE_URL?.trim();
  if (d && /^postgres(ql)?:\/\//i.test(d)) {
    return d;
  }
  console.error(
    "Defina SOURCE_DATABASE_URL ou DATABASE_URL apontando para Postgres (postgresql://...).",
  );
  console.error(
    "Dica: o .env na raiz do repositório é carregado automaticamente ao rodar este script.",
  );
  process.exit(1);
}

function mysqlUrlForImportOrSync(): string {
  const t = process.env.TARGET_DATABASE_URL?.trim();
  if (t) {
    return t;
  }
  const d = process.env.DATABASE_URL?.trim();
  if (d && /^mysql:\/\//i.test(d)) {
    return d;
  }
  console.error(
    "Defina TARGET_DATABASE_URL ou DATABASE_URL apontando para MySQL (mysql://...).",
  );
  process.exit(1);
}

function parseArgs() {
  const raw = process.argv.slice(2);
  const flags = new Map<string, string | boolean>();
  const positional: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i]!;
    if (a === "--dry-run") {
      flags.set("dry-run", true);
    } else if (a === "--no-truncate") {
      flags.set("no-truncate", true);
    } else if (a === "--pretty") {
      flags.set("pretty", true);
    } else if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = raw[i + 1];
      if (next && !next.startsWith("--")) {
        flags.set(key, next);
        i++;
      } else {
        flags.set(key, true);
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

async function cmdExport(outPath: string, pretty: boolean) {
  const sourceUrl = postgresUrlForExportOrSync();
  const abs = resolveWorkspacePath(outPath);
  await mkdir(dirname(abs), { recursive: true });

  const pool = new pg.Pool({
    connectionString: sourceUrl,
    ssl: pgSslOption(sourceUrl),
    max: 4,
  });
  const client = await pool.connect();
  try {
    console.log("Exportando todas as tabelas do Postgres para JSON...\n");
    const snapshot = await loadSnapshotFromPostgres(client);
    const json = pretty ? JSON.stringify(snapshot, null, 2) : JSON.stringify(snapshot);
    await writeFile(abs, json, "utf8");
    console.log(`\nArquivo gravado: ${abs}`);
    let total = 0;
    for (const t of COPY_ORDER) {
      total += snapshot.tables[t]?.rows.length ?? 0;
    }
    console.log(`Total de linhas (todas as tabelas): ${total}`);
  } finally {
    client.release();
    await pool.end();
  }
}

async function cmdImport(inPath: string, truncateFirst: boolean) {
  const targetUrl = mysqlUrlForImportOrSync();
  const abs = resolveWorkspacePath(inPath);
  const raw = await readFile(abs, "utf8");
  const payload = JSON.parse(raw) as DataExportFile;

  const conn = await mysql.createConnection(targetUrl);
  try {
    console.log(`Importando de: ${abs}`);
    await applySnapshotToMysql(conn, payload, { truncateFirst });
  } finally {
    await conn.end();
  }
}

async function cmdSync(dryRun: boolean, noTruncate: boolean) {
  const sourceUrl = postgresUrlForExportOrSync();
  const targetUrl = mysqlUrlForImportOrSync();

  const pgPool = new pg.Pool({
    connectionString: sourceUrl,
    ssl: pgSslOption(sourceUrl),
    max: 4,
  });
  const mysqlConn = await mysql.createConnection(targetUrl);

  try {
    console.log("Origem: Postgres | Destino: MySQL");
    if (dryRun) {
      console.log("Modo: dry-run\n");
    }

    const pgClient = await pgPool.connect();
    try {
      for (const t of COPY_ORDER) {
        const q = `SELECT COUNT(*)::bigint AS c FROM "${t.replace(/"/g, '""')}"`;
        try {
          const c = await pgClient.query<{ c: string }>(q);
          console.log(`[${t}] Postgres: ${c.rows[0]?.c ?? "?"} linhas`);
        } catch {
          console.log(`[${t}] Postgres: (tabela ausente ou erro)`);
        }
      }

      if (dryRun) {
        for (const t of COPY_ORDER) {
          const pc = await pgColumns(pgClient, t).catch(() => [] as string[]);
          const mc = await mysqlColumns(mysqlConn, t).catch(() => [] as string[]);
          const common = pc.filter((c) => mc.includes(c));
          console.log(`\n[${t}] colunas comuns: ${common.length} / PG ${pc.length} / MySQL ${mc.length}`);
        }
        return;
      }

      if (!noTruncate) {
        console.log("\nLimpando tabelas no MySQL...");
        await truncateMysql(mysqlConn);
      }

      console.log("\nCopiando...\n");
      for (const t of COPY_ORDER) {
        await syncTablePgToMysql(pgClient, mysqlConn, t, false);
      }
      console.log("\nConcluído.");
    } finally {
      pgClient.release();
    }
  } finally {
    await mysqlConn.end();
    await pgPool.end();
  }
}

async function main() {
  const { positional, flags } = parseArgs();
  const mode = (positional[0] ?? "sync") as string;
  const dryRun = flags.get("dry-run") === true;
  const noTruncate = flags.get("no-truncate") === true;
  const pretty = flags.get("pretty") === true;

  if (mode === "export") {
    const out = flags.get("out");
    if (typeof out !== "string" || !out) {
      console.error('Uso: export --out ./caminho/dados.json [--pretty]');
      console.error("Requer Postgres em SOURCE_DATABASE_URL ou DATABASE_URL.");
      process.exit(1);
    }
    await cmdExport(out, pretty);
    return;
  }

  if (mode === "import") {
    const inp = flags.get("in");
    if (typeof inp !== "string" || !inp) {
      console.error('Uso: import --in ./caminho/dados.json [--no-truncate]');
      console.error("Requer MySQL em TARGET_DATABASE_URL ou DATABASE_URL.");
      process.exit(1);
    }
    await cmdImport(inp, !noTruncate);
    return;
  }

  if (mode === "sync") {
    await cmdSync(dryRun, noTruncate);
    return;
  }

  console.error('Modo desconhecido. Use: export | import | sync');
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
