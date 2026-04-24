# 🛡️ SafeCheck SOS v2

Aplicativo de emergência feminina com **Telegram Bot** e **botão físico de volume**.

---

## 📁 Estrutura de arquivos

```
safecheck-sos-v2/
├── package.json          ← dependências do Node.js
├── .env.example          ← modelo das variáveis de ambiente
├── .gitignore
│
├── server/
│   └── index.js          ← Backend (Express + Telegram Bot)
│
└── public/               ← Frontend (HTML + CSS + JS)
    ├── index.html
    ├── css/style.css
    └── js/
        ├── data.js       ← localStorage
        ├── app.js        ← navegação e utilitários
        ├── sos.js        ← lógica de emergência + Telegram
        ├── contacts.js   ← gerenciar contatos
        ├── history.js    ← histórico
        └── volume.js     ← botão físico de volume
```

---

## 🚀 PASSO A PASSO COMPLETO

### ETAPA 1 — Criar o Bot no Telegram

1. Abra o Telegram e pesquise por **@BotFather**
2. Envie `/newbot`
3. Escolha um nome (Ex: `SafeCheck SOS`)
4. Escolha um username (Ex: `SafeCheckSOS_bot`) — deve terminar em `bot`
5. O BotFather vai te enviar um **token** parecido com:
   ```
   7312456789:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
6. **Guarde esse token** — você vai precisar dele!

---

### ETAPA 2 — Configurar o Chat ID dos contatos

Cada contato que vai **receber o alerta** precisa fazer isso:

1. Abrir o Telegram e pesquisar pelo seu bot (ex: `@SafeCheckSOS_bot`)
2. Clicar em **Start** ou enviar `/start`
3. O bot vai responder automaticamente com o **Chat ID** daquela pessoa
4. Essa pessoa te envia esse número
5. Você cadastra no app no campo **"Telegram Chat ID"**

> ⚠️ Sem o Chat ID configurado, o alerta não é enviado.

---

### ETAPA 3 — Rodar localmente no seu computador

**Pré-requisito:** instale o [Node.js](https://nodejs.org) (versão 18 ou maior)

```bash
# 1. Abra o terminal na pasta do projeto
cd safecheck-sos-v2

# 2. Instale as dependências
npm install

# 3. Crie o arquivo .env com seu token
cp .env.example .env
# Edite o .env e coloque seu token do Telegram:
# TELEGRAM_BOT_TOKEN=seu_token_aqui

# 4. Inicie o servidor
npm start

# 5. Abra no navegador:
# http://localhost:3000
```

---

### ETAPA 4 — Deploy no Render (acesso de qualquer celular, grátis)

1. **Suba o código para o GitHub:**
   ```bash
   git init
   git add .
   git commit -m "SafeCheck SOS v2"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/safecheck-sos.git
   git push -u origin main
   ```

2. **Acesse [render.com](https://render.com)** e faça login

3. Clique em **New → Web Service**

4. Conecte ao seu repositório GitHub

5. Configure:
   - **Name:** safecheck-sos
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`

6. Em **Environment Variables**, adicione:
   - `TELEGRAM_BOT_TOKEN` = seu token do Telegram

7. Clique em **Create Web Service**

8. Aguarde o deploy (~2 min) e acesse a URL gerada!
   - Ex: `https://safecheck-sos.onrender.com`

---

## 🔊 Botão físico de volume

Com o app aberto no navegador do celular:
- Pressione **Volume+** ou **Volume−** **3 vezes seguidas** para ativar o SOS
- Cada pressão acende um ponto na tela
- Funciona mesmo sem tocar na tela

> ⚠️ O navegador precisa estar em foco (tela ligada, app aberto). Não funciona com tela bloqueada — essa é uma limitação de segurança dos sistemas operacionais.

---

## 🎨 Personalizar cores

Edite as variáveis no topo de `public/css/style.css`:

```css
:root {
  --red:   #E24B4A;  /* cor principal */
  --teal:  #1D9E75;  /* cor de "segura" */
  --pink:  #D4537E;  /* cor secundária */
}
```

---

## 📞 Números de emergência do Brasil

- **190** — Polícia Militar
- **192** — SAMU
- **193** — Bombeiros
- **180** — Central de Atendimento à Mulher
- **188** — CVV (Centro de Valorização da Vida)
