import type { EstadoImpressora } from "@/hooks/useImpressoraStatus";

// Tom semântico do estado, para consumidores que precisam de estilos próprios
// (o kiosk usa `classe` direto; /impressao mapeia o tom para o tema claro/escuro).
export type TomImpressora = "ok" | "imprimindo" | "atencao" | "erro";

export type FaixaImpressora = {
  texto: string;
  tom: TomImpressora;
  // Cor da faixa de estado da impressora (paleta do kiosk, fundo escuro).
  classe: string;
  ativa: boolean; // impressora efetivamente imprimindo (usado para animação)
};

// Texto amigável + cor da faixa de estado da impressora. `offline` tem prioridade
// sobre o estado gravado (worker/Pi caiu). Compartilhado entre o kiosk e a
// página de checkout /impressao.
export function faixaImpressora(
  estado: EstadoImpressora | null,
  offline: boolean
): FaixaImpressora {
  if (offline) {
    return {
      texto: "Sistema de impressão offline",
      tom: "erro",
      classe: "bg-red-500/15 text-red-300 border-red-500/30",
      ativa: false,
    };
  }
  switch (estado) {
    case "IMPRIMINDO":
      return {
        texto: "Imprimindo…",
        tom: "imprimindo",
        classe: "bg-titans-orange/15 text-titans-orange border-titans-orange/30",
        ativa: true,
      };
    case "PAUSADA":
      return {
        texto: "Impressora pausada",
        tom: "atencao",
        classe: "bg-amber-500/15 text-amber-300 border-amber-500/30",
        ativa: false,
      };
    case "INALCANCAVEL":
      return {
        texto: "Impressora indisponível — equipe avisada",
        tom: "erro",
        classe: "bg-red-500/15 text-red-300 border-red-500/30",
        ativa: false,
      };
    case "SEM_PAPEL":
      return {
        texto: "Sem papel — a equipe já foi avisada",
        tom: "atencao",
        classe: "bg-amber-500/15 text-amber-300 border-amber-500/30",
        ativa: false,
      };
    case "SEM_TONER":
      return {
        texto: "Toner esgotado — a equipe já foi avisada",
        tom: "erro",
        classe: "bg-red-500/15 text-red-300 border-red-500/30",
        ativa: false,
      };
    case "MANUTENCAO":
      return {
        texto: "Impressora em manutenção — a equipe já foi avisada",
        tom: "atencao",
        classe: "bg-amber-500/15 text-amber-300 border-amber-500/30",
        ativa: false,
      };
    case "OK":
    default:
      return {
        texto: "Impressora pronta",
        tom: "ok",
        classe: "bg-green-500/15 text-green-300 border-green-500/30",
        ativa: false,
      };
  }
}

// Rótulo do aviso de toner acabando. Só inclui o percentual quando há um valor
// numérico válido — nunca mostra "%" sozinho.
export function rotuloTonerAcabando(
  detalhes: { toner_pct?: number | null } | null
): string {
  const pct = detalhes?.toner_pct;
  if (typeof pct === "number" && Number.isFinite(pct)) {
    return `Toner acabando · ${Math.round(pct)}%`;
  }
  return "Toner acabando";
}
