// Copia o worker do pdfjs-dist para public/, mantendo a versão do asset servido
// sincronizada com a dependência instalada. Roda no postinstall e no prebuild,
// garantindo o asset tanto em dev/Vercel quanto no estágio de build do Docker.
import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const projectRoot = dirname(fileURLToPath(import.meta.url)) + "/..";

const workerSource = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
const publicDir = join(projectRoot, "public");
const workerTarget = join(publicDir, "pdf.worker.min.mjs");

await mkdir(publicDir, { recursive: true });
await copyFile(workerSource, workerTarget);

const { version } = require("pdfjs-dist/package.json");
console.log(`pdf.worker.min.mjs copiado para public/ (pdfjs-dist ${version})`);
