import crypto from "node:crypto";

type Headers = Record<string, string | string[] | undefined>;

function header(headers: Headers, name: string): string | undefined {
  const v = headers[name.toLowerCase()] ?? headers[name];
  return Array.isArray(v) ? v[0] : v;
}

const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutos (anti-replay)

export type ResultadoAssinatura = { ok: boolean; reason?: string };

/**
 * Valida assinatura do webhook do Mercado Pago.
 * Formato do header `x-signature`: "ts=<unix-ts>,v1=<hmac-sha256-hex>"
 * Manifest assinado: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 * O MP pode enviar `ts` em segundos (10 dígitos) ou em ms (13) — normalizamos.
 */
export function verificarAssinaturaMP(args: {
  headers: Headers;
  dataId: string;
  secret: string;
}): ResultadoAssinatura {
  const { headers, dataId, secret } = args;

  const xSignature = header(headers, "x-signature");
  const xRequestId = header(headers, "x-request-id");
  if (!xSignature) return { ok: false, reason: "sem x-signature" };
  if (!xRequestId) return { ok: false, reason: "sem x-request-id" };

  const parts = xSignature.split(",").reduce<Record<string, string>>((acc, part) => {
    const idx = part.indexOf("=");
    if (idx > 0) {
      acc[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
    }
    return acc;
  }, {});

  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return { ok: false, reason: "x-signature sem ts/v1" };

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return { ok: false, reason: "ts não numérico" };
  const tsMs = tsNum < 1e12 ? tsNum * 1000 : tsNum;
  const ageMs = Math.abs(Date.now() - tsMs);
  if (ageMs > MAX_AGE_MS) {
    return { ok: false, reason: `ts fora da janela (${Math.round(ageMs / 1000)}s)` };
  }

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

  let match = false;
  try {
    match = crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(v1, "hex"));
  } catch {
    return { ok: false, reason: "v1 malformado" };
  }
  return match ? { ok: true } : { ok: false, reason: "hash não confere" };
}
