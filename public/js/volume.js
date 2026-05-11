/* SafeCheck SOS — volume.js */
let volumeCount=0, volumeResetTimer=null, volumeEnabled=true;

function setupVolumeKey() {
  volumeEnabled = settings.volume !== false;
  if (window._volumeListener) window.removeEventListener('keydown', window._volumeListener);
  if (!volumeEnabled) return;
  window._volumeListener = handleVolumeKey;
  window.addEventListener('keydown', handleVolumeKey);
  setupMediaVolumeDetection();
}

function handleVolumeKey(e) {
  if (!volumeEnabled || emergency) return;
  const isVolumeKey = ['VolumeUp','VolumeDown','AudioVolumeUp','AudioVolumeDown','ArrowUp','ArrowDown'].includes(e.key);
  if (!isVolumeKey) return;
  e.preventDefault();
  registerVolumePress();
}

function setupMediaVolumeDetection() {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.setActionHandler('previoustrack', ()=>{ if(volumeEnabled&&!emergency) registerVolumePress(); });
    navigator.mediaSession.setActionHandler('nexttrack', ()=>{ if(volumeEnabled&&!emergency) registerVolumePress(); });
  } catch {}
}

function registerVolumePress() {
  volumeCount++;
  updateVolumeIndicator(volumeCount);
  clearTimeout(volumeResetTimer);
  if (volumeCount >= 3) {
    volumeCount=0; updateVolumeIndicator(0);
    showToast('🔊 SOS ativado pelo botão de volume!');
    handleSOS(); setTimeout(()=>handleSOS(),50); setTimeout(()=>handleSOS(),100);
  } else {
    const left=3-volumeCount;
    showToast(`🔊 Mais ${left}× para SOS`,1500);
    volumeResetTimer = setTimeout(()=>{ volumeCount=0; updateVolumeIndicator(0); }, 2500);
  }
}

function updateVolumeIndicator(n) {
  if (!document.getElementById('screen-home')?.classList.contains('active')) return;
  for (let i=1;i<=3;i++) { const d=document.getElementById('dot'+i); if(d) d.classList.toggle('filled',i<=n); }
}
