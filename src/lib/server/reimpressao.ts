import { supabaseAdmin } from "./supabase-admin";
import { resolverPedidoPorProtocolo, type PedidoParaReimpressao } from "./pedido-protocolo";
import { contarPosicaoNaFila } from "./fila";
import { enviarMensagemTelegram } from "./telegram";

// Status a partir dos quais um pedido pode voltar a PAGO para reimpressão.
const STATUS_ELEGIVEIS = ["ERRO", "IMPRESSO"] as const;

export type OrigemReimpressao = "bot" | "totem";

// Motivos de recusa da guarda de estado — puros, sem depender do banco.
export type MotivoGuardaDeEstado = "STATUS_NAO_ELEGIVEL" | "PDF_EXPIRADO";

export type MotivoRecusaReimpressao =
  | "NAO_ENCONTRADO"
  | MotivoGuardaDeEstado
  | "JA_PROCESSADO"
  | "CODIGO_INVALIDO"
  | "ERRO_INTERNO";

export type ResultadoReimpressao =
  | { ok: true; posicaoNaFila: number | null }
  | { ok: false; motivo: MotivoRecusaReimpressao };

// Guarda de estado (spec pedido-reimpressao): só é elegível para reimpressão
// quem está ERRO/IMPRESSO E ainda tem o PDF (a retenção anula pdf_path 7 dias
// após IMPRESSO). Pura — não toca o banco — para ser reutilizada tanto pelo
// núcleo quanto pela checagem prévia de elegibilidade do /gerar_codigo.
export function avaliarElegibilidade(
  pedido: Pick<PedidoParaReimpressao, "status" | "pdfPath">
): MotivoGuardaDeEstado | null {
  if (!STATUS_ELEGIVEIS.includes(pedido.status as (typeof STATUS_ELEGIVEIS)[number])) {
    return "STATUS_NAO_ELEGIVEL";
  }
  if (!pedido.pdfPath) {
    return "PDF_EXPIRADO";
  }
  return null;
}

// Best-effort: falha na notificação nunca desfaz a reimpressão (task 2.4).
async function notificarEquipeSobreReimpressao(args: {
  protocolo: string;
  origem: OrigemReimpressao;
  posicaoNaFila: number | null;
}): Promise<void> {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) return;

  const origemDescricao = args.origem === "bot" ? "comando /reimprimir" : "código no totem";
  const posicaoLinha =
    args.posicaoNaFila != null ? `\nPosição na fila: ${args.posicaoNaFila}º` : "";
  const texto =
    `🔁 Reimpressão autorizada\n` +
    `Protocolo: ${args.protocolo}\n` +
    `Origem: ${origemDescricao}` +
    posicaoLinha;

  await enviarMensagemTelegram({ chatId, texto });
}

// Núcleo único de reimpressão (design D1): resolve protocolo → aplica a
// guarda de estado → UPDATE atômico condicional preservando paid_at →
// auditoria + notificação best-effort. Chamado pelos dois fluxos (bot e
// totem) — nenhum deles reimplementa a regra, evitando divergência entre
// caminhos. Roda inteiramente com service_role; o worker de impressão não é
// alterado — ele já reimprime qualquer pedido que volte a PAGO.
export async function reimprimirPedido(args: {
  protocolo: string;
  origem: OrigemReimpressao;
  telegramUserId?: number;
}): Promise<ResultadoReimpressao> {
  const protocolo = args.protocolo.toUpperCase();

  const resolucao = await resolverPedidoPorProtocolo(protocolo);
  // Comparação explícita (=== false), não negação: o projeto roda com
  // strictNullChecks desligado, e sem ele o TypeScript não estreita uniões
  // discriminadas por booleano quando a condição é negada (!x.ok) — só quando
  // comparada explicitamente. Convenção seguida em todo este módulo.
  if (resolucao.encontrado === false) {
    return { ok: false, motivo: resolucao.erroConsulta ? "ERRO_INTERNO" : "NAO_ENCONTRADO" };
  }

  const motivoRecusa = avaliarElegibilidade(resolucao.pedido);
  if (motivoRecusa) {
    return { ok: false, motivo: motivoRecusa };
  }

  // UPDATE atômico e condicional: só afeta a linha se ela ainda estiver em um
  // status elegível no momento da escrita — resolve a corrida com outra
  // reimpressão concorrente numa única query, sem janela entre leitura e
  // escrita. paid_at NÃO é tocado: o pedido volta ao início da fila FIFO.
  const { data: atualizado, error: updateError } = await supabaseAdmin
    .from("fila_impressao")
    .update({ status: "PAGO", reimpressao: true })
    .eq("id", resolucao.pedido.id)
    .in("status", STATUS_ELEGIVEIS)
    .select("paid_at")
    .maybeSingle();

  if (updateError) {
    console.error("Erro no UPDATE atômico de reimpressão:", updateError);
    return { ok: false, motivo: "ERRO_INTERNO" };
  }
  if (!atualizado) {
    // Nenhuma linha afetada: outra solicitação venceu a corrida, ou o status
    // mudou entre a leitura e a escrita. Sem efeito colateral (spec).
    return { ok: false, motivo: "JA_PROCESSADO" };
  }

  const posicaoNaFila = await contarPosicaoNaFila(atualizado.paid_at);

  const { error: auditError } = await supabaseAdmin.from("reimpressoes").insert({
    pedido_id: resolucao.pedido.id,
    protocolo,
    origem: args.origem,
    telegram_user_id: args.telegramUserId ?? null,
  });
  if (auditError) {
    // A reimpressão já é um fato consumado (a linha já voltou a PAGO); desfazer
    // aqui arriscaria corrida com o worker, que pode já ter reivindicado o job.
    // Nunca silenciar: loga sempre para investigação manual da lacuna de auditoria.
    console.error("Erro registrando auditoria de reimpressão:", auditError);
  }

  await notificarEquipeSobreReimpressao({ protocolo, origem: args.origem, posicaoNaFila });

  return { ok: true, posicaoNaFila };
}
