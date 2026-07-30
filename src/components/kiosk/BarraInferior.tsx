"use client";

import { HelpCircle, Tag, Printer } from "lucide-react";
import type { OverlayId } from "./KioskApp";

type Props = {
  onAbrir: (id: OverlayId) => void;
};

const BOTAO =
  "flex min-h-[80px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl text-xl font-semibold transition active:scale-95";

// Barra inferior com 3 botões grandes touch (mín. 80px de altura).
export function BarraInferior({ onAbrir }: Props) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <button
        type="button"
        onClick={() => onAbrir("ajuda")}
        className={`${BOTAO} border border-white/15 bg-white/5 text-white`}
      >
        <HelpCircle className="h-7 w-7" />
        Ajuda
      </button>
      <button
        type="button"
        onClick={() => onAbrir("precos")}
        className={`${BOTAO} border border-white/15 bg-white/5 text-white`}
      >
        <Tag className="h-7 w-7" />
        Preços
      </button>
      <button
        type="button"
        onClick={() => onAbrir("imprimir")}
        className={`${BOTAO} bg-gradient-to-r from-titans-red to-titans-orange text-white shadow-lg shadow-titans-red/25`}
      >
        <Printer className="h-7 w-7" />
        Imprimir
      </button>
    </div>
  );
}
