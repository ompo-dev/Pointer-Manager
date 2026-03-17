"use client";

import { fetchWithQueryCache } from "@/lib/api/query-cache";

export interface BrazilState {
  code: string;
  name: string;
}

export interface BrazilCity {
  name: string;
}

export async function fetchBrazilStates() {
  return fetchWithQueryCache(
    ["brazil-states"],
    async () => {
      const response = await fetch(
        "https://servicodados.ibge.gov.br/api/v1/localidades/estados",
      );

      if (!response.ok) {
        throw new Error("Nao foi possivel carregar os estados.");
      }

      const data = (await response.json()) as Array<{ sigla: string; nome: string }>;
      return data
        .map((item) => ({
          code: item.sigla,
          name: item.nome,
        }))
        .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
    },
    { ttlMs: 1000 * 60 * 60 * 24 },
  );
}

export async function fetchCitiesByState(stateCode: string) {
  const normalizedStateCode = stateCode.trim().toUpperCase();

  if (!normalizedStateCode) {
    return [] as BrazilCity[];
  }

  return fetchWithQueryCache(
    ["brazil-cities", normalizedStateCode],
    async () => {
      const response = await fetch(
        `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${normalizedStateCode}/municipios`,
      );

      if (!response.ok) {
        throw new Error("Nao foi possivel carregar as cidades.");
      }

      const data = (await response.json()) as Array<{ nome: string }>;
      return data
        .map((item) => ({ name: item.nome }))
        .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
    },
    { ttlMs: 1000 * 60 * 60 * 12 },
  );
}
