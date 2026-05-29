/* =============================================
   SafeCheck SOS — sos.js
   Emergência + gravação de áudio com download e envio Telegram
   ============================================= */

let sosCount       = 0;
let sosResetTimer  = null;
let emergency      = false;
let emergencyStart = null;
let emergencyTimer = null;
let locationTimer  = null;
let mediaStream    = null;
let mediaRecorder  = null;
let audioChunks    = [];

const SOS_CLICKS        = 3;
const SOS_TIMEOUT       = 2500;
const LOCATION_INTERVAL = 30000;
const API_BASE          = window.location.origin;

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
      'Toque 3× ou pressione Volume+ 3×';
  }
}

function updateDots(n) {
  for (let i = 1; i <= SOS_CLICKS; i++) {
    document.getElementById('dot' + i)?.classList.toggle('filled', i <= n);
  }
}

/* ---- Ativação de emergência ---- */
async function activateEmergency() {
  emergency      = true;
  emergencyStart = Date.now();
  audioChunks    = [];

  document.getElementById('sos-btn').classList.add('emergency');
  document.getElementById('ring1').classList.add('active');
  document.getElementById('ring2').classList.add('active');
  document.getElementById('status-label').textContent = '🔴 Emergência ativa!';
  document.getElementById('sos-hint').textContent     = 'Alertas sendo enviados...';
  document.getElementById('emergency-bar').classList.add('active');

  emergencyTimer = setInterval(updateTimer, 1000);
  playAlertSound();

  // GPS
  await updateEmergencyLocation();

  // Áudio
  if (settings.audio) startRecording();

  // Telegram
  await sendTelegramAlert();

  // Atualiza localização a cada 30s
  if (settings.gps && userLat) {
    locationTimer = setInterval(sendLocationUpdate, LOCATION_INTERVAL);
  }

  // Histórico
  await addHistoryEntry(
    'sos',
    'Alerta SOS ativado',
    `${contacts.filter(c => c.telegramChatId?.trim()).length} contato(s) alertado(s)`,
    'Ativo'
  );

  resetSOS();
}

/* ---- Cancelar emergência ---- */
async function cancelEmergency() {
  emergency = false;
  clearInterval(emergencyTimer);
  clearInterval(locationTimer);
  locationTimer = null;

  document.getElementById('sos-btn').classList.remove('emergency');
  document.getElementById('ring1').classList.remove('active');
  document.getElementById('ring2').classList.remove('active');
  document.getElementById('status-label').textContent = 'Você está protegida';
  document.getElementById('sos-hint').textContent     = 'Toque 3× ou pressione Volume+ 3×';
  document.getElementById('emergency-bar').classList.remove('active');
  document.getElementById('elapsed').textContent      = '00:00';

  await updateLastHistoryTag('Cancelado');

  // Para gravação e processa o áudio
  await stopRecordingAndProcess();

  await sendTelegramCancel();
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
        setEmRow('em-gps', `📍 GPS obtido — <a href="https://maps.google.com/?q=${userLat},${userLong}" target="_blank" style="color:var(--red-dark);font-weight:600;">Ver no mapa ↗</a>`);
        resolve();
      },
      () => { setEmRow('em-gps', '📍 GPS indisponível'); resolve(); },
      { timeout: 6000, maximumAge: 0, enableHighAccuracy: true }
    );
  });
}

