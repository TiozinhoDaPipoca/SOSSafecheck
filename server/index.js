// =============================================
// SafeCheck SOS — server/index.js
// =============================================

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

// ---- Bot com polling ativado (escuta mensagens) ----
const bot = new TelegramBot(TOKEN, { polling: true });

bot.getMe()
  .then(info => console.log(`✅ Bot conectado: @${info.username}`))
  .catch(err => {
    console.error('❌ Token inválido:', err.message);
    process.exit(1);
  });

// ---- Responde ao /start com o Chat ID ----
bot.onText(/\/start/, (msg) => {
  const chatId   = msg.chat.id;
  const firstName = msg.from.first_name || 'você';

  const resposta = [
    `👋 Olá, ${firstName}!`,
    '',
    'Você foi cadastrado como contato de emergência no *SafeCheck SOS*.',
    '',
    '🔑 *Seu Chat ID é:*',
    `\`${chatId}\``,
    '',
    'Copie esse número e envie para quem te cadastrou no app.',
    'Ele precisa colocar esse número no campo *"Telegram Chat ID"* do seu contato.',
    '',
    '✅ Depois disso, você receberá alertas de emergência automaticamente.',
  ].join('\n');

  bot.sendMessage(chatId, resposta, { parse_mode: 'Markdown' })
    .then(() => console.log(`✅ /start respondido para ${firstName} (Chat ID: ${chatId})`))
    .catch(err => console.error('Erro ao responder /start:', err.message));
});

// ---- Responde ao /id (alternativa) ----
bot.onText(/\/id/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `🔑 Seu Chat ID é: \`${chatId}\``, { parse_mode: 'Markdown' });
});

// ---- Middlewares ----
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// =============================================
// ROTAS DA API
// =============================================

app.get('/api/status', (req, res) => {
  res.json({ ok: true, message: 'SafeCheck SOS online ✅' });
});

app.get('/api/bot-info', async (req, res) => {
  try {
    const info = await bot.getMe();
    res.json({ ok: true, bot: info });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---- Testa envio para um contato específico ----
app.post('/api/test-contact', async (req, res) => {
  const { chatId, name } = req.body;
  console.log(`\n🧪 TESTE para ${name} (${chatId})`);

  if (!chatId) return res.status(400).json({ ok: false, error: 'Chat ID não informado' });

  const message = [
    '✅ Teste do SafeCheck SOS',
    '',
    `Olá! Você está cadastrado como contato de emergência de ${name || 'uma usuária'}.`,
    '',
    'Quando ela acionar o botão SOS, você receberá um alerta aqui. 🛡️',
  ].join('\n');

  try {
    await bot.sendMessage(String(chatId).trim(), message);
    console.log(`   ✅ Teste enviado para ${name}`);
    res.json({ ok: true });
  } catch (err) {
    console.error(`   ❌ Erro no teste:`, err.message);
    let tip = err.message;
    if (err.message.includes('chat not found')) {
      tip = 'Chat ID inválido — o contato precisa enviar /start para o @Heloale_bot primeiro';
    } else if (err.message.includes('bot was blocked')) {
      tip = 'O contato bloqueou o bot — peça para desbloquear';
    }
    res.status(400).json({ ok: false, error: err.message, tip });
  }
});

// ---- Envia alerta de emergência ----
app.post('/api/alert', async (req, res) => {
  const { contacts, location, userName } = req.body;

  console.log('\n🆘 ALERTA RECEBIDO');
  console.log('   Usuária:', userName);
  console.log('   Contatos:', contacts?.length);
  console.log('   Localização:', location);

  if (!contacts || contacts.length === 0) {
    return res.status(400).json({ ok: false, error: 'Nenhum contato informado' });
  }

  const locationLine = location
    ? `📍 Localização atual: https://maps.google.com/?q=${location.lat},${location.lng}`
    : '📍 Localização não disponível';

  const message = [
    '🆘 ALERTA DE EMERGÊNCIA — SafeCheck SOS',
    '',
    `⚠️ ${userName || 'Usuária'} ativou o botão de emergência!`,
    '',
    locationLine,
    '',
    '🎙️ Gravação de áudio iniciada automaticamente.',
    '',
    '🔴 Se ela estiver em perigo, entre em contato agora ou acione as autoridades.',
    '',
    '📞 190 (Polícia) | 192 (SAMU) | 180 (Central da Mulher)',
  ].join('\n');

  const results = [];

  for (const contact of contacts) {
    if (!contact.telegramChatId) {
      console.log(`   ⚠️  ${contact.name}: sem Chat ID`);
      results.push({ name: contact.name, ok: false, error: 'Chat ID não configurado' });
      continue;
    }

    const chatId = String(contact.telegramChatId).trim();
    console.log(`   📤 Enviando para ${contact.name} (${chatId})...`);

    try {
      await bot.sendMessage(chatId, message);
      console.log(`   ✅ Mensagem enviada para ${contact.name}`);

      if (location) {
        await bot.sendLocation(chatId, location.lat, location.lng);
        console.log(`   ✅ Localização enviada para ${contact.name}`);
      }

      results.push({ name: contact.name, ok: true });

    } catch (err) {
      console.error(`   ❌ Erro com ${contact.name}:`, err.message);

      let errorMsg = err.message;
      if (err.message.includes('chat not found')) {
        errorMsg = 'Chat ID inválido — contato precisa enviar /start para o bot';
      } else if (err.message.includes('bot was blocked')) {
        errorMsg = 'Contato bloqueou o bot';
      }

      results.push({ name: contact.name, ok: false, error: errorMsg });
    }
  }

  const successCount = results.filter(r => r.ok).length;
  console.log(`\n   ✅ ${successCount}/${contacts.length} enviados\n`);

  res.json({ ok: successCount > 0, successCount, totalContacts: contacts.length, results });
});

// ---- Cancela alerta ----
app.post('/api/cancel', async (req, res) => {
  const { contacts, userName } = req.body;
  console.log('\n✅ CANCELAMENTO — usuária:', userName);

  if (!contacts || contacts.length === 0) {
    return res.status(400).json({ ok: false, error: 'Nenhum contato informado' });
  }

  const message = [
    '✅ Alerta cancelado — SafeCheck SOS',
    '',
    `${userName || 'Usuária'} está segura e cancelou o alerta.`,
    '',
    'Nenhuma ação necessária. Obrigado por estar disponível! 💙',
  ].join('\n');

  const results = [];

  for (const contact of contacts) {
    if (!contact.telegramChatId) {
      results.push({ name: contact.name, ok: false, error: 'Sem Chat ID' });
      continue;
    }
    try {
      await bot.sendMessage(String(contact.telegramChatId).trim(), message);
      results.push({ name: contact.name, ok: true });
      console.log(`   ✅ Cancelamento enviado para ${contact.name}`);
    } catch (err) {
      results.push({ name: contact.name, ok: false, error: err.message });
      console.error(`   ❌ Erro cancelamento ${contact.name}:`, err.message);
    }
  }

  res.json({ ok: true, results });
});

// Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🛡️  SafeCheck SOS rodando em http://localhost:${PORT}`);
  console.log('📨 Bot escutando mensagens (polling ativo)\n');
});
