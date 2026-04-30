require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const path        = require('path');
const TelegramBot = require('node-telegram-bot-api');

const app   = express();
const PORT  = process.env.PORT || 3000;
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TOKEN || TOKEN === 'seu_token_aqui') {
  console.error('❌ ERRO: TELEGRAM_BOT_TOKEN não definido no .env!');
  process.exit(1);
}

console.log('🤖 Iniciando bot...');

// polling: true — faz o bot ESCUTAR mensagens
const bot = new TelegramBot(TOKEN, { polling: true });

bot.getMe()
  .then(info => console.log(`✅ Bot conectado: @${info.username}`))
  .catch(err => { console.error('❌ Token inválido:', err.message); process.exit(1); });

// ---- Responde /start com o Chat ID ----
bot.onText(/\/start/, (msg) => {
  const chatId    = msg.chat.id;
  const firstName = msg.from.first_name || 'você';

  const resposta = [
    `👋 Olá, ${firstName}!`,
    '',
    'Você foi cadastrado como contato de emergência no SafeCheck SOS.',
    '',
    '🔑 Seu Chat ID é:',
    `${chatId}`,
    '',
    'Copie esse número e envie para quem te cadastrou no app.',
    'Após isso, você receberá alertas de emergência automaticamente. ✅',
  ].join('\n');

  bot.sendMessage(chatId, resposta)
    .then(() => console.log(`✅ /start respondido para ${firstName} — Chat ID: ${chatId}`))
    .catch(err => console.error('Erro ao responder /start:', err.message));
});

// ---- Responde /id ----
bot.onText(/\/id/, (msg) => {
  bot.sendMessage(msg.chat.id, `🔑 Seu Chat ID é: ${msg.chat.id}`);
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.get('/api/status', (req, res) => res.json({ ok: true }));

app.get('/api/bot-info', async (req, res) => {
  try {
    const info = await bot.getMe();
    res.json({ ok: true, bot: info });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/alert', async (req, res) => {
  const { contacts, location, userName } = req.body;
  console.log('\n🆘 ALERTA — usuária:', userName, '| contatos:', contacts?.length);

  if (!contacts || contacts.length === 0)
    return res.status(400).json({ ok: false, error: 'Nenhum contato' });

  const locationLine = location
    ? `📍 Localização: https://maps.google.com/?q=${location.lat},${location.lng}`
    : '📍 Localização não disponível';

  const message = [
    '🆘 ALERTA DE EMERGÊNCIA — SafeCheck SOS',
    '',
    `⚠️ ${userName || 'Usuária'} ativou o botão de emergência!`,
    '',
    locationLine,
    '',
    '🎙️ Gravação de áudio iniciada.',
    '🔴 Entre em contato agora ou acione as autoridades.',
    '',
    '📞 190 (Polícia) | 192 (SAMU) | 180 (Central da Mulher)',
  ].join('\n');

  const results = [];

  for (const contact of contacts) {
    if (!contact.telegramChatId) {
      results.push({ name: contact.name, ok: false, error: 'Sem Chat ID' });
      continue;
    }
    const chatId = String(contact.telegramChatId).trim();
    console.log(`   📤 Enviando para ${contact.name} (${chatId})...`);
    try {
      await bot.sendMessage(chatId, message);
      if (location) await bot.sendLocation(chatId, location.lat, location.lng);
      results.push({ name: contact.name, ok: true });
      console.log(`   ✅ Enviado para ${contact.name}`);
    } catch (err) {
      console.error(`   ❌ Erro ${contact.name}:`, err.message);
      results.push({ name: contact.name, ok: false, error: err.message });
    }
  }

  const successCount = results.filter(r => r.ok).length;
  res.json({ ok: successCount > 0, successCount, results });
});

app.post('/api/cancel', async (req, res) => {
  const { contacts, userName } = req.body;
  const message = `✅ Alerta cancelado — ${userName || 'Usuária'} está segura. Obrigado! 💙`;

  for (const contact of contacts) {
    if (!contact.telegramChatId) continue;
    try {
      await bot.sendMessage(String(contact.telegramChatId).trim(), message);
    } catch (err) {
      console.error('Erro cancelamento:', err.message);
    }
  }
  res.json({ ok: true });
});

app.get('*', (req, res) =>
  res.sendFile(path.join(__dirname, '../public/index.html')));

app.listen(PORT, () => {
  console.log(`\n🛡️  SafeCheck SOS: http://localhost:${PORT}`);
  console.log('📨 Bot escutando mensagens (polling ativo)\n');
});