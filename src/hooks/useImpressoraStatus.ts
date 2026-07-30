"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type EstadoImpressora =
  | "OK"
  | "IMPRIMINDO"
  | "PAUSADA"
  | "INALCANCAVEL"
  | "SEM_PAPEL"
  | "SEM_TONER"
  | "MANUTENCAO";

// Diagnóstico publicado pelo worker junto ao estado. Todos os campos são
// opcionais: o worker antigo não grava `detalhes` e firmwares variam no que
// reportam. `state_reasons` é só diagnóstico — não é exibido na UI.
export type DetalhesImpressora = {
  toner_pct?: number | null;
  state_reasons?: string[];
  toner_baixo?: boolean;
};

// Lido de `impressora_status_publica` (migration 0012), não da tabela base:
// `idade_ms` já vem calculada inteiramente no relógio do servidor Postgres
// (`now() - atualizado_em`, ambos no mesmo relógio). O client nunca compara
// `atualizado_em` contra o relógio do dispositivo que acessa o kiosk/
// `/impressao` — isso é o que causava "offline" falso quando o usuário
// alterava a data/hora do totem.
type ImpressoraStatusRow = {
  estado: EstadoImpressora;
  detalhes: DetalhesImpressora | null;
  idade_ms: number;
};

// 3× o poll de 10 s do worker: heartbeat mais velho que isso => worker/Pi caiu.
export const HEARTBEAT_TIMEOUT_MS = 30_000;
const POLL_MS = 15_000;
// Tick local para reavaliar o "offline" mesmo sem novo fetch/evento.
const TICK_MS = 5_000;

export type ResultadoImpressora = {
  estado: EstadoImpressora | null;
  detalhes: DetalhesImpressora | null;
  offline: boolean;
  isLoading: boolean;
};

// Âncora de idade do heartbeat: `idadeMsNoFetch` (calculada no Postgres, no
// momento em que o fetch foi respondido) + `perfMsNoFetch` (o
// `performance.now()` do navegador naquele instante). Entre fetches, a idade
// atual é extrapolada como `idadeMsNoFetch + (performance.now() atual -
// perfMsNoFetch)`. `performance.now()` é monotônico: só avança com o tempo
// real decorrido desde o carregamento da página — ao contrário de
// `Date.now()`, não é afetado por o usuário mudar a data/hora do
// dispositivo.
type Ancora = {
  idadeMsNoFetch: number;
  perfMsNoFetch: number;
};

// Estado da impressora para o kiosk: lê o heartbeat mais recente de
// `impressora_status_publica` (ordenado por `atualizado_em desc` — a tabela
// pode ter mais de uma linha, ex. filas antigas/de teste nunca limpas, e sem
// essa ordenação o Postgres pode devolver qualquer uma), assina o Realtime
// da tabela base `impressora_status` e deriva `offline` extrapolando a
// idade do heartbeat a partir da última âncora — recalculado a cada tick
// local, não só no fetch.
export function useImpressoraStatus(): ResultadoImpressora {
  const query = useQuery({
    queryKey: ["kiosk", "impressora-status"],
    refetchInterval: POLL_MS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("impressora_status_publica")
        .select("estado, detalhes, idade_ms")
        .order("atualizado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as ImpressoraStatusRow | null;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("kiosk-impressora-status")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "impressora_status" },
        () => {
          void query.refetch();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const row = query.data ?? null;

  // Âncora: atualizada em efeito (nunca durante o render) a cada fetch bem-
  // sucedido novo. `query.data` é um objeto novo a cada resposta do
  // Supabase (mesmo quando os valores não mudam), então serve de gatilho
  // confiável para resincronizar — poll de 15s, evento Realtime ou refetch
  // por foco de janela disparam essa resincronização igualmente.
  const [ancora, setAncora] = useState<Ancora | null>(null);
  useEffect(() => {
    if (row) {
      setAncora({
        idadeMsNoFetch: row.idade_ms,
        perfMsNoFetch: performance.now(),
      });
    } else {
      setAncora(null);
    }
  }, [row]);

  // Tick local: relógio monotônico do navegador, atualizado periodicamente
  // só para forçar a reavaliação do "offline" mesmo sem novo fetch/evento.
  const [agoraPerf, setAgoraPerf] = useState(() => performance.now());
  useEffect(() => {
    const id = setInterval(() => setAgoraPerf(performance.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const idadeAtualMs = ancora
    ? ancora.idadeMsNoFetch + (agoraPerf - ancora.perfMsNoFetch)
    : null;
  const offline = !row || idadeAtualMs === null || idadeAtualMs > HEARTBEAT_TIMEOUT_MS;

  return {
    estado: row?.estado ?? null,
    detalhes: row?.detalhes ?? null,
    offline,
    isLoading: query.isLoading,
  };
}
