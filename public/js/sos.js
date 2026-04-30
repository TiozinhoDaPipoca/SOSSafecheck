/* =============================================
   SafeCheck SOS — sos.js
   Lógica de emergência + Telegram + Live Location
   ============================================= */

let sosCount        = 0;
let sosResetTimer   = null;
let emergency       = false;
let emergencyStart  = null;
let emergencyTimer  = null;
let locationTimer   = null;   // atualiza GPS a cada 30s
let mediaStream     = null;
let mediaRecorder   = null;
let audioChunks     = [];
let sessionId       = null;   // ID único da emergência atual

const SOS_CLICKS    = 3;
const SOS_TIMEOUT   = 2500;
const LOCATION_INTERVAL = 30000; // 30 segundos

// Detecta URL base automaticamente (funciona local e no Render)
const API_BASE = window.location.origin;

/* ---- Botão SOS ---- */

function handleSOS() {
  if (emergency) return;
  sosCount++;
  updateDots(sosCount);
  clearTimeout(sosResetTimer);

  if (sosCount >= SOS_CLICKS) {
    activateEmergency();
  } else {
    const left = SOS_CLICKS - sosCount;
    document.getElementById('sos-hint').textContent =
      `Mais ${left} ${left === 1 ? 'clique' : 'cliques'} para ativar!`;
    sosResetTimer = setTimeout(resetSOS, SOS_TIMEOUT);
  }
}

function resetSOS() {
  sosCount = 0;
  updateDots(0);
  if (!emergency) {
    document.getElementById('sos-hint').textContent =
      'Toque 3× na tela ou pressione Volume+ 3×';
  }
}

function updateDots(n) {
  for (let i = 1; i <= SOS_CLICKS; i++) {
    document.getElementById('dot' + i)?.classList.toggle('filled', i <= n);
  }
}

/* ---- Ativação de emergência ---- */

async function activateEmergency() {
  emergency     = true;
  emergencyStart = Date.now();
  sessionId     = 'sos_' + Date.now(); // ID único desta emergência

  // Visual
  document.getElementById('sos-btn').classList.add('emergency');
  document.getElementById('ring1').classList.add('active');
  document.getElementById('ring2').classList.add('active');
  document.getElementById('status-label').textContent = '🔴 Emergência ativa!';
  document.getElementById('sos-hint').textContent = 'Alertas sendo enviados...';
  document.getElementById('emergency-bar').classList.add('active');

  // Cronômetro
  emergencyTimer = setInterval(updateTimer, 1000);

  // Som
  playAlertSound();

  // GPS (aguarda antes de enviar)
  setEmRow('em-gps', '📍 Obtendo localização...');
  await updateEmergencyLocation();

  // Áudio
  if (settings.audio) startRecording();

  // Telegram (envia alerta inicial com localização)
  await sendTelegramAlert();

  // Inicia atualização de localização em tempo real a cada 30s
  if (settings.gps && userLat) {
    locationTimer = setInterval(sendLocationUpdate, LOCATION_INTERVAL);
  }

  // Histórico
  addHistoryEntry('sos', 'Alerta SOS ativado',
    `${contacts.filter(c => c.telegramChatId).length} contato(s) alertado(s)`, 'Ativo');

  resetSOS();
}

/* ---- Cancelar emergência ---- */

async function cancelEmergency() {
  emergency = false;

  clearInterval(emergencyTimer);
  clearInterval(locationTimer);
  locationTimer = null;

  stopRecording();

  document.getElementById('sos-btn').classList.remove('emergency');
  document.getElementById('ring1').classList.remove('active');
  document.getElementById('ring2').classList.remove('active');
  document.getElementById('status-label').textContent = 'Você está protegida';
  document.getElementById('sos-hint').textContent =
    'Toque 3× na tela ou pressione Volume+ 3×';
  document.getElementById('emergency-bar').classList.remove('active');
  document.getElementById('elapsed').textContent = '00:00';

  updateLastHistoryTag('Cancelado');
  await sendTelegramCancel();
  sessionId = null;
  showToast('✅ Alerta cancelado. Fique segura!');
}

/* ---- GPS ---- */

async function updateEmergencyLocation() {
  return new Promise(resolve => {
    if (!settings.gps || !navigator.geolocation) {
      setEmRow('em-gps', '📍 GPS não disponível');
      resolve();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        userLat  = pos.coords.latitude;
        userLong = pos.coords.longitude;
        setEmRow('em-gps',
          `📍 GPS: <a href="https://maps.google.com/?q=${userLat},${userLong}" target="_blank" style="color:var(--red-dark);font-weight:600;">Ver no mapa ↗</a>`);
        resolve();
      },
      err => {
        console.warn('GPS error:', err.message);
        setEmRow('em-gps', '📍 GPS indisponível');
        resolve();
      },
      { timeout: 6000, maximumAge: 0, enableHighAccuracy: true }
    );
  });
}

