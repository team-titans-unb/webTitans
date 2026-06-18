import { MercadoPagoConfig, Payment } from "mercadopago";

// Inicialização preguiçosa: o `next build` importa este módulo ao coletar os
// dados das rotas, mas MERCADOPAGO_ACCESS_TOKEN só existe em runtime. Validar/
// instanciar no primeiro uso (request) evita quebrar o build no CI.
let client: MercadoPagoConfig | null = null;
let payment: Payment | null = null;

function getClient(): MercadoPagoConfig {
  if (client) return client;

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN precisa estar definido nas envs da Vercel");
  }

  client = new MercadoPagoConfig({ accessToken });
  return client;
}

// Proxy mantém a API `mpPayment.get(...)` / `mpPayment.create(...)` sem
// instanciar o client até o primeiro acesso.
export const mpPayment = new Proxy({} as Payment, {
  get(_target, prop, receiver) {
    payment ??= new Payment(getClient());
    const value = Reflect.get(payment, prop, receiver);
    return typeof value === "function" ? value.bind(payment) : value;
  },
});
