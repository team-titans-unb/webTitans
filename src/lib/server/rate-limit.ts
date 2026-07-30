// Rate-limit simples em memória, por chave (ex.: IP). Não é distribuído —
// cada instância de função serverless mantém sua própria janela, e ela
// reinicia a cada cold start — mas soma-se à defesa em profundidade contra
// varredura de código de reimpressão junto com uso único, expiração de 24h e
// resposta genérica (ver design da change add-reimpressao-autorizada).
// Suficiente para este caso de uso: o totem é um único ponto físico de acesso,
// não um serviço público de alto tráfego.
const tentativasPorChave = new Map<string, number[]>();

export function excedeuLimite(chave: string, limite: number, janelaMs: number): boolean {
  const agora = Date.now();
  const tentativas = (tentativasPorChave.get(chave) ?? []).filter(
    (t) => agora - t < janelaMs
  );
  tentativas.push(agora);
  tentativasPorChave.set(chave, tentativas);
  return tentativas.length > limite;
}
