"use client";

import { useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowUp, FileText, Upload, X } from "lucide-react";
import { toast } from "sonner";
import {
  contarPaginas,
  mesclarPDFs,
  validarSelecao,
  ErroMesclagemPDF,
  MAX_ARQUIVOS_POR_PEDIDO,
  MAX_PDF_BYTES,
  type ArquivoSelecionado,
} from "@/lib/pdf-utils";

type Props = {
  // A lista vive na página: assim ela sobrevive ao ir e voltar entre os passos
  // (o arquivo mesclado, esse sim, é descartado ao voltar).
  itens: ArquivoSelecionado[];
  onItensChange: Dispatch<SetStateAction<ArquivoSelecionado[]>>;
  onPDFPronto: (args: { file: File; numPaginas: number }) => void;
};

function formatarTamanho(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function plural(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

export function UploadPDF({ itens, onItensChange, onPDFPronto }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [analisando, setAnalisando] = useState(false);
  const [preparando, setPreparando] = useState(false);

  const totalPaginas = itens.reduce((soma, item) => soma + (item.paginas ?? 0), 0);
  const todosContados = itens.every((item) => item.paginas !== null);
  const ocupado = analisando || preparando;

  async function adicionarArquivos(novos: File[]) {
    if (novos.length === 0) return;

    const { aceitos, recusados } = validarSelecao(
      novos,
      itens.map((item) => item.file)
    );
    for (const recusa of recusados) toast.error(recusa.mensagem);
    if (aceitos.length === 0) return;

    const entradas: ArquivoSelecionado[] = aceitos.map((file) => ({
      id: crypto.randomUUID(),
      file,
      paginas: null,
    }));
    onItensChange((atuais) => [...atuais, ...entradas]);

    // Conta um por vez: cada PDF sobe para a memória do navegador durante a
    // leitura, e em paralelo isso derrubaria celulares mais fracos.
    setAnalisando(true);
    try {
      for (const entrada of entradas) {
        try {
          const paginas = await contarPaginas(entrada.file);
          onItensChange((atuais) =>
            atuais.map((item) =>
              item.id === entrada.id ? { ...item, paginas } : item
            )
          );
        } catch {
          toast.error(`Não foi possível ler "${entrada.file.name}".`);
          onItensChange((atuais) => atuais.filter((item) => item.id !== entrada.id));
        }
      }
    } finally {
      setAnalisando(false);
    }
  }

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    // Zera o input: sem isso, reescolher o mesmo arquivo depois de removê-lo da
    // lista não dispara `change` (o value não mudou).
    e.target.value = "";
    void adicionarArquivos(files);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    void adicionarArquivos(Array.from(e.dataTransfer.files ?? []));
  }

  function remover(id: string) {
    onItensChange((atuais) => atuais.filter((item) => item.id !== id));
  }

  function mover(indice: number, direcao: -1 | 1) {
    const destino = indice + direcao;
    onItensChange((atuais) => {
      if (destino < 0 || destino >= atuais.length) return atuais;
      const copia = [...atuais];
      [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
      return copia;
    });
  }

  async function avancar() {
    if (itens.length === 0 || !todosContados || ocupado) return;
    const files = itens.map((item) => item.file);

    // Arquivo único: envia o original, byte a byte, sem passar pela mesclagem.
    if (files.length === 1) {
      onPDFPronto({ file: files[0], numPaginas: totalPaginas });
      return;
    }

    setPreparando(true);
    try {
      const mesclado = await mesclarPDFs(files);

      if (mesclado.size > MAX_PDF_BYTES) {
        toast.error(
          `O PDF do pedido ficou com ${formatarTamanho(mesclado.size)} e o limite é 30 MB. Remova ou divida arquivos.`
        );
        return;
      }

      // Reconferência local: num_paginas divergente do PDF real é o que faz o
      // worker mandar o pedido para ERRO — depois de pago. Barrar aqui troca
      // uma falha pós-pagamento por uma mensagem antes de cobrar.
      const paginasMescladas = await contarPaginas(mesclado);
      if (paginasMescladas !== totalPaginas) {
        toast.error(
          "A junção dos arquivos não conferiu. Remova um arquivo e tente novamente."
        );
        return;
      }

      onPDFPronto({ file: mesclado, numPaginas: paginasMescladas });
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof ErroMesclagemPDF
          ? err.message
          : "Não foi possível juntar os arquivos. Tente novamente."
      );
    } finally {
      setPreparando(false);
    }
  }

  const vazio = itens.length === 0;

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div
          className={`border-2 border-dashed border-border rounded-lg text-center hover:border-titans-orange/60 transition-colors cursor-pointer ${
            vazio ? "p-10" : "p-6"
          }`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            multiple
            className="hidden"
            onChange={handleSelect}
          />
          <Upload
            className={`mx-auto text-muted-foreground ${vazio ? "h-12 w-12 mb-3" : "h-8 w-8 mb-2"}`}
          />
          <p className="font-medium">
            {vazio
              ? "Clique ou arraste seus PDFs aqui"
              : "Adicionar mais arquivos"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Até {MAX_ARQUIVOS_POR_PEDIDO} arquivos · 30 MB cada
          </p>
        </div>

        {!vazio && (
          <ul className="space-y-2">
            {itens.map((item, indice) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-lg border border-border p-3"
              >
                <FileText className="h-5 w-5 shrink-0 text-titans-orange" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium break-all">{item.file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatarTamanho(item.file.size)}
                    {item.paginas === null
                      ? " · analisando…"
                      : ` · ${plural(item.paginas, "página", "páginas")}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Mover "${item.file.name}" para cima`}
                    disabled={indice === 0 || ocupado}
                    onClick={() => mover(indice, -1)}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Mover "${item.file.name}" para baixo`}
                    disabled={indice === itens.length - 1 || ocupado}
                    onClick={() => mover(indice, 1)}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remover "${item.file.name}"`}
                    disabled={ocupado}
                    onClick={() => remover(item.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {!vazio && (
          <div className="flex items-baseline justify-between border-t border-border pt-4 text-sm">
            <span className="text-muted-foreground">
              {plural(itens.length, "arquivo", "arquivos")}
            </span>
            <span className="font-medium">
              {todosContados
                ? `${plural(totalPaginas, "página", "páginas")} no total`
                : "calculando total…"}
            </span>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={avancar} disabled={vazio || !todosContados || ocupado}>
            {preparando ? "Preparando arquivo…" : "Continuar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
