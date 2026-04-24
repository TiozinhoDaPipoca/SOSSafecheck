/* =============================================
   SafeCheck SOS — sos.js
   Lógica de emergência + envio via Telegram
   ============================================= */

let sosCount       = 0;
let sosResetTimer  = null;
let emergency      = false;
let emergencyStart = null;
let emergencyTimer = null;
let mediaStream    = null;
let mediaRecorder  = null;
let audioChunks    = [];

const SOS_CLICKS  = 3;
const SOS_TIMEOUT = 2500;

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
  emergency      = true;
  emergencyStart = Date.now();

  // Visual
  document.getElementById('sos-btn').classList.add('emergency');
  document.getElementById('ring1').classList.add('active');
  document.getElementById('ring2').classList.add('active');
  document.getElementById('status-label').textContent = '🔴 Emergência ativa!';
  document.getElementById('sos-hint').textContent = 'Alertas sendo enviados...';
  document.getElementById('emergency-bar').classList.add('active');
  document.getElementById('contact-count')?.setAttribute && null;

  // Cronômetro
  emergencyTimer = setInterval(updateTimer, 1000);

  // Som
  playAlertSound();

  // GPS
  await updateEmergencyLocation();

  // Áudio
  if (settings.audio) startRecording();

  // Telegram
  await sendTelegramAlert();

  // Histórico
  addHistoryEntry('sos', 'Alerta SOS ativado',
    `${contacts.length} contato(s) alertado(s)`, 'Ativo');

  resetSOS();
}

/* ---- Cancelar emergência ---- */

async function cancelEmergency() {
  emergency = false;
  clearInterval(emergencyTimer);
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
  showToast('✅ Alerta cancelado. Fique segura!');
}

/* ---- GPS ---- */

async function updateEmergencyLocation() {
  const el = document.getElementById('em-gps');
  return new Promise(resolve => {
    if (!settings.gps || !navigator.geolocation) {
      el.textContent = '📍 GPS não disponível';
      resolve();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        userLat  = pos.coords.latitude;
        userLong = pos.coords.longitude;
        el.innerHTML = `📍 GPS obtido — <a href="https://maps.google.com/?q=${userLat},${userLong}" target="_blank" style="color:var(--red-dark);font-weight:600;">Ver no mapa</a>`;
        resolve();
      },
      () => { el.textContent = '📍 GPS indisponível'; resolve(); },
      { timeout: 5000, maximumAge: 0 }
    );
  });
}

/* ---- Gravação de áudio ---- */

function startRecording() {
  const el = document.getElementById('em-audio');
  if (!navigator.mediaDevices?.getUserMedia) {
    el.textContent = '🎙️ Gravação não suportada';
    return;
  }
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      mediaStream   = stream;
      audioChunks   = [];
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
      mediaRecorder.start(1000);
      el.textContent = '🎙️ Gravando áudio...';
      showToast('🎙️ Gravação iniciada');
    })
    .catch(() => { el.textContent = '🎙️ Microfone negado'; });
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }
}

/* ---- Cronômetro ---- */

function updateTimer() {
  const diff = Math.floor((Date.now() - emergencyStart) / 1000);
  const m = String(Math.floor(diff / 60)).padStart(2,'0');
  const s = String(diff % 60).padStart(2,'0');
  const el = document.getElementById('elapsed');
  if (el) el.textContent = `${m}:${s}`;
}

/* ---- Envio via Telegram (chama o backend) ---- */

async function sendTelegramAlert() {
  const el = document.getElementById('em-telegram');
  const contactsWithId = contacts.filter(c => c.telegramChatId);

  if (contactsWithId.length === 0) {
    el.textContent = '📲 Nenhum contato com Chat ID configurado';
    showToast('⚠️ Configure o Chat ID dos contatos!');
    return;
  }

  el.textContent = `📲 Enviando para ${contactsWithId.length} contato(s)...`;

  try {
    const res = await fetch('/api/alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contacts: contactsWithId,
        location: userLat ? { lat: userLat, lng: userLong } : null,
        userName: 'Ana Silva',
      }),
    });

    const data = await res.json();
    const ok   = data.results?.filter(r => r.ok).length || 0;
    const fail = data.results?.filter(r => !r.ok).length || 0;

    el.textContent = ok > 0
      ? `📲 ✅ ${ok} alerta(s) enviado(s)${fail > 0 ? ` · ⚠️ ${fail} falhou` : ''}`
      : '📲 ❌ Falha ao enviar alertas';

    showToast(ok > 0 ? `🆘 ${ok} contato(s) alertado(s) pelo Telegram!` : '❌ Erro ao enviar alertas');
  } catch {
    el.textContent = '📲 ❌ Servidor offline';
    showToast('❌ Servidor indisponível. Verifique a conexão.');
  }
}

async function sendTelegramCancel() {
  const contactsWithId = contacts.filter(c => c.telegramChatId);
  if (contactsWithId.length === 0) return;
  try {
    await fetch('/api/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contacts: contactsWithId, userName: 'Ana Silva' }),
    });
  } catch {}
}
