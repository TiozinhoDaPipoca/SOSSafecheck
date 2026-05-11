/* SafeCheck SOS — history.js */
function renderHistory() {
  const list = document.getElementById('history-list');
  if (!list) return;
  if (!historyData.length) { list.innerHTML='<div class="empty-state"><div class="empty-state-icon">📋</div><p>Nenhum evento ainda.</p></div>'; return; }
  const tagClass = {'Ativo':'tag-red','Cancelado':'tag-teal','Ok':'tag-teal'};
  list.innerHTML = historyData.map(item => `
    <div class="hist-item">
      <div class="hist-icon ${item.type==='sos'?'hi-red':'hi-teal'}">${item.type==='sos'?'🆘':'✅'}</div>
      <div class="hist-info">
        <div class="hist-title">${escapeHtml(item.title)}</div>
        <div class="hist-sub">${escapeHtml(item.sub)}</div>
        <span class="hist-tag ${tagClass[item.tag]||'tag-teal'}">${escapeHtml(item.tag)}</span>
      </div>
      <div class="hist-time">${escapeHtml(item.time)}</div>
    </div>`).join('');
}
