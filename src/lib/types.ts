export type ModoCor = "PB" | "COLORIDO";

export type StatusPedido =
  | "AGUARDANDO_PAGAMENTO"
  | "PAGO"
  | "IMPRESSO"
  | "ERRO"
  | "CANCELADO";

export type Pedido = {
  id: string;
  created_at: string;
  pdf_path: string;
  num_paginas: number;
  modo_cor: ModoCor;
  valor_centavos: number;
  status: StatusPedido;
  mp_payment_id: string | null;
  mp_preference_id: string | null;
  paid_at: string | null;
  printed_at: string | null;
};

export type Precos = Record<ModoCor, number>;
