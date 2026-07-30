"use client";

import { useEffect, useRef, useState } from "react";
import { Delete, AlertTriangle, CheckCircle2, KeyRound } from "lucide-react";
import type { StatusPedido } from "@/lib/types";
import { KioskOverlay } from "./KioskOverlay";
import { formatarHorario, formatarDataRelativa } from "./status";
import { KioskQRCode } from "./KioskQRCode";

type Props = {
  onClose: () => void;
};

type ConsultaResposta = {
  status: StatusPedido;
  paid_at: string | null;
  printed_at: string | null;
  posicao_na_fila: number | null;
};

type EstadoConsulta =
  | { fase: "digitando" }
  | { fase: "consultando" }
  | { fase: "encontrado"; dados: ConsultaResposta }
  | { fase: "nao_encontrado" }
  | { fase: "erro" };

type CategoriaChamado = "NAO_SAIU" | "SAIU_COM_DEFEITO" | "OUTRO";

// Resgate do código de reimpressão (fluxo B, spec kiosk-help-requests): campo
// separado do teclado de protocolo da consulta acima, endpoint dedicado.
type CampoReimpressao = "protocolo" | "codigo";
type EstadoReimpressao =
  | { fase: "idle" }
  | { fase: "enviando" }
  | { fase: "sucesso"; posicaoNaFila: number | null }
  | { fase: "erro" }
  | { fase: "limite" };

const CATEGORIAS: { id: CategoriaChamado; rotulo: string }[] = [
  { id: "NAO_SAIU", rotulo: "Minha impressão não saiu" },
  { id: "SAIU_COM_DEFEITO", rotulo: "Saiu com defeito" },
  { id: "OUTRO", rotulo: "Outro problema" },
];

const TECLAS_HEX = [
  "1", "2", "3", "A",
  "4", "5", "6", "B",
  "7", "8", "9", "C",
  "D", "E", "F", "0",
];

// Convite do grupo de ajuda dos clientes no Telegram. Público por natureza
// (qualquer um com o link entra); inlinado no bundle pelo Next em build. Vazio/
// ausente esconde o botão do Telegram no overlay.
const TELEGRAM_HELP_INVITE_URL = process.env.NEXT_PUBLIC_TELEGRAM_HELP_INVITE_URL;

// Azul da marca do Telegram — usado no fundo do botão para destacá-lo.
const TELEGRAM_AZUL = "#229ED9";

// Aviãozinho do Telegram como SVG inline (lucide não tem a marca). Usa
// currentColor, então herda o branco do texto do botão.
function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
    </svg>
  );
}

// Frase "Impresso [hoje/ontem/em dd/MM] às HH:MM." a partir de printed_at.
// Sem printed_at cai para "Impresso." — texto que ainda faz sentido no detalhe.
function textoImpressao(printedAt: string | null): string {
  const horario = formatarHorario(printedAt);
  if (!horario) return "Impresso";

  const dia = formatarDataRelativa(printedAt);
  if (dia === "hoje") return `Impresso hoje às ${horario}`;
  if (dia === "ontem") return `Impresso ontem às ${horario}`;
  return `Impresso em ${dia} às ${horario}`;
}

// Orientação amigável por status do pedido (spec kiosk-help-requests).
function orientacao(dados: ConsultaResposta): {
  titulo: string;
  detalhe: string;
  chamarEmDestaque: boolean;
} {
  switch (dados.status) {
    case "AGUARDANDO_PAGAMENTO":
      return {
        titulo: "Pagamento ainda não confirmado",
        detalhe: "Assim que o PIX for confirmado, seu pedido entra na fila.",
        chamarEmDestaque: false,
      };
    case "PAGO":
      return {
        titulo:
          dados.posicao_na_fila != null
            ? `Você é o ${dados.posicao_na_fila}º da fila`
            : "Na fila de impressão",
        detalhe: "É só aguardar — seu pedido será impresso em breve.",
        chamarEmDestaque: false,
      };
    case "IMPRIMINDO":
      return {
        titulo: "Está saindo agora",
        detalhe: "Seu pedido está sendo impresso neste momento.",
        chamarEmDestaque: false,
      };
    case "IMPRESSO":
      return {
        titulo: "Pronto para retirada",
        detalhe: `${textoImpressao(dados.printed_at)}. Pode retirar na sede.`,
        chamarEmDestaque: false,
      };
    case "ERRO":
    case "CANCELADO":
    default:
      return {
        titulo: "Houve um problema com este pedido",
        detalhe: "Chame a equipe pelo botão abaixo para resolver.",
        chamarEmDestaque: true,
      };
  }
}

