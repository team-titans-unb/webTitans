"use client";

import dynamic from "next/dynamic";

// Kanban é 100% client-side (estado em memória, drag & drop). Sem SSR para
// evitar mismatch de hidratação nas datas relativas dos dados de exemplo.
const EquipeTarefas = dynamic(() => import("@/views/EquipeTarefas"), {
  ssr: false,
});

export default function Page() {
  return <EquipeTarefas />;
}
