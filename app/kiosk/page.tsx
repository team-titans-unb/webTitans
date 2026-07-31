"use client";

import dynamic from "next/dynamic";

// O kiosk é 100% client-side (Realtime, envs NEXT_PUBLIC_*, timers, window.origin).
// Carregamos sem SSR para o build não pré-renderizar — mesmo padrão de /impressao.
const KioskApp = dynamic(() => import("@/components/kiosk/KioskApp"), {
  ssr: false,
});

export default function Page() {
  return <KioskApp />;
}