// Teclado hexadecimal próprio (sem teclado do SO), reutilizado pela consulta
// de protocolo acima e pelo resgate de código de reimpressão abaixo — os dois
// únicos pontos do overlay que pedem dígitos hex ao cliente.
function TecladoHex({
  onDigitar,
  onApagar,
  onLimpar,
  disabled = false,
}: {
  onDigitar: (char: string) => void;
  onApagar: () => void;
  onLimpar: () => void;
  disabled?: boolean;
}) {
  return (
    <>
      <div className="grid grid-cols-4 gap-3">
        {TECLAS_HEX.map((t) => (
          <button
            key={t}
            type="button"
            disabled={disabled}
            onClick={() => onDigitar(t)}
            className="min-h-[56px] rounded-xl border border-white/10 bg-white/5 font-mono text-3xl font-bold text-white transition active:scale-95 disabled:opacity-40"
          >
            {t}
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={disabled}
          onClick={onApagar}
          className="flex min-h-[56px] items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 text-2xl font-semibold text-white transition active:scale-95 disabled:opacity-40"
        >
          <Delete className="h-7 w-7" /> Apagar
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onLimpar}
          className="min-h-[56px] rounded-xl border border-white/10 bg-white/5 text-2xl font-semibold text-white transition active:scale-95 disabled:opacity-40"
        >
          Limpar
        </button>
      </div>
    </>
  );
}

// Overlay de ajuda: consulta por protocolo (teclado hex próprio) + chamado à equipe.
export function OverlayAjuda({ onClose }: Props) {
  const [codigo, setCodigo] = useState("");
  const [consulta, setConsulta] = useState<EstadoConsulta>({ fase: "digitando" });
  const [chamado, setChamado] = useState<"idle" | "enviando" | "ok" | "erro">(
    "idle"
  );
  // Painel do QR do Telegram — estado interno do overlay (não um segundo
  // overlay: a spec do kiosk exige um overlay por vez).
  const [telegramAberto, setTelegramAberto] = useState(false);

  // Resgate do código de reimpressão — campos SEPARADOS do teclado de
  // protocolo da consulta acima (spec kiosk-help-requests): protocolo e
  // código de uso único (R-XXXXXXXX) que a equipe passou ao cliente.
  const [reimpressaoAberto, setReimpressaoAberto] = useState(false);
  const [campoAtivoReimpressao, setCampoAtivoReimpressao] =
    useState<CampoReimpressao>("protocolo");
  const [protocoloReimpressao, setProtocoloReimpressao] = useState("");
  const [codigoReimpressao, setCodigoReimpressao] = useState("");
  const [estadoReimpressao, setEstadoReimpressao] = useState<EstadoReimpressao>({
    fase: "idle",
  });

  const completo = codigo.length === 8;
  const telegramDisponivel = Boolean(TELEGRAM_HELP_INVITE_URL);
  const reimpressaoCompleta =
    protocoloReimpressao.length === 8 && codigoReimpressao.length === 8;

  function adicionar(char: string) {
    if (codigo.length >= 8) return;
    setCodigo((c) => c + char);
    setConsulta({ fase: "digitando" });
    setChamado("idle");
  }
  function apagar() {
    setCodigo((c) => c.slice(0, -1));
    setConsulta({ fase: "digitando" });
  }
  function limpar() {
    setCodigo("");
    setConsulta({ fase: "digitando" });
    setChamado("idle");
  }

  async function consultar() {
    if (!completo) return;
    setConsulta({ fase: "consultando" });
    try {
      const res = await fetch(`/api/kiosk/pedido?protocolo=${codigo}`);
      if (res.status === 404) {
        setConsulta({ fase: "nao_encontrado" });
        return;
      }
      if (!res.ok) {
        setConsulta({ fase: "erro" });
        return;
      }
      const dados = (await res.json()) as ConsultaResposta;
      setConsulta({ fase: "encontrado", dados });
    } catch {
      setConsulta({ fase: "erro" });
    }
  }

  async function chamarEquipe(categoria: CategoriaChamado) {
    setChamado("enviando");
    try {
      const res = await fetch("/api/kiosk/help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          protocolo: completo ? codigo : undefined,
          categoria,
        }),
      });
      // 201 = criado; 429 = já avisado há pouco (tratamos como sucesso amigável).
      if (res.ok || res.status === 429) setChamado("ok");
      else setChamado("erro");
    } catch {
      setChamado("erro");
    }
  }

  // O teclado hex é compartilhado pelos dois campos do resgate; o dígito cai
  // no campo ativo e, ao completar o protocolo, avança sozinho para o código.
  function digitarReimpressao(char: string) {
    if (campoAtivoReimpressao === "protocolo") {
      if (protocoloReimpressao.length >= 8) return;
      const novo = protocoloReimpressao + char;
      setProtocoloReimpressao(novo);
      if (novo.length === 8) setCampoAtivoReimpressao("codigo");
    } else {
      if (codigoReimpressao.length >= 8) return;
      setCodigoReimpressao((c) => c + char);
    }
    setEstadoReimpressao({ fase: "idle" });
  }
  function apagarReimpressao() {
    if (campoAtivoReimpressao === "protocolo") {
      setProtocoloReimpressao((c) => c.slice(0, -1));
    } else {
      setCodigoReimpressao((c) => c.slice(0, -1));
    }
    setEstadoReimpressao({ fase: "idle" });
  }
  function limparReimpressao() {
    setProtocoloReimpressao("");
    setCodigoReimpressao("");
    setCampoAtivoReimpressao("protocolo");
    setEstadoReimpressao({ fase: "idle" });
  }

  async function confirmarReimpressao() {
    if (!reimpressaoCompleta) return;
    setEstadoReimpressao({ fase: "enviando" });
    try {
      const res = await fetch("/api/kiosk/reimpressao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          protocolo: protocoloReimpressao,
          codigo: `R-${codigoReimpressao}`,
        }),
      });
      if (res.status === 429) {
        setEstadoReimpressao({ fase: "limite" });
        return;
      }
      if (!res.ok) {
        setEstadoReimpressao({ fase: "erro" });
        return;
      }
      const dados = (await res.json()) as { posicao_na_fila: number | null };
      setEstadoReimpressao({ fase: "sucesso", posicaoNaFila: dados.posicao_na_fila });
    } catch {
      setEstadoReimpressao({ fase: "erro" });
    }
  }

  const dadosEncontrado =
    consulta.fase === "encontrado" ? orientacao(consulta.dados) : null;

  // Em telas baixas (ex.: touch 1024×600) o overlay rola; o resultado da
  // consulta nasce abaixo da dobra e o cliente não perceberia — rola até ele.
  const resultadoRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (consulta.fase === "digitando" || consulta.fase === "consultando") return;
    resultadoRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [consulta.fase]);

  // O painel do Telegram nasce no fim do overlay, abaixo da dobra em telas
  // baixas — rola até ele ao abrir, seguindo o padrão do resultado da consulta.
  const telegramRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!telegramAberto) return;
    telegramRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [telegramAberto]);

  // Mesmo padrão de rolagem do painel do Telegram, para o painel de resgate
  // do código de reimpressão.
  const reimpressaoRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!reimpressaoAberto) return;
    reimpressaoRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [reimpressaoAberto]);

  // Visor fixo fora da área rolável: continua visível enquanto o cliente
  // digita mesmo quando o teclado força rolagem em telas baixas (1024×600).
  const visor = (
    <>
      <p className="mb-3 text-xl text-zinc-300">
        Digite o protocolo de 8 dígitos do seu pedido.
      </p>
      <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-black/40 py-3">
        <span className="font-mono text-4xl font-bold tracking-[0.4em] text-white">
          {codigo.padEnd(8, "•")}
        </span>
      </div>
    </>
  );

  return (
    <KioskOverlay titulo="Ajuda" cabecalho={visor} fundoVisivel onClose={onClose}>
      <TecladoHex onDigitar={adicionar} onApagar={apagar} onLimpar={limpar} />

      <button
        type="button"
        onClick={consultar}
        disabled={!completo || consulta.fase === "consultando"}
        className="mt-3 min-h-[64px] w-full rounded-2xl bg-gradient-to-r from-titans-red to-titans-orange text-2xl font-bold text-white shadow-lg shadow-titans-red/25 transition active:scale-95 disabled:opacity-40"
      >
        {consulta.fase === "consultando" ? "Consultando…" : "Consultar"}
      </button>

      {/* Resultado da consulta — o ref embrulha as mensagens para o
          scrollIntoView trazer a caixa inteira à vista, não só um marcador. */}
      <div ref={resultadoRef}>
        {consulta.fase === "nao_encontrado" && (
          <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-center text-xl text-amber-200">
            Pedido não encontrado. Confira o código e tente de novo.
          </div>
        )}
        {consulta.fase === "erro" && (
          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-center text-xl text-red-200">
            Não foi possível consultar agora. Tente novamente em instantes.
          </div>
        )}
        {dadosEncontrado && (
          <div
            className={`mt-6 rounded-2xl border p-6 ${
              dadosEncontrado.chamarEmDestaque
                ? "border-red-500/40 bg-red-500/10"
                : "border-white/10 bg-white/5"
            }`}
          >
            <p className="text-2xl font-bold text-white">
              {dadosEncontrado.titulo}
            </p>
            <p className="mt-1 text-lg text-zinc-300">
              {dadosEncontrado.detalhe}
            </p>
          </div>
        )}
      </div>

      {/* Chamar a equipe */}
      <div className="mt-8 border-t border-white/10 pt-6">
        {chamado === "ok" ? (
          <div className="flex items-center justify-center gap-3 rounded-2xl border border-green-500/30 bg-green-500/10 p-5 text-xl font-semibold text-green-200">
            <CheckCircle2 className="h-7 w-7" /> Equipe avisada! Aguarde um momento.
          </div>
        ) : (
          <>
            <p
              className={`mb-3 flex items-center gap-2 text-xl font-semibold ${
                dadosEncontrado?.chamarEmDestaque
                  ? "text-red-300"
                  : "text-zinc-200"
              }`}
            >
              <AlertTriangle className="h-6 w-6" /> Precisa de ajuda? Chame a
              equipe:
            </p>
            <div className="grid grid-cols-1 gap-3">
              {CATEGORIAS.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  disabled={chamado === "enviando"}
                  onClick={() => chamarEquipe(cat.id)}
                  className="min-h-[56px] rounded-xl border border-white/15 bg-white/5 px-5 text-xl font-semibold text-white transition active:scale-95 disabled:opacity-40"
                >
                  {cat.rotulo}
                </button>
              ))}
            </div>
            {chamado === "erro" && (
              <p className="mt-3 text-center text-lg text-red-300">
                Não foi possível avisar a equipe. Tente novamente.
              </p>
            )}
          </>
        )}
      </div>

      {/* Falar com a equipe no Telegram — só quando o convite está configurado. */}
      {telegramDisponivel && TELEGRAM_HELP_INVITE_URL && (
        <div className="mt-8 border-t border-white/10 pt-6" ref={telegramRef}>
          <button
            type="button"
            onClick={() => setTelegramAberto((aberto) => !aberto)}
            style={{ backgroundColor: TELEGRAM_AZUL }}
            className="flex min-h-[56px] w-full items-center justify-center gap-3 rounded-xl px-5 text-xl font-semibold text-white shadow-lg shadow-sky-500/25 transition active:scale-95"
          >
            <TelegramIcon className="h-7 w-7" />
            Falar com a equipe no Telegram
          </button>

          {telegramAberto && (
            <div className="mt-4 flex flex-col items-center rounded-2xl border border-white/10 bg-white/5 p-6">
              <KioskQRCode url={TELEGRAM_HELP_INVITE_URL} size={200} />

              {completo ? (
                <div className="mt-5 w-full text-center">
                  <p className="text-lg text-zinc-300">
                    Ao entrar no grupo, envie este protocolo:
                  </p>
                  <p className="mt-2 font-mono text-4xl font-bold tracking-[0.3em] text-white">
                    {codigo}
                  </p>
                </div>
              ) : (
                <p className="mt-5 text-center text-lg text-zinc-300">
                  Ao entrar, conte seu problema e, se tiver, informe o protocolo
                  do pedido.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Resgate de código de reimpressão — caminho SEPARADO do teclado de
          protocolo da consulta acima (spec kiosk-help-requests): usado quando
          a equipe já autorizou uma reimpressão e passou o código pelo bot. */}
      <div className="mt-8 border-t border-white/10 pt-6" ref={reimpressaoRef}>
        <button
          type="button"
          onClick={() => setReimpressaoAberto((aberto) => !aberto)}
          className="flex min-h-[56px] w-full items-center justify-center gap-3 rounded-xl border border-white/15 bg-white/5 px-5 text-xl font-semibold text-white transition active:scale-95"
        >
          <KeyRound className="h-7 w-7" />
          Tenho um código de reimpressão
        </button>

        {reimpressaoAberto && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="mb-3 text-lg text-zinc-300">
              Toque em um campo, digite com o teclado abaixo: o protocolo do
              pedido e o código que a equipe te passou.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCampoAtivoReimpressao("protocolo")}
                className={`rounded-xl border p-3 text-left transition ${
                  campoAtivoReimpressao === "protocolo"
                    ? "border-titans-orange bg-black/40"
                    : "border-white/10 bg-black/20"
                }`}
              >
                <span className="block text-sm text-zinc-400">Protocolo</span>
                <span className="font-mono text-xl font-bold tracking-[0.2em] text-white">
                  {protocoloReimpressao.padEnd(8, "•")}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setCampoAtivoReimpressao("codigo")}
                className={`rounded-xl border p-3 text-left transition ${
                  campoAtivoReimpressao === "codigo"
                    ? "border-titans-orange bg-black/40"
                    : "border-white/10 bg-black/20"
                }`}
              >
                <span className="block text-sm text-zinc-400">Código (R-)</span>
                <span className="font-mono text-xl font-bold tracking-[0.2em] text-white">
                  {codigoReimpressao.padEnd(8, "•")}
                </span>
              </button>
            </div>

            <div className="mt-4">
              <TecladoHex
                onDigitar={digitarReimpressao}
                onApagar={apagarReimpressao}
                onLimpar={limparReimpressao}
                disabled={estadoReimpressao.fase === "enviando"}
              />
            </div>

            <button
              type="button"
              onClick={confirmarReimpressao}
              disabled={!reimpressaoCompleta || estadoReimpressao.fase === "enviando"}
              className="mt-3 min-h-[64px] w-full rounded-2xl bg-gradient-to-r from-titans-red to-titans-orange text-2xl font-bold text-white shadow-lg shadow-titans-red/25 transition active:scale-95 disabled:opacity-40"
            >
              {estadoReimpressao.fase === "enviando"
                ? "Enviando…"
                : "Confirmar reimpressão"}
            </button>

            {estadoReimpressao.fase === "sucesso" && (
              <div className="mt-4 flex items-center justify-center gap-3 rounded-2xl border border-green-500/30 bg-green-500/10 p-5 text-center text-xl font-semibold text-green-200">
                <CheckCircle2 className="h-7 w-7" />
                Reimpressão solicitada!
                {estadoReimpressao.posicaoNaFila != null &&
                  ` Você é o ${estadoReimpressao.posicaoNaFila}º da fila.`}
              </div>
            )}
            {estadoReimpressao.fase === "erro" && (
              <p className="mt-4 text-center text-lg text-red-300">
                Código inválido ou pedido não elegível. Confira com a equipe.
              </p>
            )}
            {estadoReimpressao.fase === "limite" && (
              <p className="mt-4 text-center text-lg text-amber-300">
                Muitas tentativas. Aguarde alguns minutos e tente de novo.
              </p>
            )}
          </div>
        )}
      </div>
    </KioskOverlay>
  );
}
