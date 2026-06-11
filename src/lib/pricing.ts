import { supabase } from "./supabase";
import type { ModoCor, Precos } from "./types";

export async function fetchPrecos(): Promise<Precos> {
  const { data, error } = await supabase
    .from("config_precos")
    .select("modo_cor, valor_centavos_por_pagina");

  if (error) throw error;

  const precos: Partial<Precos> = {};
  for (const row of data as Array<{ modo_cor: ModoCor; valor_centavos_por_pagina: number }>) {
    precos[row.modo_cor] = row.valor_centavos_por_pagina;
  }

  if (precos.PB === undefined) {
    throw new Error("config_precos incompleta — falta a linha PB");
  }

  return precos as Precos;
}

export function calcularValor(
  numPaginas: number,
  quantidadeCopias: number,
  modo: ModoCor,
  precos: Precos,
): number {
  return numPaginas * quantidadeCopias * precos[modo];
}

export function formatBRL(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
