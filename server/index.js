// =============================================
// SafeCheck SOS — server/index.js
// Backend Express + Telegram Bot
// =============================================

require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const TelegramBot = require('node-telegram-bot-api');

const app  = express();
const PORT = process.env.PORT || 3000;
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// ---- Validação do token ----
if (!TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN não definido no .env');
  process.exit(1);
}

// ---- Inicializa o Bot do Telegram ----
const bot = new TelegramBot(TOKEN, { polling: false });

// ---- Middlewares ----
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// =============================================
// ROTAS DA API
// =============================================

/**
 * GET /api/status
 * Verifica se o servidor está rodando.
 */
app.get('/api/status', (req, res) => {
  res.json({ ok: true, message: 'SafeCheck SOS online ✅' });
});

/**
 * POST /api/alert
 * Envia alerta de emergência via Telegram para todos os contatos.
 *
 * Body esperado:
 * {
 *   contacts: [{ name, phone, telegramChatId }],
 *   location: { lat, lng } | null,
 *   userName: "Ana Silva"
 * }
 */
app.post('/api/alert', async (req, res) => {
  const { contacts, location, userName } = req.body;

  if (!contacts || contacts.length === 0) {
    return res.status(400).json({ ok: false, error: 'Nenhum contato informado' });
  }

  // Monta a mensagem de emergência
  const locationText = location
    ? `📍 Localização: https://maps.google.com/?q=${location.lat},${location.lng}`
    : '📍 Localização não disponível';

  const message = [
    '🆘 *ALERTA DE EMERGÊNCIA — SafeCheck SOS*',
    '',
    `⚠️ *${escapeMarkdown(userName || 'Usuária')}* ativou o botão de emergência!`,
    '',
    locationText,
    '',
    '🎙️ Gravação de áudio iniciada automaticamente.',
    '',
    '_Se ela estiver em perigo, entre em contato ou acione as autoridades._',
    '',
    '📞 *Emergências:* 190 (Polícia) | 192 (SAMU) | 180 (CVM)',
  ].join('\n');

  const results = [];

  // Envia para cada contato que tem Chat ID configurado
  for (const contact of contacts) {
    if (!contact.telegramChatId) {
      results.push({ name: contact.name, ok: false, error: 'Chat ID não configurado' });
      continue;
    }

    try {
      await bot.sendMessage(contact.telegramChatId, message, {
        parse_mode: 'Markdown',
      });

      // Envia localização separada se disponível (card interativo do Telegram)
      if (location) {
        await bot.sendLocation(contact.telegramChatId, location.lat, location.lng);
      }

      results.push({ name: contact.name, ok: true });
      console.log(`✅ Alerta enviado para ${contact.name} (${contact.telegramChatId})`);
    } catch (err) {
      results.push({ name: contact.name, ok: false, error: err.message });
      console.error(`❌ Erro ao enviar para ${contact.name}:`, err.message);
    }
  }

  const anySuccess = results.some(r => r.ok);
  res.status(anySuccess ? 200 : 500).json({ ok: anySuccess, results });
});

/**
 * POST /api/cancel
 * Envia mensagem de cancelamento do alerta.
 *
 * Body esperado:
 * {
 *   contacts: [{ name, telegramChatId }],
 *   userName: "Ana Silva"
 * }
 */
app.post('/api/cancel', async (req, res) => {
  const { contacts, userName } = req.body;

  if (!contacts || contacts.length === 0) {
    return res.status(400).json({ ok: false, error: 'Nenhum contato informado' });
  }

  const message = [
    '✅ *Alerta cancelado — SafeCheck SOS*',
    '',
    `*${escapeMarkdown(userName || 'Usuária')}* está segura e cancelou o alerta.`,
    '',
    '_Nenhuma ação necessária. Obrigado por estar disponível!_ 💙',
  ].join('\n');

  const results = [];

  for (const contact of contacts) {
    if (!contact.telegramChatId) {
      results.push({ name: contact.name, ok: false, error: 'Chat ID não configurado' });
      continue;
    }

    try {
      await bot.sendMessage(contact.telegramChatId, message, { parse_mode: 'Markdown' });
      results.push({ name: contact.name, ok: true });
    } catch (err) {
      results.push({ name: contact.name, ok: false, error: err.message });
    }
  }

  res.json({ ok: true, results });
});

/**
 * POST /api/get-chat-id
 * Ajuda o usuário a descobrir o Chat ID do Telegram de um contato.
 * O contato deve ter enviado /start para o bot antes.
 *
 * Body: { botToken: string } (opcional, usa o token do servidor)
 */
app.get('/api/bot-info', async (req, res) => {
  try {
    const info = await bot.getMe();
    res.json({ ok: true, bot: info });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---- Fallback: serve index.html para qualquer rota não encontrada ----
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ---- Inicia o servidor ----
app.listen(PORT, () => {
  console.log(`🛡️  SafeCheck SOS rodando em http://localhost:${PORT}`);
  console.log(`🤖 Bot Telegram conectado`);
});

// ---- Utilitário ----
function escapeMarkdown(text) {
  return String(text).replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}
