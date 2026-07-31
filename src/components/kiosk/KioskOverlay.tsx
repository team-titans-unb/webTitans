"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

const AUTO_CLOSE_MS = 60_000;

type Props = {
  titulo?: string;
  // Conteúdo fixo entre o título e a área rolável (ex.: visor do protocolo).
  cabecalho?: React.ReactNode;
  // Quando true, o fundo fica menos escurecido e sem blur, e o painel ancora à
  // direita com largura reduzida — deixa a fila (à esquerda) legível por trás.
  // Usado na Ajuda, onde o cliente pode querer conferir protocolo/horário atrás.
  fundoVisivel?: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

// Painel sobreposto reutilizável: fundo escurecido, X grande no canto, animação de
// entrada. Só um fica aberto por vez (controlado pelo pai). Auto-fecha após 60 s
// sem interação — qualquer toque dentro do overlay reinicia o timer. Com
// `fundoVisivel`, o fundo fica legível e o painel encosta à direita da tela.
export function KioskOverlay({
  titulo,
  cabecalho,
  fundoVisivel = false,
  onClose,
  children,
}: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reiniciarTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(onClose, AUTO_CLOSE_MS);
  };

  useEffect(() => {
    reiniciarTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-stretch p-4 animate-in fade-in duration-200 ${
        fundoVisivel
          ? "justify-center bg-black/40"
          : "justify-center bg-black/75 backdrop-blur-sm"
      }`}
      onPointerDown={reiniciarTimer}
      onTouchStart={reiniciarTimer}
    >
      <div
        className={`relative flex w-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 ${
          fundoVisivel ? "max-w-xl" : "max-w-3xl"
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-4 top-4 z-10 flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-white transition active:scale-95"
        >
          <X className="h-9 w-9" />
        </button>

        {titulo && (
          <h2 className="px-8 pt-8 pr-24 text-4xl font-bold text-white">
            {titulo}
          </h2>
        )}

        {cabecalho && <div className="px-8 pt-5">{cabecalho}</div>}

        <div
          className={`flex-1 overflow-y-auto p-8 ${cabecalho ? "pt-5" : ""}`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
