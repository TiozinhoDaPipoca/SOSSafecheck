/* =============================================
   SafeCheck SOS — auth.js
   Autenticação via Firebase
   ============================================= */

// Configuração do Firebase (suas credenciais)
const firebaseConfig = {
  apiKey:            "AIzaSyD-dXLSkAro3UKRgSY7dS7-SWlWapx2H7s",
  authDomain:        "safecheck-sos.firebaseapp.com",
  projectId:         "safecheck-sos",
  storageBucket:     "safecheck-sos.firebasestorage.app",
  messagingSenderId: "644663709351",
  appId:             "1:644663709351:web:bd19eb230f461846e65582"
};

// Inicializa Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

// Usuário logado globalmente
let currentUser = null;

/* =============================================
   CONTROLE DE TELAS
   ============================================= */

function showAuthScreen() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app').style.display         = 'none';
}

function showAppScreen() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display         = 'block';
}

function showAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
  document.querySelector(`.auth-tab[data-tab="${tab}"]`).classList.add('active');
  document.getElementById(`form-${tab}`).classList.add('active');
  clearAuthError();
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.style.display = 'block';
}

function clearAuthError() {
  const el = document.getElementById('auth-error');
  el.textContent  = '';
  el.style.display = 'none';
}

function setAuthLoading(loading) {
  document.querySelectorAll('.auth-submit-btn').forEach(btn => {
    btn.disabled    = loading;
    btn.textContent = loading ? 'Aguarde...' : btn.dataset.label;
  });
}

/* =============================================
   OBSERVER — detecta login/logout
   ============================================= */

auth.onAuthStateChanged(async user => {
  if (user) {
    currentUser = user;
    await loadUserData(user);
    showAppScreen();
    updateProfileUI(user);
  } else {
    currentUser = null;
    showAuthScreen();
  }
});

/* =============================================
   CADASTRO COM EMAIL/SENHA
   ============================================= */

async function signUpEmail() {
  const name  = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const phone = document.getElementById('signup-phone').value.trim();
  const pass  = document.getElementById('signup-pass').value;
  const pass2 = document.getElementById('signup-pass2').value;

  clearAuthError();

  if (!name)          return showAuthError('Informe seu nome completo');
  if (!email)         return showAuthError('Informe seu email');
  if (!pass)          return showAuthError('Informe uma senha');
  if (pass.length < 6) return showAuthError('Senha deve ter no mínimo 6 caracteres');
  if (pass !== pass2) return showAuthError('As senhas não coincidem');

  setAuthLoading(true);
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    await cred.user.updateProfile({ displayName: name });
    await saveUserData(cred.user, { name, email, phone });
    showToast('✅ Cadastro realizado com sucesso!');
  } catch (err) {
    showAuthError(translateFirebaseError(err.code));
  } finally {
    setAuthLoading(false);
  }
}

/* =============================================
   LOGIN COM EMAIL/SENHA
   ============================================= */

async function signInEmail() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;

  clearAuthError();
  if (!email) return showAuthError('Informe seu email');
  if (!pass)  return showAuthError('Informe sua senha');

  setAuthLoading(true);
  try {
    await auth.signInWithEmailAndPassword(email, pass);
    showToast('✅ Bem-vinda de volta!');
  } catch (err) {
    showAuthError(translateFirebaseError(err.code));
  } finally {
    setAuthLoading(false);
  }
}

/* =============================================
   LOGIN COM GOOGLE
   ============================================= */

async function signInGoogle() {
  clearAuthError();
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const result = await auth.signInWithPopup(provider);
    const user   = result.user;
    const isNew  = result.additionalUserInfo?.isNewUser;
    if (isNew) {
      await saveUserData(user, {
        name:  user.displayName,
        email: user.email,
        phone: user.phoneNumber || '',
      });
    }
    showToast('✅ Login com Google realizado!');
  } catch (err) {
    if (err.code !== 'auth/popup-closed-by-user') {
      showAuthError(translateFirebaseError(err.code));
    }
  }
}

/* =============================================
   LOGIN COM TELEFONE (SMS)
   ============================================= */

let confirmationResult = null;

async function sendSMSCode() {
  const phone = document.getElementById('phone-number').value.trim();
  clearAuthError();

  if (!phone) return showAuthError('Informe o número de telefone');

  // Formata para E.164 (ex: +5521999999999)
  let formatted = phone.replace(/\D/g, '');
  if (!formatted.startsWith('55')) formatted = '55' + formatted;
  formatted = '+' + formatted;

  try {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
        size: 'invisible',
      });
    }

    confirmationResult = await auth.signInWithPhoneNumber(formatted, window.recaptchaVerifier);
    document.getElementById('sms-step1').style.display = 'none';
    document.getElementById('sms-step2').style.display = 'block';
    showToast('📱 Código SMS enviado!');
  } catch (err) {
    showAuthError(translateFirebaseError(err.code));
    if (window.recaptchaVerifier) {
      window.recaptchaVerifier.clear();
      window.recaptchaVerifier = null;
    }
  }
}

async function verifySMSCode() {
  const code = document.getElementById('sms-code').value.trim();
  clearAuthError();

  if (!code) return showAuthError('Informe o código recebido');

  setAuthLoading(true);
  try {
    const result = await confirmationResult.confirm(code);
    const user   = result.user;
    const isNew  = result.additionalUserInfo?.isNewUser;
    if (isNew) {
      await saveUserData(user, {
        name:  '',
        email: '',
        phone: user.phoneNumber,
      });
    }
    showToast('✅ Login com telefone realizado!');
  } catch (err) {
    showAuthError('Código inválido ou expirado. Tente novamente.');
  } finally {
    setAuthLoading(false);
  }
}