/* ---- Atualização de localização a cada 30s ---- */

async function sendLocationUpdate() {
  if (!emergency || !sessionId || !userLat) return;

  // Atualiza posição do GPS primeiro
  navigator.geolocation.getCurrentPosition(
    async pos => {
      userLat  = pos.coords.latitude;
      userLong = pos.coords.longitude;

      setEmRow('em-gps',
        `📍 GPS atualizado — <a href="https://maps.google.com/?q=${userLat},${userLong}" target="_blank" style="color:var(--red-dark);font-weight:600;">Ver no mapa ↗</a>`);

      try {
        await fetch(`${API_BASE}/api/location-update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, location: { lat: userLat, lng: userLong } }),
        });
      } catch (err) {
        console.warn('Erro ao atualizar localização:', err.message);
      }
    },
    () => {}, // silencia erro de GPS na atualização
    { timeout: 5000, maximumAge: 0, enableHighAccuracy: true }
  );
}

/* ---- Gravação de áudio ---- */

function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setEmRow('em-audio', '🎙️ Gravação não suportada neste navegador');
    return;
  }
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      mediaStream   = stream;
      audioChunks   = [];
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
      mediaRecorder.start(1000);
      setEmRow('em-audio', '🎙️ Gravando áudio...');
    })
    .catch(err => {
      console.warn('Microfone negado:', err.message);
      setEmRow('em-audio', '🎙️ Microfone negado — permita o acesso');
    });
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
}

/* ---- Cronômetro ---- */

function updateTimer() {
  const diff = Math.floor((Date.now() - emergencyStart) / 1000);
  const m = String(Math.floor(diff / 60)).padStart(2, '0');
  const s = String(diff % 60).padStart(2, '0');
  const el = document.getElementById('elapsed');
  if (el) el.textContent = `${m}:${s}`;
}

/* ---- Envio Telegram ---- */

async function sendTelegramAlert() {
  const el = document.getElementById('em-telegram');
  const contactsWithId = contacts.filter(c => c.telegramChatId?.trim());

  if (contactsWithId.length === 0) {
    setEmRow('em-telegram', '📲 ⚠️ Nenhum contato com Chat ID');
    showToast('⚠️ Cadastre o Chat ID dos contatos!', 5000);
    return;
  }

  setEmRow('em-telegram', `📲 Enviando para ${contactsWithId.length} contato(s)...`);

  const url = `${API_BASE}/api/alert`;
  console.log('🚀 Chamando:', url);

  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        contacts:  contactsWithId,
        location:  userLat ? { lat: userLat, lng: userLong } : null,
        userName:  'Ana Silva',
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      // Mostra erros detalhados de cada contato
      const erros = (data.results || [])
        .filter(r => !r.ok)
        .map(r => `${r.name}: ${r.tip || r.error}`)
        .join(' | ');

      setEmRow('em-telegram', `📲 ❌ Erro: ${erros || data.error || 'Falha desconhecida'}`);
      showToast(`❌ Erro: ${erros || 'Verifique o Chat ID dos contatos'}`, 6000);
      return;
    }

    const ok   = data.results.filter(r => r.ok).length;
    const fail = data.results.filter(r => !r.ok);

    let statusText = `📲 ✅ ${ok} alerta(s) enviado(s)`;
    if (fail.length > 0) {
      const dicas = fail.map(r => `${r.name}: ${r.tip || r.error}`).join(' | ');
      statusText += ` · ⚠️ ${fail.length} falhou — ${dicas}`;
    }

    setEmRow('em-telegram', statusText);
    showToast(ok > 0 ? `🆘 ${ok} contato(s) alertado(s) pelo Telegram!` : '❌ Nenhum alerta enviado');

  } catch (err) {
    console.error('sendTelegramAlert error:', err);
    setEmRow('em-telegram', '📲 ❌ Servidor offline — rode npm start');
    showToast('❌ Servidor offline. Rode: npm start', 6000);
  }
}

async function sendTelegramCancel() {
  const contactsWithId = contacts.filter(c => c.telegramChatId?.trim());
  if (!contactsWithId.length) return;
  try {
    await fetch(`${API_BASE}/api/cancel`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, contacts: contactsWithId, userName: 'Ana Silva' }),
    });
  } catch (err) {
    console.warn('Erro ao cancelar:', err.message);
  }
}

/* ---- Helper: atualiza linha da barra de emergência ---- */
function setEmRow(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}
