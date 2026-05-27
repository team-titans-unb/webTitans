import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { StatusPedido } from "@/lib/types";

const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutos

type Resultado = {
  status: StatusPedido | null;
  isLoading: boolean;
  error: "TIMEOUT" | "FETCH" | null;
};

export function usePedidoStatus(pedidoId: string | null): Resultado {
  const [realtimeStatus, setRealtimeStatus] = useState<StatusPedido | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!pedidoId) return;
    const timer = setTimeout(() => setTimedOut(true), TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [pedidoId]);

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
