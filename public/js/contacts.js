/* =============================================
   SafeCheck SOS — contacts.js
   ============================================= */

const AVATAR_CLASSES = ['av-pink', 'av-teal', 'av-red', 'av-gray'];

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
}

function renderContacts() {
  const list = document.getElementById('contacts-list');
  if (!list) return;

  if (contacts.length === 0) {
    list.innerHTML = `<div class="empty-contacts"><div style="font-size:34px;margin-bottom:10px">👥</div><p>Nenhum contato cadastrado ainda.</p></div>`;
    return;
  }

  list.innerHTML = contacts.map((c, i) => {
    const avClass = AVATAR_CLASSES[i % AVATAR_CLASSES.length];
    const hasId   = !!c.telegramChatId;
    return `
      <div class="contact-card">
        <div class="contact-avatar ${avClass}">${getInitials(c.name)}</div>
        <div class="contact-info">
          <div class="contact-name">${escapeHtml(c.name)}</div>
          <div class="contact-phone">${escapeHtml(c.phone)}</div>
          <span class="contact-tag ${hasId ? 'tag-ok' : 'tag-warn'}">
            ${hasId ? '🤖 Telegram configurado' : '⚠️ Chat ID pendente'}
          </span>
        </div>
        <button class="del-btn" onclick="deleteContact(${i})">✕</button>
      </div>`;
  }).join('');
}

function addContact() {
  const name     = document.getElementById('inp-name').value.trim();
  const phone    = document.getElementById('inp-phone').value.trim();
  const rel      = document.getElementById('inp-rel').value.trim();
  const chatId   = document.getElementById('inp-chatid').value.trim();

  if (!name)  { showToast('⚠️ Informe o nome');     return; }
  if (!phone) { showToast('⚠️ Informe o telefone'); return; }

  const dup = contacts.some(c => c.phone.replace(/\D/g,'') === phone.replace(/\D/g,''));
  if (dup) { showToast('⚠️ Telefone já cadastrado'); return; }

  addContactData(name, phone, rel || 'Contato', chatId);
  renderContacts();

  document.getElementById('inp-name').value   = '';
  document.getElementById('inp-phone').value  = '';
  document.getElementById('inp-rel').value    = '';
  document.getElementById('inp-chatid').value = '';

  showToast(chatId ? '✅ Contato salvo com Telegram!' : '✅ Contato salvo! Adicione o Chat ID para alertas.');
}

function deleteContact(index) {
  const name = contacts[index]?.name || 'Contato';
  removeContactData(index);
  renderContacts();
  showToast(`🗑️ "${name}" removido`);
}
