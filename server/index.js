require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const path         = require('path');
const TelegramBot  = require('node-telegram-bot-api');

const app   = express();
const PORT  = process.env.PORT || 3000;
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TOKEN || TOKEN === 'seu_token_aqui') {
  console.error('❌ TELEGRAM_BOT_TOKEN não definido no .env!');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

bot.getMe()
  .then(info => console.log(`✅ Bot: @${info.username}`))
  .catch(err => { console.error('❌ Token inválido:', err.message); process.exit(1); });

// Responde /start com Chat ID
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const name   = msg.from.first_name || 'você';
  bot.sendMessage(chatId, [
    `👋 Olá, ${name}!`,
    '',
    'Você foi cadastrado como contato de emergência no SafeCheck SOS.',
    '',
    '🔑 Seu Chat ID é:',
    `${chatId}`,
    '',
    'Copie esse número e envie para quem te cadastrou no app. ✅',
  ].join('\n'))
  .then(() => console.log(`✅ /start respondido — ${name} (${chatId})`))
  .catch(err => console.error('Erro /start:', err.message));
});

bot.onText(/\/id/, (msg) => {
  bot.sendMessage(msg.chat.id, `🔑 Seu Chat ID é: ${msg.chat.id}`);
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.get('/api/status',   (req, res) => res.json({ ok: true }));
app.get('/api/bot-info', async (req, res) => {
  try { res.json({ ok: true, bot: await bot.getMe() }); }
  catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// ---- Testa contato específico ----
app.post('/api/test-contact', async (req, res) => {
  const { chatId, name } = req.body;
  if (!chatId) return res.status(400).json({ ok: false, error: 'Chat ID não informado' });
  try {
    await bot.sendMessage(String(chatId).trim(), [
      '✅ Teste do SafeCheck SOS',
      '',
      `Você está cadastrado como contato de emergência.`,
      'Quando o SOS for ativado, você receberá um alerta aqui. 🛡️',
    ].join('\n'));
    res.json({ ok: true });
  } catch (err) {
    let tip = err.message;
    if (err.message.includes('chat not found')) tip = 'Chat ID inválido — contato precisa enviar /start para o bot primeiro';
    else if (err.message.includes('bot was blocked')) tip = 'Contato bloqueou o bot';
    res.status(400).json({ ok: false, error: err.message, tip });
  }
});

// ---- Alerta de emergência ----
app.post('/api/alert', async (req, res) => {
  const { contacts, location, userName } = req.body;
  console.log('\n🆘 ALERTA — usuária:', userName, '| contatos:', contacts?.length);

  if (!contacts?.length) return res.status(400).json({ ok: false, error: 'Nenhum contato' });

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
    if (!contact.telegramChatId) { results.push({ name: contact.name, ok: false, error: 'Sem Chat ID' }); continue; }
    const chatId = String(contact.telegramChatId).trim();
    try {
      await bot.sendMessage(chatId, message);
      if (location) await bot.sendLocation(chatId, parseFloat(location.lat), parseFloat(location.lng));
      results.push({ name: contact.name, ok: true });
      console.log(`   ✅ ${contact.name}`);
    } catch (err) {
      console.error(`   ❌ ${contact.name}:`, err.message);
      results.push({ name: contact.name, ok: false, error: err.message });
    }
  }

  const successCount = results.filter(r => r.ok).length;
  res.json({ ok: successCount > 0, successCount, results });
});

// ---- Atualização de localização em tempo real ----
app.post('/api/location-update', async (req, res) => {
  const { contacts, location, userName } = req.body;
  if (!contacts?.length || !location) return res.json({ ok: false });

  const message = [
    `📍 Localização atualizada — ${userName || 'Usuária'}`,
    `https://maps.google.com/?q=${location.lat},${location.lng}`,
    `🕐 ${new Date().toLocaleTimeString('pt-BR')}`,
  ].join('\n');

  for (const contact of contacts) {
    if (!contact.telegramChatId) continue;
    try {
      await bot.sendLocation(String(contact.telegramChatId).trim(), parseFloat(location.lat), parseFloat(location.lng));
      await bot.sendMessage(String(contact.telegramChatId).trim(), message);
    } catch (err) {
      console.error('Erro location-update:', err.message);
    }
  }

  res.json({ ok: true });
});

// ---- Cancelamento ----
app.post('/api/cancel', async (req, res) => {
  const { contacts, userName } = req.body;
  if (!contacts?.length) return res.json({ ok: false });
  const message = `✅ Alerta cancelado — ${userName || 'Usuária'} está segura. Obrigado! 💙`;
  for (const contact of contacts) {
    if (!contact.telegramChatId) continue;
    try { await bot.sendMessage(String(contact.telegramChatId).trim(), message); } catch {}
  }
  res.json({ ok: true });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

app.listen(PORT, () => {
  console.log(`\n🛡️  SafeCheck SOS: http://localhost:${PORT}`);
  console.log('📨 Bot escutando mensagens\n');
});
