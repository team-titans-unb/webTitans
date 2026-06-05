import * as pdfjsLib from "pdfjs-dist";

// O worker é servido como asset estático de public/pdf.worker.min.mjs, copiado
// no postinstall/prebuild a partir da própria dep (versão sempre sincronizada,
// evitando o mismatch "API version vs Worker version"). Roda em client component.
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

// 30 MB: alinhado ao file_size_limit do bucket pdfs-impressao e ao teto que o
// create-pix consegue baixar e contar dentro do limite de ~10s da Vercel.
export const MAX_PDF_BYTES = 30 * 1024 * 1024; // 30 MB

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
