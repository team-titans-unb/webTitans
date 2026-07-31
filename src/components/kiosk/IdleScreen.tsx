"use client";

import { KioskQRCode } from "./KioskQRCode";

type Props = {
  // Qualquer toque na tela idle volta para a tela principal.
  onInteract: () => void;
};

// Tela idle (sem pedidos na fila): branding TITANS + QR para imprimir.
export function IdleScreen({ onInteract }: Props) {
  return (
    <div
      // onClick (não onPointerDown): a troca de tela no pointerdown deixaria o
      // click do mesmo toque "vazar" para o botão da barra inferior que surge
      // na mesma posição, abrindo um overlay acidentalmente.
      onClick={onInteract}
      className="flex h-full w-full flex-col items-center justify-center gap-10 bg-[length:200%_200%] bg-gradient-to-br from-titans-red via-titans-orange to-titans-red p-8 text-center animate-[kiosk-gradient_10s_ease-in-out_infinite]"
    >
      <div className="animate-[kiosk-float_6s_ease-in-out_infinite]">
        <h1 className="text-7xl font-black tracking-tight text-white drop-shadow-lg sm:text-8xl">
          TITANS
        </h1>
        <p className="mt-2 text-2xl font-semibold uppercase tracking-[0.3em] text-white/80">
          Impressão
        </p>
      </div>

      <KioskQRCode path="/impressao" size={240} />

      <p className="text-3xl font-bold text-white drop-shadow">
        Imprima aqui — aponte a câmera
      </p>
      <p className="text-lg text-white/70">Toque na tela para ver a fila</p>
    </div>
  );
}
