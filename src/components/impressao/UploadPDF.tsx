"use client";

import { useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText } from "lucide-react";
import { toast } from "sonner";
import { validarArquivoPDF, contarPaginas } from "@/lib/pdf-utils";

type Props = {
  onPDFPronto: (args: { file: File; numPaginas: number }) => void;
};

function formatarTamanho(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function UploadPDF({ onPDFPronto }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [paginas, setPaginas] = useState<number | null>(null);

  async function processarArquivo(file: File) {
    const validacao = validarArquivoPDF(file);
    if (!validacao.ok) {
      toast.error(validacao.mensagem);
      return;
    }
    setArquivo(file);
    setPaginas(null);
    setAnalisando(true);
    try {
      const num = await contarPaginas(file);
      setPaginas(num);
    } catch {
      toast.error("Não foi possível ler este PDF.");
      setArquivo(null);
    } finally {
      setAnalisando(false);
    }
  }

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void processarArquivo(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) void processarArquivo(file);
  }

  function avancar() {
    if (arquivo && paginas) {
      onPDFPronto({ file: arquivo, numPaginas: paginas });
    }
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div
          className="border-2 border-dashed border-border rounded-lg p-10 text-center hover:border-titans-orange/60 transition-colors cursor-pointer"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleSelect}
          />
          {!arquivo ? (
            <>
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
              <p className="font-medium">Clique ou arraste seu PDF aqui</p>
              <p className="text-sm text-muted-foreground mt-1">Máximo 30 MB</p>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <FileText className="h-10 w-10 text-titans-orange" />
              <p className="font-medium break-all">{arquivo.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatarTamanho(arquivo.size)}
                {paginas !== null && ` · ${paginas} página${paginas === 1 ? "" : "s"}`}
                {analisando && " · analisando…"}
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={avancar} disabled={!arquivo || analisando || paginas === null}>
            Continuar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
