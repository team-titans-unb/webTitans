import type { ModoCor, StatusPedido } from "@/lib/types";

// Lógica de estado da impressora compartilhada com /impressao vive em
// @/lib/impressora; reexportada aqui para manter os imports do kiosk estáveis.
export { faixaImpressora, type FaixaImpressora } from "@/lib/impressora";

export function rotuloModoCor(modo: ModoCor): string {
  return modo === "PB" ? "P&B" : "Colorido";
}

// Formata um timestamp ISO como "HH:MM" (pt-BR). Retorna "" para null/inválido,
// deixando o chamador decidir se omite o trecho.
export function formatarHorario(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// Compara duas datas pelo dia de calendário no horário local (o kiosk roda em
// America/Sao_Paulo). Evita a armadilha do intervalo de 24 h: "ontem 23:50" é
// ontem mesmo quando faz só 10 minutos.
function mesmoDiaLocal(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Rótulo relativo ao dia corrente: "hoje" / "ontem" / "dd/MM" (mais antigo ou
// qualquer outro dia). Retorna "" para null/inválido — mesmo contrato de
// formatarHorario, deixando o chamador decidir se omite o trecho.
export function formatarDataRelativa(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";

  const hoje = new Date();
  if (mesmoDiaLocal(d, hoje)) return "hoje";

  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  if (mesmoDiaLocal(d, ontem)) return "ontem";

  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// Horário exibido na fila: pedido impresso mostra quando saiu (printed_at);
// os demais mostram quando o pagamento foi confirmado (paid_at). Itens de hoje
// exibem só o horário; de outros dias incluem a data ("ontem"/"dd/MM") para não
// serem ambíguos na janela de 24 h. Retorna "" sem timestamp, para o chamador
// omitir o trecho.
export function rotuloHorarioFila(status: StatusPedido, paidAt: string | null, printedAt: string | null): string {
  const impresso = status === "IMPRESSO";
  const timestamp = impresso ? printedAt : paidAt;
  const acao = impresso ? "impresso" : "pago";

  const horario = formatarHorario(timestamp);
  if (!horario) return "";

  const dia = formatarDataRelativa(timestamp);
  if (dia === "hoje") return `${acao} às ${horario}`;
  if (dia === "ontem") return `${acao} ontem às ${horario}`;
  return `${acao} em ${dia} às ${horario}`;
}

export type StatusVisual = {
  rotulo: string;
  // Classes do "chip" de status (fundo, texto, borda) com cor semântica.
  classe: string;
};

// Cor semântica do status na fila: PAGO neutro, IMPRIMINDO em destaque,
// IMPRESSO verde, ERRO vermelho.
export function statusVisualFila(status: StatusPedido): StatusVisual {
  switch (status) {
    case "IMPRIMINDO":
      return {
        rotulo: "Imprimindo",
        classe: "bg-titans-orange/20 text-titans-orange border-titans-orange/40",
      };
    case "IMPRESSO":
      return {
        rotulo: "Pronto",
        classe: "bg-green-500/15 text-green-400 border-green-500/30",
      };
    case "ERRO":
      return {
        rotulo: "Erro",
        classe: "bg-red-500/15 text-red-400 border-red-500/30",
      };
    case "PAGO":
    default:
      return {
        rotulo: "Na fila",
        classe: "bg-white/10 text-zinc-300 border-white/15",
      };
  }
}

