"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { ModoCor, StatusPedido } from "@/lib/types";

export type FilaPublicaItem = {
  protocolo: string;
  status: StatusPedido;
  num_paginas: number;
  quantidade_copias: number;
  modo_cor: ModoCor;
  paid_at: string | null;
  printed_at: string | null;
};

// Fallback quando o Realtime cai silenciosamente. A view é barata (dezenas de linhas).
const POLL_MS = 30_000;
// Agrupa rajadas de eventos realtime num único refetch.
const DEBOUNCE_MS = 1_000;

// Fila pública do kiosk: lê a view `fila_publica` (já ordenada por paid_at asc) e
// usa o Realtime de `fila_impressao` apenas como gatilho de refetch — o Supabase
// Realtime não emite eventos de views, então o payload é ignorado.
export function useFilaPublica() {
  const query = useQuery({
    queryKey: ["kiosk", "fila-publica"],
    refetchInterval: POLL_MS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fila_publica")
        .select(
          "protocolo, status, num_paginas, quantidade_copias, modo_cor, paid_at, printed_at"
        )
        .order("paid_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FilaPublicaItem[];
    },
  });

  // Mantém a referência de refetch estável para o efeito de assinatura (monta 1x).
  const refetchRef = useRef(query.refetch);
  refetchRef.current = query.refetch;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const agendarRefetch = () => {
      if (timer) return; // já há um refetch agendado nesta janela de debounce
      timer = setTimeout(() => {
        timer = null;
        void refetchRef.current();
      }, DEBOUNCE_MS);
    };

    const channel = supabase
      .channel("kiosk-fila-publica")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "fila_impressao" },
        agendarRefetch
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "fila_impressao" },
        agendarRefetch
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, []);

  return {
    itens: (query.data ?? []) as FilaPublicaItem[],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
