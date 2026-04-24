/* =============================================
   SafeCheck SOS — app.js
   ============================================= */

let userLat  = null;
let userLong = null;
let toastTimer = null;

function goTo(screen) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById('screen-' + screen);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-tabs').forEach(nav => {
    nav.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  });

  const labels = { home:'SOS', contacts:'Contatos', history:'Histórico', profile:'Perfil' };
  const navBar = target.querySelector('.nav-tabs');
  if (navBar) {
    navBar.querySelectorAll('.nav-tab').forEach(tab => {
      if (tab.textContent.trim().includes(labels[screen])) tab.classList.add('active');
    });
  }

  if (screen === 'contacts') renderContacts();
  if (screen === 'history')  renderHistory();
}

function showToast(msg, duration = 3200) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), duration);
}

function toggleSetting(btn, key) {
  btn.classList.toggle('on');
  saveSetting(key, btn.classList.contains('on'));
  showToast(btn.classList.contains('on') ? '✅ Ativado' : '⭕ Desativado');
  if (key === 'volume') setupVolumeKey();
}

function initLocation() {
  const locText = document.getElementById('loc-text');
  if (!navigator.geolocation) { locText.textContent = 'GPS indisponível'; return; }
  navigator.geolocation.getCurrentPosition(
    pos => {
      userLat  = pos.coords.latitude;
      userLong = pos.coords.longitude;
      locText.textContent = 'GPS ativo';
    },
    () => { locText.textContent = 'Localização manual'; }
  );
}

function initProfile() {
  const map = { 'tog-audio':'audio', 'tog-gps':'gps', 'tog-volume':'volume', 'tog-sound':'sound' };
  Object.entries(map).forEach(([id, key]) => {
    const btn = document.getElementById(id);
    if (btn) btn.classList.toggle('on', settings[key] !== false);
  });
  checkBotStatus();
}

async function checkBotStatus() {
  const statusEl = document.getElementById('bot-status');
  const iconEl   = document.getElementById('bot-status-icon');
  try {
    const res  = await fetch('/api/status');
    const data = await res.json();
    if (data.ok) {
      statusEl.textContent = 'Bot conectado e online';
      iconEl.textContent   = '✅';
      // Busca nome do bot
      const botRes  = await fetch('/api/bot-info');
      const botData = await botRes.json();
      if (botData.ok && botData.bot) {
        const name = '@' + botData.bot.username;
        document.querySelectorAll('#bot-name, #bot-name-modal').forEach(el => el.textContent = name);
      }
    }
  } catch {
    statusEl.textContent = 'Servidor offline — rode localmente';
    iconEl.textContent   = '❌';
  }
}

function showChatIdInstructions() {
  document.getElementById('modal-chatid').classList.add('open');
}

function closeModal() {
  document.getElementById('modal-chatid').classList.remove('open');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ---- Alerta sonoro ----
function playAlertSound() {
  if (!settings.sound) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.3, 0.6].forEach(delay => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.4, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.25);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.3);
    });
  } catch {}
}

document.addEventListener('DOMContentLoaded', () => {
  initLocation();
  initProfile();
  renderContacts();
  setupVolumeKey();
});
