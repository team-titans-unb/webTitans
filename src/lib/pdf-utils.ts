import * as pdfjsLib from "pdfjs-dist";
import { PDFDocument } from "pdf-lib";

// O worker é servido como asset estático de public/pdf.worker.min.mjs, copiado
// no postinstall/prebuild a partir da própria dep (versão sempre sincronizada,
// evitando o mismatch "API version vs Worker version"). Roda em client component.
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

// 30 MB: alinhado ao file_size_limit do bucket pdfs-impressao e ao teto que o
// create-pix consegue baixar e contar dentro do limite de ~10s da Vercel. Vale
// por arquivo na seleção E para o PDF final do pedido — mesclar não contorna o
// teto, já que o objeto enviado ao Storage é um só.
export const MAX_PDF_BYTES = 30 * 1024 * 1024; // 30 MB

// Teto de arquivos por pedido: limita o pico de memória da mesclagem no
// navegador (o dispositivo real do fluxo /impressao é um celular) e mantém a
// lista legível na tela.
export const MAX_ARQUIVOS_POR_PEDIDO = 10;

// Shape uniforme (ok + mensagem opcional) em vez de união discriminada: o
// tsconfig da main roda com strictNullChecks=false, sob o qual o estreitamento
// por literal booleano de uma união falha. O comportamento é idêntico.
export type ValidacaoPDF = { ok: boolean; mensagem?: string };

export function validarArquivoPDF(file: File): ValidacaoPDF {
  if (file.type !== "application/pdf") {
    return { ok: false, mensagem: "Apenas arquivos PDF são aceitos." };
  }
  if (file.size > MAX_PDF_BYTES) {
    return { ok: false, mensagem: "Arquivo excede o limite de 30 MB." };
  }
  return { ok: true };
}

export async function contarPaginas(file: File): Promise<number> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const total = pdf.numPages;
  await pdf.destroy();
  return total;
}

// Um arquivo da lista do pedido. `paginas` é null enquanto o pdfjs ainda está
// contando; o avanço para a configuração exige todos contados.
export type ArquivoSelecionado = {
  id: string;
  file: File;
  paginas: number | null;
};

export type MotivoRecusa = "TIPO" | "TAMANHO" | "DUPLICADO" | "LIMITE";

export type ArquivoRecusado = {
  file: File;
  motivo: MotivoRecusa;
  mensagem: string;
};

export type ResultadoSelecao = {
  aceitos: File[];
  recusados: ArquivoRecusado[];
};

// Dois arquivos são o mesmo para efeito de seleção quando têm o mesmo nome e o
// mesmo tamanho — o que o navegador expõe sem ler o conteúdo. Evita o engano
// clássico de escolher o mesmo PDF duas vezes em seleções sucessivas.
function mesmoArquivo(a: File, b: File): boolean {
  return a.name === b.name && a.size === b.size;
}

// Valida uma leva de arquivos contra os já escolhidos, separando aceitos de
// recusados com o motivo de cada recusa. Nunca lança: um arquivo ruim no meio
// da seleção não pode derrubar os bons (spec: "Seleção mista de válidos e
// inválidos").
export function validarSelecao(
  novos: File[],
  jaSelecionados: File[]
): ResultadoSelecao {
  const aceitos: File[] = [];
  const recusados: ArquivoRecusado[] = [];

  for (const file of novos) {
    const validacao = validarArquivoPDF(file);
    if (!validacao.ok) {
      recusados.push({
        file,
        motivo: file.type !== "application/pdf" ? "TIPO" : "TAMANHO",
        mensagem: `"${file.name}": ${validacao.mensagem}`,
      });
      continue;
    }
    const jaEsta =
      jaSelecionados.some((existente) => mesmoArquivo(existente, file)) ||
      aceitos.some((existente) => mesmoArquivo(existente, file));
    if (jaEsta) {
      recusados.push({
        file,
        motivo: "DUPLICADO",
        mensagem: `"${file.name}" já foi adicionado.`,
      });
      continue;
    }
    if (jaSelecionados.length + aceitos.length >= MAX_ARQUIVOS_POR_PEDIDO) {
      recusados.push({
        file,
        motivo: "LIMITE",
        mensagem: `Máximo de ${MAX_ARQUIVOS_POR_PEDIDO} arquivos por pedido — "${file.name}" não foi adicionado.`,
      });
      continue;
    }
    aceitos.push(file);
  }

  return { aceitos, recusados };
}

// Falha de mesclagem que carrega o arquivo culpado: o cliente precisa saber
// QUAL PDF remover, sem perder o resto da seleção.
export class ErroMesclagemPDF extends Error {
  readonly nomeArquivo: string;

  constructor(nomeArquivo: string) {
    super(
      `Não foi possível processar "${nomeArquivo}". Remova esse arquivo e tente de novo.`
    );
    this.name = "ErroMesclagemPDF";
    this.nomeArquivo = nomeArquivo;
  }
}

// Nome do objeto que vai para o Storage. Com um arquivo, preserva o nome
// original (comportamento atual); com vários, denuncia a natureza do pedido —
// pdf_path aparece nos logs do worker e nas consultas de operação.
export function nomeDoArquivoDoPedido(files: File[]): string {
  if (files.length === 1) return files[0].name;
  return `pedido-${files.length}-arquivos.pdf`;
}

// Concatena os PDFs na ordem recebida, no próprio navegador, devolvendo um
// único File. Chamada apenas com 2+ arquivos: o pedido de arquivo único envia o
// original byte a byte, sem passar por reescrita (decisão D2 do design).
export async function mesclarPDFs(files: File[]): Promise<File> {
  if (files.length === 1) return files[0];

  const destino = await PDFDocument.create();
  for (const file of files) {
    try {
      // Sem ignoreEncryption: PDF protegido falha aqui, nomeando o arquivo —
      // a mesma recusa que o create-pix já faria depois, mas antes de cobrar.
      const origem = await PDFDocument.load(await file.arrayBuffer());
      const paginas = await destino.copyPages(origem, origem.getPageIndices());
      for (const pagina of paginas) destino.addPage(pagina);
    } catch {
      throw new ErroMesclagemPDF(file.name);
    }
  }

  const bytes = await destino.save();
  return new File([bytes], nomeDoArquivoDoPedido(files), {
    type: "application/pdf",
  });
}
