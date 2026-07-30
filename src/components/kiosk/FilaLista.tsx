"use client";

import type { FilaPublicaItem } from "@/hooks/useFilaPublica";
import { rotuloHorarioFila, rotuloModoCor, statusVisualFila } from "./status";

type Props = {
  itens: FilaPublicaItem[];
};

// Lista da fila (exceto o "imprimindo agora", que sobe para o card em destaque).
export function FilaLista({ itens }: Props) {
  if (itens.length === 0) return null;

  return (
    <ul className="space-y-3">
      {itens.map((item) => {
        const visual = statusVisualFila(item.status);
        const horario = rotuloHorarioFila(
          item.status,
          item.paid_at,
          item.printed_at
        );
        return (
          <li
            key={item.protocolo}
            className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 transition-all duration-300 animate-in fade-in slide-in-from-top-2"
          >
            <div className="min-w-0">
              <p className="font-mono text-3xl font-bold tracking-widest text-white">
                {item.protocolo}
              </p>
              <p className="mt-0.5 text-base text-zinc-400">
                {item.num_paginas}{" "}
                {item.num_paginas === 1 ? "página" : "páginas"} ·{" "}
                {item.quantidade_copias}{" "}
                {item.quantidade_copias === 1 ? "cópia" : "cópias"} ·{" "}
                {rotuloModoCor(item.modo_cor)}
                {horario && ` · ${horario}`}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full border px-4 py-2 text-base font-semibold ${visual.classe}`}
            >
              {visual.rotulo}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
