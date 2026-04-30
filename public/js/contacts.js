/* =============================================
   SafeCheck SOS — contacts.js
   ============================================= */

const AVATAR_CLASSES = ['av-pink', 'av-teal', 'av-red', 'av-gray'];

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function renderContacts() {
  const list = document.getElementById('contacts-list');
  if (!list) return;

  if (contacts.length === 0) {
    list.innerHTML = `
      <div class="empty-contacts">
        <div style="font-size:34px;margin-bottom:10px">👥</div>
        <p>Nenhum contato cadastrado ainda.</p>
        <p style="margin-top:4px;font-size:11px;color:var(--text2);">
          Adicione contatos abaixo. Cada um precisa enviar /start para o bot.
        </p>
      </div>`;
    return;
  }

  list.innerHTML = contacts.map((c, i) => {
    const avClass = AVATAR_CLASSES[i % AVATAR_CLASSES.length];
    const hasId   = !!c.telegramChatId?.trim();
    return `
      <div class="contact-card">
        <div class="contact-avatar ${avClass}">${getInitials(c.name)}</div>
        <div class="contact-info">
          <div class="contact-name">${escapeHtml(c.name)}</div>
          <div class="contact-phone">${escapeHtml(c.phone)}</div>
          <span class="contact-tag ${hasId ? 'tag-ok' : 'tag-warn'}">
            ${hasId ? '🤖 Telegram configurado' : '⚠️ Chat ID pendente'}
          </span>
          ${hasId ? `<button class="test-btn" onclick="testContact(${i})" id="test-btn-${i}">Testar envio</button>` : ''}
        </div>
        <button class="del-btn" onclick="deleteContact(${i})">✕</button>
      </div>`;
  }).join('');
}

function addContact() {
  const name   = document.getElementById('inp-name').value.trim();
  const phone  = document.getElementById('inp-phone').value.trim();
  const rel    = document.getElementById('inp-rel').value.trim();
  const chatId = document.getElementById('inp-chatid').value.trim();

  if (!name)  { showToast('⚠️ Informe o nome');     return; }
  if (!phone) { showToast('⚠️ Informe o telefone'); return; }

  if (contacts.some(c => c.phone.replace(/\D/g,'') === phone.replace(/\D/g,''))) {
    showToast('⚠️ Telefone já cadastrado'); return;
  }

  if (chatId && !/^-?\d+$/.test(chatId)) {
    showToast('⚠️ Chat ID inválido — deve ser só números'); return;
  }

  addContactData(name, phone, rel || 'Contato', chatId);
  renderContacts();
  ['inp-name','inp-phone','inp-rel','inp-chatid'].forEach(id => {
    document.getElementById(id).value = '';
  });

  showToast(chatId
    ? '✅ Salvo! Clique em "Testar envio" para confirmar.'
    : '✅ Salvo! Adicione o Chat ID para alertas Telegram.');
}

function deleteContact(index) {
  const name = contacts[index]?.name || 'Contato';
  removeContactData(index);
  renderContacts();
  showToast(`🗑️ "${name}" removido`);
}

async function testContact(index) {
  const contact = contacts[index];
  if (!contact?.telegramChatId) return;

  const btn = document.getElementById(`test-btn-${index}`);
  if (btn) { btn.textContent = 'Enviando...'; btn.disabled = true; }

  try {
    const res  = await fetch(`${window.location.origin}/api/test-contact`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chatId: contact.telegramChatId, name: contact.name }),
    });
    const data = await res.json();

    if (data.ok) {
      showToast(`✅ Mensagem enviada para ${contact.name}! Peça para confirmar no Telegram.`, 5000);
      if (btn) { btn.textContent = '✅ OK!'; btn.style.color = 'var(--teal)'; }
    } else {
      showToast(`❌ ${data.tip || data.error}`, 6000);
      if (btn) { btn.textContent = '❌ Falhou'; btn.style.color = 'var(--red)'; }
    }
  } catch {
    showToast('❌ Servidor offline — rode: npm start', 5000);
    if (btn) { btn.textContent = 'Testar envio'; btn.disabled = false; }
  }

  setTimeout(() => {
    if (btn) { btn.textContent = 'Testar envio'; btn.disabled = false; btn.style.color = ''; }
  }, 4000);
}
