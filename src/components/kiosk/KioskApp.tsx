"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFilaPublica } from "@/hooks/useFilaPublica";
import { useImpressoraStatus } from "@/hooks/useImpressoraStatus";
import { ImprimindoAgora } from "./ImprimindoAgora";
import { FilaLista } from "./FilaLista";
import { FaixaImpressora } from "./FaixaImpressora";
import { BarraInferior } from "./BarraInferior";
import { IdleScreen } from "./IdleScreen";
import { OverlayPrecos } from "./OverlayPrecos";
import { OverlayImprimir } from "./OverlayImprimir";
import { OverlayAjuda } from "./OverlayAjuda";

export type OverlayId = "ajuda" | "precos" | "imprimir";

// Tela idle após esse tempo sem nenhum toque na tela (spec kiosk-client-view).
// Com a fila de 24h ela quase nunca fica vazia, então "fila vazia" deixou de
// ser o critério — o gatilho agora é só inatividade.
const IDLE_MS = 180_000;

export default function KioskApp() {
  const { itens } = useFilaPublica();
  const { estado, detalhes, offline } = useImpressoraStatus();

  // Só um overlay aberto por vez.
  const [overlay, setOverlay] = useState<OverlayId | null>(null);

  // Começa em idle: o totem liga sem ninguém na frente; a fila aparece no
  // primeiro toque ou quando um pedido ativo chegar (efeito abaixo).
  const [idle, setIdle] = useState(true);

  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armarIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      setOverlay(null); // overlay esquecido aberto não segura a tela
      setIdle(true);
    }, IDLE_MS);
  }, []);

  // Qualquer toque reinicia a contagem de inatividade. Listener em capture na
  // window para valer em toda a árvore, inclusive overlays e a própria idle.
  useEffect(() => {
    window.addEventListener("pointerdown", armarIdle, true);
    armarIdle();
    return () => {
      window.removeEventListener("pointerdown", armarIdle, true);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [armarIdle]);

  const acordar = useCallback(() => {
    setIdle(false);
    armarIdle();
  }, [armarIdle]);

  // Acorda quando um pedido ativo novo entra ou algo começa a imprimir.
  // Compara contagens (não itens.length): um IMPRESSO velho saindo da janela
  // de 24h muda o tamanho da fila, mas não pode acordar a tela.
  const ativos = itens.filter(
    (i) => i.status === "PAGO" || i.status === "IMPRIMINDO"
  ).length;
  const emImpressao = itens.filter((i) => i.status === "IMPRIMINDO").length;
  const prevAtivos = useRef(0);
  const prevEmImpressao = useRef(0);
  useEffect(() => {
    const chegouNovo =
      ativos > prevAtivos.current || emImpressao > prevEmImpressao.current;
    prevAtivos.current = ativos;
    prevEmImpressao.current = emImpressao;
    if (chegouNovo) acordar();
  }, [ativos, emImpressao, acordar]);

  if (idle) {
    return <IdleScreen onInteract={acordar} />;
  }

  const imprimindo = itens.find((i) => i.status === "IMPRIMINDO");
  const resto = itens.filter((i) => i !== imprimindo);

  return (
    <div className="flex h-full w-full flex-col gap-4 p-5">
      <FaixaImpressora estado={estado} detalhes={detalhes} offline={offline} />

      <main className="flex min-h-0 flex-1 flex-col gap-4">
        {imprimindo && <ImprimindoAgora item={imprimindo} />}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {resto.length > 0 ? (
            <FilaLista itens={resto} />
          ) : (
            !imprimindo && (
              <div className="flex h-full flex-col items-center justify-center text-center text-zinc-500">
                <p className="text-2xl font-semibold">Nenhum pedido na fila</p>
                <p className="mt-1 text-lg">
                  Toque em &quot;Imprimir&quot; para enviar o seu.
                </p>
              </div>
            )
          )}
        </div>
      </main>

      <BarraInferior onAbrir={setOverlay} />

      {overlay === "precos" && (
        <OverlayPrecos onClose={() => setOverlay(null)} />
      )}
      {overlay === "imprimir" && (
        <OverlayImprimir onClose={() => setOverlay(null)} />
      )}
      {overlay === "ajuda" && <OverlayAjuda onClose={() => setOverlay(null)} />}
    </div>
  );
}
