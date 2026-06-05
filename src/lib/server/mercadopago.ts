import { MercadoPagoConfig, Payment } from "mercadopago";

const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
if (!accessToken) {
  throw new Error("MERCADOPAGO_ACCESS_TOKEN precisa estar definido nas envs da Vercel");
}

export const mpClient = new MercadoPagoConfig({ accessToken });
export const mpPayment = new Payment(mpClient);
