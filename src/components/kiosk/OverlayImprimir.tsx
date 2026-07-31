"use client";

import { KioskOverlay } from "./KioskOverlay";
import { KioskQRCode } from "./KioskQRCode";

type Props = {
  onClose: () => void;
};

// Overlay "Imprimir": QR code apontando para /impressao + instrução curta.
export function OverlayImprimir({ onClose }: Props) {
  return (
    <KioskOverlay titulo="Imprimir" onClose={onClose}>
      <div className="flex flex-col items-center gap-6 text-center">
        <p className="text-2xl text-zinc-200">
          Aponte a câmera do celular para o código e faça seu pedido.
        </p>
        <KioskQRCode path="/impressao" size={260} />
        <p className="text-lg text-zinc-400">
          Envie o PDF, pague com PIX e acompanhe a fila por aqui.
        </p>
      </div>
    </KioskOverlay>
  );
}
