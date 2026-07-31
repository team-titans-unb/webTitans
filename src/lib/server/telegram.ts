const TELEGRAM_TIMEOUT_MS = 3000;

// Envio de mensagem via Bot API do Telegram (sendMessage). Sempre best-effort
// — nunca lança; quem chama decide se a falha deve ou não impedir a operação
// principal (ex.: uma reimpressão já efetivada não é desfeita por falha de
// notificação). Usado tanto pelos chamados de ajuda do kiosk quanto pelo
// núcleo de reimpressão e pelas respostas do bot no webhook.
export async function enviarMensagemTelegram(args: {
  chatId: string;
  texto: string;
}): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: args.chatId, text: args.texto }),
      signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error("Telegram sendMessage falhou:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("Falha ao enviar mensagem ao Telegram:", err);
    return false;
  }
}
