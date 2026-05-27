import * as pdfjsLib from "pdfjs-dist";
// Vite resolve o worker para uma URL servível no bundle.
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export const MAX_PDF_BYTES = 50 * 1024 * 1024; // 50 MB

export type ValidacaoPDF =
  | { ok: true }
  | { ok: false; mensagem: string };

export function validarArquivoPDF(file: File): ValidacaoPDF {
  if (file.type !== "application/pdf") {
    return { ok: false, mensagem: "Apenas arquivos PDF são aceitos." };
  }
  if (file.size > MAX_PDF_BYTES) {
    return { ok: false, mensagem: "Arquivo excede o limite de 50 MB." };
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
