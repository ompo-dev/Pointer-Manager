import type { Connection as MysqlConnection } from "mysql2/promise";
import type { PoolClient as PgPoolClient } from "pg";

export const COPY_ORDER = [
  "Organization",
  "Plant",
  "AuthorizedNetwork",
  "Person",
  "User",
  "Session",
  "Account",
  "Verification",
  "Jwks",
  "Employee",
  "TimeEntry",
  "AuditLog",
  "RealtimeEvent",
] as const;

export type TableName = (typeof COPY_ORDER)[number];

export const JSONISH_COLUMNS = new Set([
  "modulePermissions",
  "metadata",
  "payload",
]);

export const EXPORT_VERSION = 2 as const;

export type TableExport = {
  columns: string[];
  dateTimeColumns: string[];
  rows: Record<string, unknown>[];
};

export type DataExportFile = {
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  source: "postgresql";
  tables: Partial<Record<TableName, TableExport>>;
};

export function pgSslOption(url: string): boolean | object | undefined {
  if (process.env.SOURCE_PG_SSL === "0" || process.env.SOURCE_PG_SSL === "false") {
    return undefined;
  }
  if (/sslmode=require|supabase\.co|neon\.tech|render\.com/i.test(url)) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

export function normalizePgRow(table: TableName, row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
  if (table === "AuthorizedNetwork" && "ipv4Cidr" in out && !("publicIpv4Cidr" in out)) {
    out.publicIpv4Cidr = out.ipv4Cidr;
    out.localIpv4Cidr = null;
    delete out.ipv4Cidr;
  }
  return out;
}

export async function pgColumns(client: PgPoolClient, table: string): Promise<string[]> {
  const res = await client.query<{ name: string }>(
    `SELECT a.attname::text AS name
     FROM pg_attribute a
     JOIN pg_class c ON a.attrelid = c.oid
     JOIN pg_namespace n ON c.relnamespace = n.oid
     WHERE n.nspname = 'public' AND c.relname = $1 AND a.attnum > 0 AND NOT a.attisdropped
     ORDER BY a.attnum`,
    [table],
  );
  return res.rows.map((r) => r.name);
}

/** Colunas de data/hora no Postgres (para serializar ISO no JSON e reviver no import). */
export async function pgDateTimeColumns(client: PgPoolClient, table: string): Promise<Set<string>> {
  const res = await client.query<{ name: string }>(
    `SELECT a.attname::text AS name
     FROM pg_attribute a
     JOIN pg_class c ON a.attrelid = c.oid
     JOIN pg_namespace n ON c.relnamespace = n.oid
     JOIN pg_type t ON a.atttypid = t.oid
     WHERE n.nspname = 'public' AND c.relname = $1 AND a.attnum > 0 AND NOT a.attisdropped
     AND t.typname IN ('timestamp', 'timestamptz', 'date')`,
    [table],
  );
  return new Set(res.rows.map((r) => r.name));
}

export async function mysqlColumns(conn: MysqlConnection, table: string): Promise<string[]> {
  const [rows] = await conn.query<import("mysql2").RowDataPacket[]>(
    `SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    [table],
  );
  return rows.map((r) => String(r.name));
}

export function serializeForMysql(column: string, value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  if (Buffer.isBuffer(value)) {
    return value.toString("utf8");
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (JSONISH_COLUMNS.has(column) && typeof value === "object") {
    return JSON.stringify(value);
  }
  return value;
}

/** Converte linha para JSON estável (export arquivo). */
export function rowToJson(
  row: Record<string, unknown>,
  dateTimeCols: Set<string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === null || v === undefined) {
      out[k] = null;
      continue;
    }
    if (dateTimeCols.has(k)) {
      if (v instanceof Date) {
        out[k] = v.toISOString();
      } else if (typeof v === "string") {
        const d = new Date(v);
        out[k] = Number.isNaN(d.getTime()) ? v : d.toISOString();
      } else {
        out[k] = v;
      }
      continue;
    }
    if (v instanceof Date) {
      out[k] = v.toISOString();
      continue;
    }
    if (Buffer.isBuffer(v)) {
      out[k] = { __encoding: "utf8", __value: v.toString("utf8") };
      continue;
    }
    if (typeof v === "bigint") {
      out[k] = v.toString();
      continue;
    }
    if (JSONISH_COLUMNS.has(k) && typeof v === "object") {
      out[k] = v;
      continue;
    }
    out[k] = v;
  }
  return out;
}

/** Reverte valores do JSON para tipos aceitos pelo mysql2. */
export function rowFromJson(
  row: Record<string, unknown>,
  dateTimeCols: Set<string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
  for (const k of Object.keys(out)) {
    const v = out[k];
    if (v && typeof v === "object" && !Array.isArray(v) && "__encoding" in v && "__value" in v) {
      const o = v as { __encoding: string; __value: string };
      out[k] = o.__value;
      continue;
    }
    if (dateTimeCols.has(k) && typeof v === "string") {
      out[k] = new Date(v);
    }
  }
  return out;
}

export async function truncateMysql(conn: MysqlConnection) {
  await conn.query("SET FOREIGN_KEY_CHECKS = 0");
  const reverse = [...COPY_ORDER].reverse();
  for (const t of reverse) {
    try {
      await conn.query(`TRUNCATE TABLE \`${t}\``);
      console.log(`  truncado: ${t}`);
    } catch {
      await conn.query(`DELETE FROM \`${t}\``);
      console.log(`  esvaziado (DELETE): ${t}`);
    }
  }
  await conn.query("SET FOREIGN_KEY_CHECKS = 1");
}

