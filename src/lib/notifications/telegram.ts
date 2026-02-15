
// src/lib/notifications/telegram.ts
export async function sendTelegramMessage(message: string) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        console.warn('[Telegram] No se enviará mensaje: Faltan TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID en .env');
        return;
    }

    try {
        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'Markdown'
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('[Telegram] Error al enviar mensaje:', errorData);
        }
    } catch (error) {
        console.error('[Telegram] Error de red:', error);
    }
}
