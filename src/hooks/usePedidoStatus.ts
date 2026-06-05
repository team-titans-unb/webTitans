"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { StatusPedido } from "@/lib/types";

type Resultado = {
  status: StatusPedido | null;
  isLoading: boolean;
  error: "TIMEOUT" | "FETCH" | null;
};

// A janela de acompanhamento dura até a expiração real do QR
// (expiration_date_to): única fonte de verdade, sem corte fixo.
export function usePedidoStatus(
  pedidoId: string | null,
  expirationDateTo?: string | null
): Resultado {
  const [realtimeStatus, setRealtimeStatus] = useState<StatusPedido | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    setTimedOut(false);
    if (!pedidoId || !expirationDateTo) return;
    const expMs = new Date(expirationDateTo).getTime();
    if (!Number.isFinite(expMs)) return;
    const restante = expMs - Date.now();
    if (restante <= 0) {
      setTimedOut(true);
      return;
    }
    const timer = setTimeout(() => setTimedOut(true), restante);
    return () => clearTimeout(timer);
  }, [pedidoId, expirationDateTo]);

  useEffect(() => {
    if (!pedidoId) return;
    const channel = supabase
      .channel(`pedido-${pedidoId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "fila_impressao",
          filter: `id=eq.${pedidoId}`,
        },
        (payload) => {
          const novo = (payload.new as { status?: StatusPedido }).status;
          if (novo) setRealtimeStatus(novo);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [pedidoId]);

  const query = useQuery({
    queryKey: ["pedido-status", pedidoId],
    enabled: !!pedidoId && !timedOut && realtimeStatus !== "PAGO",
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fila_impressao")
        .select("status")
        .eq("id", pedidoId!)
        .maybeSingle();
      if (error) throw error;
      return (data?.status ?? null) as StatusPedido | null;
    },
  });

  const status = realtimeStatus ?? query.data ?? null;

  let error: Resultado["error"] = null;
  if (timedOut && status !== "PAGO") error = "TIMEOUT";
  else if (query.isError) error = "FETCH";

  return {
    status,
    isLoading: query.isLoading && realtimeStatus === null,
    error,
  };
}
