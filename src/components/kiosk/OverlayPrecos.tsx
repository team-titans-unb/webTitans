"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchPrecos, formatBRL } from "@/lib/pricing";
import { KioskOverlay } from "./KioskOverlay";

type Props = {
  onClose: () => void;
};

// Overlay de preços: lê config_precos e mostra o valor por página. A impressora
// é laser P&B, então exibimos apenas o preço de Preto e branco.
export function OverlayPrecos({ onClose }: Props) {
  const { data: precos, isLoading, isError } = useQuery({
    queryKey: ["kiosk", "precos"],
    queryFn: fetchPrecos,
  });

  return (
    <KioskOverlay titulo="Preços" onClose={onClose}>
      <p className="mb-6 text-xl text-zinc-400">Valor por página impressa.</p>

      {isLoading && <p className="text-xl text-zinc-400">Carregando…</p>}
      {isError && (
        <p className="text-xl text-red-300">
          Não foi possível carregar os preços agora.
        </p>
      )}

      {precos && (
        <div className="mx-auto max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
          <p className="text-lg uppercase tracking-widest text-zinc-400">
            Preto e branco
          </p>
          <p className="mt-2 text-5xl font-black text-white">
            {formatBRL(precos.PB)}
          </p>
          <p className="mt-1 text-base text-zinc-500">por página</p>
        </div>
      )}
    </KioskOverlay>
  );
}
