require('dotenv').config();

/**
 * Serviço para envio automático de notificações via Telegram Bot
 */
async function sendTelegramNotification(appointmentData) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || appointmentData.telegram_bot_token;
  const chatId = process.env.TELEGRAM_CHAT_ID || appointmentData.telegram_chat_id;

  if (!botToken || !chatId || botToken === 'SEU_TELEGRAM_BOT_TOKEN') {
    console.log('ℹ Telegram Bot Token ou Chat ID não configurado no .env. Notificação via Telegram ignorada.');
    return false;
  }

  const {
    studio_name = 'Eduarda Souza Estética',
    client_name,
    client_phone,
    service_name,
    date,
    start_time,
    end_time,
    price,
    notes
  } = appointmentData;

  // Formatação amigável da data (DD/MM/AAAA)
  let formattedDate = date;
  if (date && date.includes('-')) {
    const [y, m, d] = date.split('-');
    formattedDate = `${d}/${m}/${y}`;
  }

  const formattedPrice = typeof price === 'number'
    ? price.toFixed(2).replace('.', ',')
    : parseFloat(price || 0).toFixed(2).replace('.', ',');

  const message = 
`🔔 <b>NOVO AGENDAMENTO RECEBIDO!</b> 🔔

🏢 <b>Estúdio:</b> ${escapeHtml(studio_name)}
👤 <b>Cliente:</b> ${escapeHtml(client_name)}
📱 <b>WhatsApp:</b> ${escapeHtml(client_phone)}
✨ <b>Procedimento:</b> ${escapeHtml(service_name)}
📅 <b>Data:</b> ${formattedDate}
⏰ <b>Horário:</b> ${start_time} ${end_time ? `às ${end_time}` : ''}
💰 <b>Valor:</b> R$ ${formattedPrice}
${notes ? `📝 <b>Observação:</b> ${escapeHtml(notes)}` : ''}`;

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      })
    });

    const result = await response.json();
    if (result.ok) {
      console.log('✅ Notificação enviada com sucesso para o Telegram da profissional!');
      return true;
    } else {
      console.error('❌ Erro da API do Telegram:', result.description);
      return false;
    }
  } catch (err) {
    console.error('❌ Erro de conexão ao enviar notificação para o Telegram:', err.message);
    return false;
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

module.exports = {
  sendTelegramNotification
};
