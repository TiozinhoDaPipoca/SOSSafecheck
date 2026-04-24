/* =============================================
   SafeCheck SOS — data.js
   ============================================= */

let contacts    = JSON.parse(localStorage.getItem('safecheck_contacts') || '[]');
let historyData = JSON.parse(localStorage.getItem('safecheck_history')  || '[]');
let settings    = JSON.parse(localStorage.getItem('safecheck_settings') || JSON.stringify({
  audio: true, gps: true, volume: true, sound: true
}));

if (contacts.length === 0) {
  contacts = [
    { name: 'Maria Silva',  phone: '(21) 98765-4321', rel: 'Mãe',   telegramChatId: '' },
    { name: 'Carla Mendes', phone: '(21) 91234-5678', rel: 'Amiga', telegramChatId: '' },
  ];
  saveContacts();
}

function saveContacts() {
  localStorage.setItem('safecheck_contacts', JSON.stringify(contacts));
}

function saveHistory() {
  localStorage.setItem('safecheck_history', JSON.stringify(historyData));
}

function saveSetting(key, value) {
  settings[key] = value;
  localStorage.setItem('safecheck_settings', JSON.stringify(settings));
}

function addContactData(name, phone, rel, telegramChatId) {
  contacts.push({ name, phone, rel, telegramChatId });
  saveContacts();
}

function removeContactData(index) {
  contacts.splice(index, 1);
  saveContacts();
}

function addHistoryEntry(type, title, sub, tag) {
  const now = new Date();
  const hh  = String(now.getHours()).padStart(2,'0');
  const mm  = String(now.getMinutes()).padStart(2,'0');
  const dd  = now.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' });
  historyData.unshift({ type, title, sub, time:`${dd} ${hh}:${mm}`, tag });
  if (historyData.length > 50) historyData.pop();
  saveHistory();
}

function updateLastHistoryTag(tag) {
  if (historyData.length > 0) { historyData[0].tag = tag; saveHistory(); }
}
