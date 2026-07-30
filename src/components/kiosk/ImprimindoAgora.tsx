"use client";

import type { FilaPublicaItem } from "@/hooks/useFilaPublica";
import { rotuloHorarioFila, rotuloModoCor } from "./status";

type Props = {
  item: FilaPublicaItem;
};

// Card em destaque do pedido que está saindo agora na impressora.
export function ImprimindoAgora({ item }: Props) {
  const horario = rotuloHorarioFila(item.status, item.paid_at, item.printed_at);

  return (
    <section className="relative overflow-hidden rounded-3xl border border-titans-orange/40 bg-gradient-to-br from-titans-orange/20 to-titans-red/10 p-6 shadow-[0_0_40px_-8px] shadow-titans-orange/30">
      <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-titans-orange">
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-titans-orange opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-titans-orange" />
        </span>
        Imprimindo agora
      </div>

      <p className="mt-2 font-mono text-6xl font-black tracking-widest text-white sm:text-7xl">
        {item.protocolo}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 text-lg text-zinc-200">
        <span>
          {item.num_paginas} {item.num_paginas === 1 ? "página" : "páginas"}
        </span>
        <span>
          {item.quantidade_copias}{" "}
          {item.quantidade_copias === 1 ? "cópia" : "cópias"}
        </span>
        <span>{rotuloModoCor(item.modo_cor)}</span>
        {horario && <span>{horario}</span>}
      </div>
    </section>
  );
}