/* =============================================
   RECUPERAR SENHA
   ============================================= */

async function resetPassword() {
  const email = document.getElementById('login-email').value.trim();
  if (!email) return showAuthError('Digite seu email acima primeiro');

  try {
    await auth.sendPasswordResetEmail(email);
    showToast('📧 Email de recuperação enviado!', 5000);
  } catch (err) {
    showAuthError(translateFirebaseError(err.code));
  }
}

/* =============================================
   LOGOUT
   ============================================= */

async function signOut() {
  await auth.signOut();
  // Limpa dados locais
  contacts    = [];
  historyData = [];
  showToast('👋 Saiu da conta');
}

/* =============================================
   FIRESTORE — salvar e carregar dados do usuário
   ============================================= */

async function saveUserData(user, extra = {}) {
  await db.collection('users').doc(user.uid).set({
    name:      extra.name  || user.displayName || '',
    email:     extra.email || user.email       || '',
    phone:     extra.phone || user.phoneNumber || '',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function loadUserData(user) {
  try {
    // Carrega perfil
    const doc = await db.collection('users').doc(user.uid).get();
    if (doc.exists) {
      const data = doc.data();
      // Atualiza nome/email na UI
      updateProfileUI(user, data);
    }

    // Carrega contatos do Firestore
    const contSnap = await db.collection('users').doc(user.uid)
      .collection('contacts').orderBy('createdAt').get();

    contacts = contSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Carrega histórico
    const histSnap = await db.collection('users').doc(user.uid)
      .collection('history').orderBy('createdAt', 'desc').limit(50).get();

    historyData = histSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  } catch (err) {
    console.error('Erro ao carregar dados:', err);
    // Fallback para localStorage
    contacts    = JSON.parse(localStorage.getItem('safecheck_contacts') || '[]');
    historyData = JSON.parse(localStorage.getItem('safecheck_history')  || '[]');
  }
}

/* =============================================
   SALVAR CONTATO NO FIRESTORE
   ============================================= */

async function addContactData(name, phone, rel, telegramChatId) {
  const contact = { name, phone, rel, telegramChatId, createdAt: firebase.firestore.FieldValue.serverTimestamp() };

  if (currentUser) {
    const ref = await db.collection('users').doc(currentUser.uid)
      .collection('contacts').add(contact);
    contacts.push({ id: ref.id, ...contact });
  } else {
    contacts.push(contact);
    localStorage.setItem('safecheck_contacts', JSON.stringify(contacts));
  }
}

async function removeContactData(index) {
  const contact = contacts[index];
  if (currentUser && contact?.id) {
    await db.collection('users').doc(currentUser.uid)
      .collection('contacts').doc(contact.id).delete();
  }
  contacts.splice(index, 1);
  if (!currentUser) localStorage.setItem('safecheck_contacts', JSON.stringify(contacts));
}

/* =============================================
   SALVAR HISTÓRICO NO FIRESTORE
   ============================================= */

async function addHistoryEntry(type, title, sub, tag) {
  const now = new Date();
  const hh  = String(now.getHours()).padStart(2,'0');
  const mm  = String(now.getMinutes()).padStart(2,'0');
  const dd  = now.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' });

  const entry = { type, title, sub, time:`${dd} ${hh}:${mm}`, tag,
    createdAt: firebase.firestore.FieldValue.serverTimestamp() };

  if (currentUser) {
    const ref = await db.collection('users').doc(currentUser.uid)
      .collection('history').add(entry);
    historyData.unshift({ id: ref.id, ...entry });
  } else {
    historyData.unshift(entry);
    localStorage.setItem('safecheck_history', JSON.stringify(historyData));
  }
}

async function updateLastHistoryTag(tag) {
  if (historyData.length === 0) return;
  historyData[0].tag = tag;
  if (currentUser && historyData[0].id) {
    await db.collection('users').doc(currentUser.uid)
      .collection('history').doc(historyData[0].id).update({ tag });
  }
}

/* =============================================
   ATUALIZA UI DO PERFIL
   ============================================= */

function updateProfileUI(user, data = {}) {
  const name  = data.name  || user.displayName || 'Usuária';
  const email = data.email || user.email       || '';
  const initials = name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();

  const avatarEl = document.getElementById('profile-avatar');
  const nameEl   = document.getElementById('profile-name');
  const emailEl  = document.getElementById('profile-email');

  if (avatarEl) avatarEl.textContent = initials;
  if (nameEl)   nameEl.textContent   = name;
  if (emailEl)  emailEl.textContent  = email;

  // Atualiza nome usado nos alertas
  window.alertUserName = name;
}

/* =============================================
   TRADUÇÃO DE ERROS DO FIREBASE
   ============================================= */

function translateFirebaseError(code) {
  const errors = {
    'auth/email-already-in-use':    'Este email já está cadastrado',
    'auth/invalid-email':           'Email inválido',
    'auth/weak-password':           'Senha muito fraca (mínimo 6 caracteres)',
    'auth/user-not-found':          'Email não cadastrado',
    'auth/wrong-password':          'Senha incorreta',
    'auth/too-many-requests':       'Muitas tentativas. Tente mais tarde',
    'auth/network-request-failed':  'Sem conexão com a internet',
    'auth/invalid-phone-number':    'Número de telefone inválido',
    'auth/quota-exceeded':          'Limite de SMS atingido. Use email ou Google',
    'auth/popup-blocked':           'Popup bloqueado. Permita popups para este site',
  };
  return errors[code] || 'Erro inesperado. Tente novamente';
}
