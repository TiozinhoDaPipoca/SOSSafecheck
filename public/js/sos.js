/* SafeCheck SOS — sos.js */
let sosCount=0,sosResetTimer=null,emergency=false,emergencyStart=null,emergencyTimer=null,locationTimer=null,mediaStream=null,mediaRecorder=null,audioChunks=[];
const SOS_CLICKS=3,SOS_TIMEOUT=2500,LOCATION_INTERVAL=30000;
const API_BASE = window.location.origin;

function handleSOS() {
  if (emergency) return;
  sosCount++;
  updateDots(sosCount);
  clearTimeout(sosResetTimer);
  if (sosCount >= SOS_CLICKS) { activateEmergency(); }
  else {
    const left = SOS_CLICKS - sosCount;
    document.getElementById('sos-hint').textContent = `Mais ${left} ${left===1?'clique':'cliques'} para ativar!`;
    sosResetTimer = setTimeout(resetSOS, SOS_TIMEOUT);
  }
}

function resetSOS() {
  sosCount = 0; updateDots(0);
  if (!emergency) document.getElementById('sos-hint').textContent = 'Toque 3× ou pressione Volume+ 3×';
}

function updateDots(n) { for (let i=1;i<=SOS_CLICKS;i++) document.getElementById('dot'+i)?.classList.toggle('filled',i<=n); }

async function activateEmergency() {
  emergency=true; emergencyStart=Date.now();
  document.getElementById('sos-btn').classList.add('emergency');
  document.getElementById('ring1').classList.add('active');
  document.getElementById('ring2').classList.add('active');
  document.getElementById('status-label').textContent='🔴 Emergência ativa!';
  document.getElementById('sos-hint').textContent='Alertas sendo enviados...';
  document.getElementById('emergency-bar').classList.add('active');
  emergencyTimer = setInterval(updateTimer, 1000);
  playAlertSound();
  setEmRow('em-gps','📍 Obtendo localização...');
  await updateEmergencyLocation();
  if (settings.audio) startRecording();
  await sendTelegramAlert();
  if (settings.gps && userLat) locationTimer = setInterval(sendLocationUpdate, LOCATION_INTERVAL);
  await addHistoryEntry('sos','Alerta SOS ativado',`${contacts.filter(c=>c.telegramChatId).length} contato(s) alertado(s)`,'Ativo');
  resetSOS();
}

async function cancelEmergency() {
  emergency=false; clearInterval(emergencyTimer); clearInterval(locationTimer); locationTimer=null; stopRecording();
  document.getElementById('sos-btn').classList.remove('emergency');
  document.getElementById('ring1').classList.remove('active');
  document.getElementById('ring2').classList.remove('active');
  document.getElementById('status-label').textContent='Você está protegida';
  document.getElementById('sos-hint').textContent='Toque 3× ou pressione Volume+ 3×';
  document.getElementById('emergency-bar').classList.remove('active');
  document.getElementById('elapsed').textContent='00:00';
  await updateLastHistoryTag('Cancelado');
  await sendTelegramCancel();
  showToast('✅ Alerta cancelado. Fique segura!');
}

async function updateEmergencyLocation() {
  return new Promise(resolve => {
    if (!settings.gps || !navigator.geolocation) { setEmRow('em-gps','📍 GPS não disponível'); resolve(); return; }
    navigator.geolocation.getCurrentPosition(
      pos => {
        userLat=pos.coords.latitude; userLong=pos.coords.longitude;
        setEmRow('em-gps',`📍 GPS: <a href="https://maps.google.com/?q=${userLat},${userLong}" target="_blank" style="color:var(--red-dark);font-weight:600;">Ver no mapa ↗</a>`);
        resolve();
      },
      () => { setEmRow('em-gps','📍 GPS indisponível'); resolve(); },
      { timeout:6000, maximumAge:0, enableHighAccuracy:true }
    );
  });
}

async function sendLocationUpdate() {
  if (!emergency || !userLat) return;
  navigator.geolocation.getCurrentPosition(async pos => {
    userLat=pos.coords.latitude; userLong=pos.coords.longitude;
    setEmRow('em-gps',`📍 GPS atualizado — <a href="https://maps.google.com/?q=${userLat},${userLong}" target="_blank" style="color:var(--red-dark);font-weight:600;">Ver no mapa ↗</a>`);
    try {
      await fetch(`${API_BASE}/api/location-update`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ contacts:contacts.filter(c=>c.telegramChatId), location:{lat:userLat,lng:userLong}, userName: window.alertUserName||'Usuária' })
      });
    } catch {}
  }, ()=>{}, {timeout:5000,maximumAge:0,enableHighAccuracy:true});
}

function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia) { setEmRow('em-audio','🎙️ Gravação não suportada'); return; }
  navigator.mediaDevices.getUserMedia({audio:true})
    .then(stream => { mediaStream=stream; audioChunks=[]; mediaRecorder=new MediaRecorder(stream); mediaRecorder.ondataavailable=e=>{if(e.data.size>0)audioChunks.push(e.data);}; mediaRecorder.start(1000); setEmRow('em-audio','🎙️ Gravando áudio...'); })
    .catch(() => setEmRow('em-audio','🎙️ Microfone negado'));
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state!=='inactive') mediaRecorder.stop();
  if (mediaStream) { mediaStream.getTracks().forEach(t=>t.stop()); mediaStream=null; }
}

function updateTimer() {
  const diff=Math.floor((Date.now()-emergencyStart)/1000);
  const el=document.getElementById('elapsed');
  if (el) el.textContent=`${String(Math.floor(diff/60)).padStart(2,'0')}:${String(diff%60).padStart(2,'0')}`;
}

async function sendTelegramAlert() {
  const contactsWithId = contacts.filter(c=>c.telegramChatId?.trim());
  if (!contactsWithId.length) { setEmRow('em-telegram','📲 ⚠️ Nenhum contato com Chat ID'); showToast('⚠️ Cadastre o Chat ID dos contatos!',5000); return; }
  setEmRow('em-telegram',`📲 Enviando para ${contactsWithId.length} contato(s)...`);
  try {
    const res = await fetch(`${API_BASE}/api/alert`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ contacts:contactsWithId, location:userLat?{lat:userLat,lng:userLong}:null, userName:window.alertUserName||'Usuária' })
    });
    const data = await res.json();
    const ok = data.results?.filter(r=>r.ok).length||0;
    const fail = data.results?.filter(r=>!r.ok)||[];
    setEmRow('em-telegram', ok>0 ? `📲 ✅ ${ok} alerta(s) enviado(s)${fail.length>0?` · ⚠️ ${fail.length} falhou`:''}` : '📲 ❌ Erro ao enviar');
    showToast(ok>0 ? `🆘 ${ok} contato(s) alertado(s)!` : '❌ Erro ao enviar alertas');
  } catch {
    setEmRow('em-telegram','📲 ❌ Servidor offline');
    showToast('❌ Servidor indisponível',5000);
  }
}

async function sendTelegramCancel() {
  const contactsWithId = contacts.filter(c=>c.telegramChatId?.trim());
  if (!contactsWithId.length) return;
  try { await fetch(`${API_BASE}/api/cancel`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({contacts:contactsWithId,userName:window.alertUserName||'Usuária'}) }); } catch {}
}

function setEmRow(id, html) { const el=document.getElementById(id); if(el) el.innerHTML=html; }
