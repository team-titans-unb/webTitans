// Protocolo público do pedido: os 8 primeiros caracteres do UUID em maiúsculas.
// É a identidade que o cliente vê (em TelaSucesso e no kiosk); o UUID completo
// funciona como token de leitura do pedido e nunca é exposto.
export function protocoloDoPedido(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

// Formato válido de protocolo: 8 caracteres hexadecimais. Entrada do usuário
// pode vir em qualquer caixa; protocoloDoPedido sempre produz maiúsculas.
export const PROTOCOLO_RE = /^[0-9a-fA-F]{8}$/;

// O protocolo são os 8 primeiros hex do UUID (primeiro grupo inteiro), então
// ele define um intervalo fechado de UUIDs — a comparação de uuid no Postgres
// é byte a byte. Evita RPC/cast: PostgREST não filtra `like` em coluna uuid.
// Compartilhado por toda consulta/ação que resolve um protocolo a um pedido
// (kiosk e núcleo de reimpressão) para nunca duplicar essa regra.
export function intervaloDoProtocolo(protocolo: string): { de: string; ate: string } {
  const p = protocolo.toLowerCase();
  return {
    de: `${p}-0000-0000-0000-000000000000`,
    ate: `${p}-ffff-ffff-ffff-ffffffffffff`,
  };
}