async function sendLocationUpdate() {
  if (!emergency || !userLat) return;
  navigator.geolocation.getCurrentPosition(async pos => {
    userLat  = pos.coords.latitude;
    userLong = pos.coords.longitude;
    setEmRow('em-gps', `📍 GPS atualizado — <a href="https://maps.google.com/?q=${userLat},${userLong}" target="_blank" style="color:var(--red-dark);font-weight:600;">Ver no mapa ↗</a>`);
    try {
      await fetch(`${API_BASE}/api/location-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contacts: contacts.filter(c => c.telegramChatId?.trim()),
          location: { lat: userLat, lng: userLong },
          userName: window.alertUserName || 'Usuária',
        }),
      });
    } catch {}
  }, () => {}, { timeout: 5000, maximumAge: 0 });
}

/* ---- Gravação de áudio ---- */
function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setEmRow('em-audio', '🎙️ Gravação não suportada');
    return;
  }
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      mediaStream   = stream;
      audioChunks   = [];

      // Tenta usar webm, senão usa o que o browser suportar
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';

      mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.start(1000); // coleta chunks a cada 1 segundo
      setEmRow('em-audio', '🎙️ Gravando áudio...');
    })
    .catch(() => setEmRow('em-audio', '🎙️ Microfone negado'));
}

async function stopRecordingAndProcess() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return;

  return new Promise(resolve => {
    mediaRecorder.onstop = async () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop());
        mediaStream = null;
      }

      if (audioChunks.length === 0) { resolve(); return; }

      const mimeType = mediaRecorder.mimeType || 'audio/webm';
      const ext      = mimeType.includes('mp4') ? 'mp4' : 'webm';
      const blob     = new Blob(audioChunks, { type: mimeType });
      audioChunks    = [];

      if (blob.size < 1000) { resolve(); return; } // áudio muito curto

      // Gera nome com data/hora
      const now      = new Date();
      const fileName = `safecheck_${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}.${ext}`;

      // 1. Download automático no celular
      downloadAudio(blob, fileName);

      // 2. Envia pelo Telegram
      await sendAudioToTelegram(blob, fileName, mimeType);

      resolve();
    };

    mediaRecorder.stop();
  });
}

/* ---- Download do áudio no dispositivo ---- */
function downloadAudio(blob, fileName) {
  try {
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    showToast('💾 Áudio salvo no dispositivo!', 4000);
  } catch (e) {
    console.warn('Download de áudio falhou:', e);
  }
}

/* ---- Envia áudio para o Telegram via backend ---- */
async function sendAudioToTelegram(blob, fileName, mimeType) {
  const contactsWithId = contacts.filter(c => c.telegramChatId?.trim());
  if (!contactsWithId.length) return;

  try {
    // Converte blob para base64
    const base64 = await blobToBase64(blob);

    setEmRow('em-audio', '🎙️ Enviando áudio pelo Telegram...');

    const res = await fetch(`${API_BASE}/api/send-audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contacts:  contactsWithId,
        audioBase64: base64,
        fileName,
        mimeType,
        userName:  window.alertUserName || 'Usuária',
      }),
    });

    const data = await res.json();
    const ok   = data.results?.filter(r => r.ok).length || 0;

    setEmRow('em-audio', ok > 0
      ? `🎙️ ✅ Áudio enviado para ${ok} contato(s)`
      : '🎙️ ⚠️ Falha ao enviar áudio');

  } catch (err) {
    console.warn('Erro ao enviar áudio:', err);
    setEmRow('em-audio', '🎙️ ⚠️ Erro ao enviar áudio');
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror   = reject;
    reader.readAsDataURL(blob);
  });
}

/* ---- Cronômetro ---- */
function updateTimer() {
  const diff = Math.floor((Date.now() - emergencyStart) / 1000);
  const m    = String(Math.floor(diff / 60)).padStart(2, '0');
  const s    = String(diff % 60).padStart(2, '0');
  const el   = document.getElementById('elapsed');
  if (el) el.textContent = `${m}:${s}`;
}

/* ---- Telegram Alert ---- */
async function sendTelegramAlert() {
  const contactsWithId = contacts.filter(c => c.telegramChatId?.trim());
  if (!contactsWithId.length) {
    setEmRow('em-telegram', '📲 ⚠️ Nenhum contato com Chat ID');
    showToast('⚠️ Cadastre o Chat ID dos contatos!', 5000);
    return;
  }

  setEmRow('em-telegram', `📲 Enviando para ${contactsWithId.length} contato(s)...`);

  try {
    const res  = await fetch(`${API_BASE}/api/alert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contacts: contactsWithId,
        location: userLat ? { lat: userLat, lng: userLong } : null,
        userName: window.alertUserName || 'Usuária',
      }),
    });
    const data = await res.json();
    const ok   = data.results?.filter(r => r.ok).length || 0;
    const fail = data.results?.filter(r => !r.ok).length || 0;

    setEmRow('em-telegram', ok > 0
      ? `📲 ✅ ${ok} alerta(s) enviado(s)${fail > 0 ? ` · ⚠️ ${fail} falhou` : ''}`
      : '📲 ❌ Falha ao enviar alertas');

    showToast(ok > 0 ? `🆘 ${ok} contato(s) alertado(s)!` : '❌ Erro ao enviar alertas');
  } catch {
    setEmRow('em-telegram', '📲 ❌ Servidor offline');
    showToast('❌ Servidor indisponível', 5000);
  }
}

async function sendTelegramCancel() {
  const contactsWithId = contacts.filter(c => c.telegramChatId?.trim());
  if (!contactsWithId.length) return;
  try {
    await fetch(`${API_BASE}/api/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contacts: contactsWithId,
        userName: window.alertUserName || 'Usuária',
      }),
    });
  } catch {}
}

/* ---- Utilitário ---- */
function setEmRow(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}
