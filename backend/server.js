/* =============================================
   SafeCheck SOS — server.js
   Backend Node.js + Express
   Envia alertas via Telegram Bot API
   ============================================= */

const express    = require('express');
const cors       = require('cors');
const fetch      = require('node-fetch');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 3000;

/* ---- Middlewares ---- */
app.use(cors());
app.use(express.json());

// Serve os arquivos do frontend
app.use(express.static('../frontend'));

/* ---- Variáveis de ambiente ---- */
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN; // Token do seu Bot

/* =============================================
   ROTA: Enviar alerta de emergência
   POST /api/alert
   Body: { contacts: [{name, chatId}], location: {lat, lng}, userName }
   ============================================= */
app.post('/api/alert', async (req, res) => {
  const { contacts, location, userName } = req.body;

  if (!contacts || contacts.length === 0) {
    return res.status(400).json({ error: 'Nenhum contato informado.' });
  }

  if (!TELEGRAM_TOKEN) {
    return res.status(500).json({ error: 'TELEGRAM_TOKEN não configurado no servidor.' });
  }

  //