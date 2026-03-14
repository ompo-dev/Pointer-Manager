"use client";

type QueryPrimitive = string | number | boolean | null | undefined;

interface QueryKeyObject {
  [key: string]: QueryKeyValue;
}

interface QueryKeyArray extends Array<QueryKeyValue> {}

type QueryKeyValue = QueryPrimitive | QueryKeyObject | QueryKeyArray;

interface CacheEntry {
  expiresAt: number;
  value: unknown;
}

interface QueryOptions {
  ttlMs?: number;
}

const DEFAULT_TTL_MS = 5000;

const queryCache = new Map<string, CacheEntry>();
const inFlightQueries = new Map<string, Promise<unknown>>();

function normalizeValue(value: QueryKeyValue): QueryKeyValue {
  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, QueryKeyValue>>((accumulator, key) => {
        const normalized = normalizeValue(value[key]);

        if (
          normalized === undefined ||
          normalized === null ||
          normalized === "" ||
          normalized === "ALL"
        ) {
          return accumulator;
        }

        accumulator[key] = normalized;
        return accumulator;
      }, {});
  }

  return value;
}

function buildCacheKey(parts: QueryKeyValue[]) {
  return JSON.stringify(parts.map(normalizeValue));
}

export function normalizeQueryParams<T extends Record<string, QueryKeyValue> | undefined>(params: T) {
  if (!params) {
    return undefined;
  }

  const normalized = normalizeValue(params) as Record<string, QueryKeyValue>;
  return Object.keys(normalized).length ? normalized : undefined;
}

export async function fetchWithQueryCache<T>(
  keyParts: QueryKeyValue[],
  loader: () => Promise<T>,
  options?: QueryOptions,
) {
  const key = buildCacheKey(keyParts);
  const now = Date.now();
  const cached = queryCache.get(key);

  if (cached && cached.expiresAt > now) {
    return cached.value as T;
  }

  const existingPromise = inFlightQueries.get(key);
  if (existingPromise) {
    return existingPromise as Promise<T>;
  }

  const request = loader()
    .then((value) => {
      queryCache.set(key, {
        value,
        expiresAt: Date.now() + (options?.ttlMs ?? DEFAULT_TTL_MS),
      });
      return value;
    })
    .finally(() => {
      inFlightQueries.delete(key);
    });

  inFlightQueries.set(key, request as Promise<unknown>);
  return request;
}

export function invalidateQueryCache(matchers?: string[]) {
  if (!matchers?.length) {
    queryCache.clear();
    inFlightQueries.clear();
    return;
  }

  for (const key of queryCache.keys()) {
    if (matchers.some((matcher) => key.includes(`"${matcher}"`))) {
      queryCache.delete(key);
    }
  }

  for (const key of inFlightQueries.keys()) {
    if (matchers.some((matcher) => key.includes(`"${matcher}"`))) {
      inFlightQueries.delete(key);
    }
  }
}
