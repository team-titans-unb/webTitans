"use client";

import dynamic from "next/dynamic";

// O checkout é 100% client-side (upload, pdfjs, Realtime, envs NEXT_PUBLIC_*).
// Carregamos a view sem SSR para que o build não tente pré-renderizá-la — o que
// dispararia o fail-fast de envs ausentes no ambiente de build.
const Impressao = dynamic(() => import("@/views/Impressao"), { ssr: false });

export default function Page() {
  return <Impressao />;
}