export async function insertRowsMysql(
  conn: MysqlConnection,
  table: TableName,
  cols: string[],
  rows: Record<string, unknown>[],
): Promise<number> {
  if (cols.length === 0 || rows.length === 0) {
    return 0;
  }
  const batchSize = 200;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const colSql = cols.map((c) => `\`${c.replace(/`/g, "``")}\``).join(", ");
    const placeholders = batch.map(() => `(${cols.map(() => "?").join(",")})`).join(",");
    const values: unknown[] = [];
    for (const row of batch) {
      for (const c of cols) {
        values.push(serializeForMysql(c, row[c]));
      }
    }
    await conn.query(
      `INSERT INTO \`${table.replace(/`/g, "``")}\` (${colSql}) VALUES ${placeholders}`,
      values,
    );
    inserted += batch.length;
  }
  return inserted;
}

export async function loadSnapshotFromPostgres(client: PgPoolClient): Promise<DataExportFile> {
  const tables: DataExportFile["tables"] = {};
  for (const t of COPY_ORDER) {
    const cols = await pgColumns(client, t).catch(() => [] as string[]);
    if (cols.length === 0) {
      console.warn(`  [${t}] ausente no Postgres — ignorada na exportação.`);
      continue;
    }
    const dateTimeCols = await pgDateTimeColumns(client, t);
    const quoted = cols.map((c) => `"${c.replace(/"/g, '""')}"`).join(", ");
    const qTable = `"${t.replace(/"/g, '""')}"`;
    const res = await client.query<Record<string, unknown>>(`SELECT ${quoted} FROM ${qTable}`);
    const rows = res.rows.map((r) => {
      const normalized = normalizePgRow(t, r);
      return rowToJson(normalized, dateTimeCols);
    });
    tables[t] = {
      columns: cols,
      dateTimeColumns: [...dateTimeCols],
      rows,
    };
    console.log(`  [${t}] ${rows.length} linhas lidas`);
  }
  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    source: "postgresql",
    tables,
  };
}

export async function applySnapshotToMysql(
  conn: MysqlConnection,
  payload: DataExportFile,
  options: { truncateFirst: boolean },
): Promise<void> {
  if (payload.version !== EXPORT_VERSION) {
    throw new Error(`Versão de arquivo não suportada: ${payload.version} (esperado ${EXPORT_VERSION})`);
  }
  if (options.truncateFirst) {
    console.log("\nLimpando tabelas no MySQL...");
    await truncateMysql(conn);
  }
  console.log("\nInserindo...\n");
  for (const t of COPY_ORDER) {
    const block = payload.tables[t];
    if (!block || block.rows.length === 0) {
      console.log(`  [${t}] 0 linhas (pulando)`);
      continue;
    }
    const myCols = await mysqlColumns(conn, t);
    if (myCols.length === 0) {
      console.warn(`  [${t}] tabela não existe no MySQL — ignorada.`);
      continue;
    }
    const mySet = new Set(myCols);
    const cols = block.columns.filter((c) => mySet.has(c));
    if (cols.length === 0) {
      console.warn(`  [${t}] nenhuma coluna em comum — ignorada.`);
      continue;
    }
    const dt = new Set(block.dateTimeColumns);
    const rows = block.rows.map((r) => rowFromJson(r, dt));
    const inserted = await insertRowsMysql(conn, t, cols, rows);
    console.log(`  [${t}] ${inserted} linhas inseridas`);
  }
  console.log("\nConcluído.");
}

export async function syncTablePgToMysql(
  client: PgPoolClient,
  conn: MysqlConnection,
  table: TableName,
  dryRun: boolean,
): Promise<number> {
  const pgCols = await pgColumns(client, table);
  const myCols = await mysqlColumns(conn, table);
  if (pgCols.length === 0) {
    console.warn(`  [${table}] tabela não existe no Postgres — ignorada.`);
    return 0;
  }
  if (myCols.length === 0) {
    console.warn(`  [${table}] tabela não existe no MySQL — ignorada.`);
    return 0;
  }
  const mySet = new Set(myCols);
  const cols = pgCols.filter((c) => mySet.has(c));
  if (cols.length === 0) {
    console.warn(`  [${table}] nenhuma coluna em comum — ignorada.`);
    return 0;
  }
  const missingInMysql = pgCols.filter((c) => !mySet.has(c));
  if (missingInMysql.length > 0) {
    console.log(`  [${table}] colunas só no Postgres (destino usa DEFAULT): ${missingInMysql.join(", ")}`);
  }
  const quoted = cols.map((c) => `"${c.replace(/"/g, '""')}"`).join(", ");
  const qTable = `"${table.replace(/"/g, '""')}"`;
  const res = await client.query<Record<string, unknown>>(`SELECT ${quoted} FROM ${qTable}`);
  const rows = res.rows.map((r) => normalizePgRow(table, r));
  if (dryRun) {
    console.log(`  [${table}] ${rows.length} linhas (dry-run, não inseridas)`);
    return rows.length;
  }
  const inserted = await insertRowsMysql(conn, table, cols, rows);
  console.log(`  [${table}] ${inserted} linhas inseridas`);
  return inserted;
}
