"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UploadPDF } from "@/components/impressao/UploadPDF";
import { ConfiguracaoImpressao } from "@/components/impressao/ConfiguracaoImpressao";
import { TelaPagamento } from "@/components/impressao/TelaPagamento";
import { TelaSucesso } from "@/components/impressao/TelaSucesso";
import { BotaoOndeRetirar } from "@/components/impressao/BotaoOndeRetirar";
import { StatusImpressora } from "@/components/impressao/StatusImpressora";
import { supabase } from "@/lib/supabase";
import type { ArquivoSelecionado } from "@/lib/pdf-utils";
import type { ModoCor } from "@/lib/types";

type Passo = "UPLOAD" | "CONFIG" | "PAGAMENTO" | "SUCESSO" | "TIMEOUT";

type DadosPagamento = {
  qr_code_base64: string;
  qr_code_copia_cola: string;
  expiration_date_to: string | null;
  mp_payment_id: string;
  // Valor e contagem autoritativos calculados pelo servidor (create-pix).
  valor_centavos: number;
  num_paginas: number;
};

const Impressao = () => {
  const [passo, setPasso] = useState<Passo>("UPLOAD");
  // A lista de arquivos escolhidos vive aqui (e não dentro do UploadPDF) para
  // sobreviver ao ir e voltar entre UPLOAD e CONFIG; `file` é o PDF final do
  // pedido — o original quando há um arquivo só, o mesclado quando há vários.
  const [arquivos, setArquivos] = useState<ArquivoSelecionado[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [numPaginas, setNumPaginas] = useState<number>(0);
  const [valorCentavos, setValorCentavos] = useState<number>(0);
  const [pedidoId, setPedidoId] = useState<string | null>(null);
  const [pagamento, setPagamento] = useState<DadosPagamento | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function confirmarConfiguracao(args: {
    modoCor: ModoCor;
    quantidadeCopias: number;
    valorCentavos: number;
  }) {
    if (!file) return;
    setEnviando(true);
    try {
      const tempId = crypto.randomUUID();
      const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
      const pdfPath = `${tempId}/${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("pdfs-impressao")
        .upload(pdfPath, file, { contentType: "application/pdf", upsert: false });
      if (uploadError) throw uploadError;

      // valor_centavos NÃO é enviado: o servidor (create-pix) é a autoridade
      // de preço, calculando a partir da contagem real de páginas do PDF.
      // num_paginas vai como estimativa do cliente, mas é reconferido no servidor.
      const { data: pedido, error: insertError } = await supabase
        .from("fila_impressao")
        .insert({
          pdf_path: pdfPath,
          num_paginas: numPaginas,
          quantidade_copias: args.quantidadeCopias,
          modo_cor: args.modoCor,
        })
        .select("id")
        .single();
      if (insertError) throw insertError;

      setPedidoId(pedido.id);

      const resp = await fetch("/api/payments/create-pix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedidoId: pedido.id }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error ?? "Falha ao gerar PIX");
      }
      const dados = (await resp.json()) as DadosPagamento;
      // Exibe o valor e a contagem autoritativos vindos do servidor.
      setValorCentavos(dados.valor_centavos);
      setNumPaginas(dados.num_paginas);
      setPagamento(dados);
      setPasso("PAGAMENTO");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="pt-24 pb-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto">
            {/* O Link precisa de linha própria: como elemento inline, dividiria
                a linha com o Badge e os textos se sobreporiam. */}
            <div className="mb-6">
              <Link
                href="/"
                className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar ao início
              </Link>
            </div>

            <Badge className="mb-4 bg-gradient-to-r from-titans-red to-titans-orange text-white">
              Serviço de Impressão
            </Badge>
            <h1 className="text-3xl md:text-5xl font-bold mb-2">
              <span className="bg-gradient-to-r from-titans-red to-titans-orange bg-clip-text text-transparent">
                Imprima seu PDF
              </span>
            </h1>
            <p className="text-muted-foreground mb-4">
              Envie o arquivo, escolha cor ou preto-e-branco, pague via PIX e retire na sede.
            </p>

            <StatusImpressora className="mb-4" />

            <BotaoOndeRetirar className="mb-8" />

            {passo === "UPLOAD" && (
              <UploadPDF
                itens={arquivos}
                onItensChange={setArquivos}
                onPDFPronto={({ file: f, numPaginas: n }) => {
                  setFile(f);
                  setNumPaginas(n);
                  setPasso("CONFIG");
                }}
              />
            )}

            {passo === "CONFIG" && (
              <ConfiguracaoImpressao
                numPaginas={numPaginas}
                numArquivos={arquivos.length}
                enviando={enviando}
                onConfirmar={confirmarConfiguracao}
                onVoltar={() => {
                  // Descarta o PDF final: se a lista mudar, a mesclagem é
                  // refeita ao concluir o upload de novo (nunca se envia um
                  // arquivo que não corresponde à lista atual).
                  setFile(null);
                  setNumPaginas(0);
                  setPasso("UPLOAD");
                }}
              />
            )}

            {passo === "PAGAMENTO" && pedidoId && pagamento && (
              <TelaPagamento
                pedidoId={pedidoId}
                qrCodeBase64={pagamento.qr_code_base64}
                qrCodeCopiaCola={pagamento.qr_code_copia_cola}
                expirationDateTo={pagamento.expiration_date_to}
                valorCentavos={valorCentavos}
                onPago={() => setPasso("SUCESSO")}
                onTimeout={() => setPasso("TIMEOUT")}
              />
            )}

            {passo === "SUCESSO" && pedidoId && <TelaSucesso pedidoId={pedidoId} />}

            {passo === "TIMEOUT" && (
              <Card>
                <CardContent className="p-8 text-center space-y-4">
                  <h2 className="text-2xl font-bold">Pagamento não confirmado</h2>
                  <p className="text-muted-foreground">
                    Não recebemos a confirmação do PIX em tempo hábil. Se você pagou,
                    aguarde alguns minutos e nos contate com o protocolo. Caso contrário,
                    inicie um novo pedido.
                  </p>
                  <Button asChild>
                    <Link href="/">Voltar ao início</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Impressao;
