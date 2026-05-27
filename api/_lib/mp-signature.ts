import crypto from "node:crypto";

type Headers = Record<string, string | string[] | undefined>;

function header(headers: Headers, name: string): string | undefined {
  const v = headers[name.toLowerCase()] ?? headers[name];
  return Array.isArray(v) ? v[0] : v;
}

const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutos (anti-replay)

/**
 * Valida assinatura do webhook do Mercado Pago.
 * Formato do header `x-signature`: "ts=<unix-ts>,v1=<hmac-sha256-hex>"
 * Manifest assinado: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 */
export function verificarAssinaturaMP(args: {
  headers: Headers;
  dataId: string;
  secret: string;
}): boolean {
  const { headers, dataId, secret } = args;

  const xSignature = header(headers, "x-signature");
  const xRequestId = header(headers, "x-request-id");
  if (!xSignature || !xRequestId) return false;

  const parts = xSignature.split(",").reduce<Record<string, string>>((acc, part) => {
    const [k, v] = part.split("=").map((s) => s.trim());
    if (k && v) acc[k] = v;
    return acc;
  }, {});

  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return false;
  const ageMs = Date.now() - tsNum;
  if (ageMs > MAX_AGE_MS || ageMs < -MAX_AGE_MS) return false;

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(v1, "hex"));
  } catch {
    return false;
  }
}
