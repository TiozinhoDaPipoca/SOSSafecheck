/* =============================================
   SafeCheck SOS — volume.js
   Detecção do botão físico de volume
   ============================================= */

let volumeCount     = 0;
let volumeResetTimer = null;
let lastVolume      = null;
let volumeEnabled   = true;

const VOLUME_CLICKS  = 3;
const VOLUME_TIMEOUT = 2500;

/**
 * Configura (ou desativa) o listener de volume físico.
 * Chamado na inicialização e ao alternar a configuração.
 */
function setupVolumeKey() {
  volumeEnabled = settings.volume !== false;

  // Remove listener antigo se existir
  if (window._volumeListener) {
    window.removeEventListener('keydown', window._volumeListener);
  }

  if (!volumeEnabled) return;

  window._volumeListener = handleVolumeKey;
  window.addEventListener('keydown', handleVolumeKey);

  // Em dispositivos móveis, tenta interceptar via mediaSession / deviceorientation
  // Alternativa: usar a mudança de volume via Media Session API (Chrome Android)
  setupMediaVolumeDetection();
}

/**
 * Responde a teclas do teclado (funciona em desktop e Android com teclado físico).
 * Teclas mapeadas: Volume+ (ArrowUp no emulador) e Volume- (ArrowDown).
 * Em celulares físicos, Volume+ = "VolumeUp", Volume- = "VolumeDown"
 */
function handleVolumeKey(e) {
  if (!volumeEnabled || emergency) return;

  const isVolumeKey = [
    'VolumeUp', 'VolumeDown',   // Android físico
    'AudioVolumeUp', 'AudioVolumeDown', // Alguns browsers
    'ArrowUp', 'ArrowDown',     // Desktop / emulador
    'F9', 'F10',                // Teclas de mídia em alguns teclados
  ].includes(e.key);

  if (!isVolumeKey) return;

  // Previne o comportamento padrão (mudar o volume) em alguns contextos
  e.preventDefault();

  registerVolumePress();
}

/**
 * Detecta mudança real de volume via MediaSession API.
 * Funciona em Chrome para Android quando o app está em foco.
 */
function setupMediaVolumeDetection() {
  if (!('mediaSession' in navigator)) return;

  try {
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      if (volumeEnabled && !emergency) registerVolumePress();
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      if (volumeEnabled && !emergency) registerVolumePress();
    });
  } catch {}

  // Outra técnica: criar áudio silencioso para "capturar" foco de mídia
  try {
    const audio    = new Audio();
    audio.src      = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
    audio.loop     = true;
    audio.volume   = 0.001;

    // Só inicia após interação do usuário (requisito do browser)
    document.addEventListener('click', () => {
      audio.play().catch(() => {});
    }, { once: true });
  } catch {}
}

/**
 * Registra um pressionamento de volume e verifica se atingiu o limite.
 */
function registerVolumePress() {
  volumeCount++;
  updateVolumeIndicator(volumeCount);

  clearTimeout(volumeResetTimer);

  if (volumeCount >= VOLUME_CLICKS) {
    volumeCount = 0;
    updateVolumeIndicator(0);
    showToast('🔊 SOS ativado pelo botão de volume!');
    handleSOS(); // Simula 1 clique — chama 3× via loop abaixo
    // Como handleSOS acumula internamente, precisamos chamar mais 2 vezes:
    setTimeout(() => handleSOS(), 50);
    setTimeout(() => handleSOS(), 100);
  } else {
    const left = VOLUME_CLICKS - volumeCount;
    showToast(`🔊 Volume pressionado — mais ${left}× para SOS`, 1500);
    volumeResetTimer = setTimeout(() => {
      volumeCount = 0;
      updateVolumeIndicator(0);
    }, VOLUME_TIMEOUT);
  }
}

/**
 * Atualiza visualmente os pontos do SOS com o progresso do volume.
 * (Reaproveita os mesmos dots da tela home)
 */
function updateVolumeIndicator(n) {
  // Só atualiza se estiver na tela home
  const homeActive = document.getElementById('screen-home')?.classList.contains('active');
  if (!homeActive) return;

  for (let i = 1; i <= 3; i++) {
    const dot = document.getElementById('dot' + i);
    if (dot) dot.classList.toggle('filled', i <= n);
  }
}
