"use client";

import { QRCodeSVG } from "qrcode.react";

// Domínio público do site. O kiosk roda em localhost na Raspberry Pi, então o
// origin atual seria inútil no celular do cliente — apontamos para o domínio fixo.
const BASE_URL = "https://roboticstitans.com.br";

// Exatamente uma das duas formas é aceita, garantido em compile-time pela união
// discriminada: `path` (caminho do site, montado sobre o domínio fixo) OU `url`
// (endereço absoluto já pronto, ex.: convite do Telegram https://t.me/+...).
type Props = { size?: number } & (
  | { path: string; url?: never }
  | { url: string; path?: never }
);

// QR code do kiosk, com fundo branco para leitura pela câmera do celular.
// Aponta para o domínio público fixo (via `path`) ou para uma URL absoluta (`url`).
export function KioskQRCode(props: Props) {
  const { size = 220 } = props;
  const url = "url" in props && props.url ? props.url : `${BASE_URL}${props.path}`;

  return (
    <div className="rounded-2xl bg-white p-4 shadow-lg" style={{ lineHeight: 0 }}>
      <QRCodeSVG value={url} size={size} level="M" />
    </div>
  );
}
