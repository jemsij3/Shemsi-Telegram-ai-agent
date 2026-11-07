const tg = window.Telegram?.WebApp;
tg?.ready(); tg?.expand();
const initData = tg?.initData || '';
const headers = { 'content-type': 'application/json', authorization: `tma ${initData}` };
const skillsCatalog = [
  ['research-planning', 'Research planning', 'Turn a topic into a structured research plan. No live web search.'],
  ['writing', 'Writing', 'Draft, revise, and refine text with Shemsi AI.'],
  ['summarization', 'Summarization', 'Summarize text you provide in the conversation.'],
  ['task-planning', 'Task planning', 'Break goals into clear, practical next steps.'],
];
const views = [...document.querySelectorAll('.view')];
function navigate(name) { views.forEach(v => v.classList.toggle('active', v.id === name)); document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name)); }
document.querySelectorAll('.tab').forEach(button => button.addEventListener('click', () => navigate(button.dataset.view)));
document.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.open)));
document.querySelector('#theme').addEventListener('click', () => { document.body.classList.toggle('light'); localStorage.setItem('shemsi-theme', document.body.classList.contains('light') ? 'light' : 'dark'); });
if (localStorage.getItem('shemsi-theme') === 'light') document.body.classList.add('light');
async function api(path, options = {}) { const response = await fetch(path, { ...options, headers: { ...headers, ...(options.headers || {}) } }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Request failed'); return data; }
function addBubble(text, role) { const el = document.createElement('div'); el.className = role === 'user' ? 'user-bubble' : 'assistant-bubble'; el.textContent = text; document.querySelector('#messages').appendChild(el); el.scrollIntoView({ block: 'nearest' }); }
document.querySelector('#chat-form').addEventListener('submit', async event => { event.preventDefault(); const input = document.querySelector('#message'); const message = input.value.trim(); if (!message) return; addBubble(message, 'user'); input.value = ''; const button = document.querySelector('.send-btn'); button.disabled = true; const pending = document.createElement('div'); pending.className = 'assistant-bubble'; pending.textContent = 'Thinking…'; document.querySelector('#messages').appendChild(pending); try { const result = await api('/api/chat', { method: 'POST', body: JSON.stringify({ message }) }); pending.textContent = result.reply; } catch (error) { pending.textContent = error.message; } finally { button.disabled = false; } });
async function loadDashboard() {
  if (!initData) { document.querySelector('#memory-count').textContent = 'Open inside Telegram'; document.querySelector('#memory-list').innerHTML = '<div class="empty-state">Open this dashboard from the Shemsi Telegram bot to securely load your private data.</div>'; document.querySelector('#skills-list').innerHTML = '<div class="empty-state">Telegram authentication is required to manage your skills.</div>'; return; }
  try {
    const data = await api('/api/dashboard');
    document.querySelector('#memory-count').textContent = `${data.memories.length} saved`;
    const memoryList = document.querySelector('#memory-list');
    memoryList.replaceChildren();
    if (!data.memories.length) memoryList.innerHTML = '<div class="empty-state">No saved notes yet. Tell Shemsi “remember that…” in chat.</div>';
    data.memories.forEach(memory => { const card = document.createElement('div'); card.className = 'memory-card'; const p = document.createElement('p'); p.textContent = memory.value; const del = document.createElement('button'); del.className = 'delete-memory'; del.textContent = '×'; del.setAttribute('aria-label', 'Delete memory'); del.onclick = async () => { await api(`/api/memory/${encodeURIComponent(memory.id)}`, { method: 'DELETE' }); card.remove(); document.querySelector('#memory-count').textContent = `${document.querySelectorAll('.memory-card').length} saved`; }; card.append(p, del); memoryList.append(card); });
    const active = new Map(data.skills.map(skill => [skill.skill_id, !!skill.enabled]));
    const skillList = document.querySelector('#skills-list'); skillList.replaceChildren();
    skillsCatalog.forEach(([id, title, description]) => { const card = document.createElement('div'); card.className = 'skill-card'; const info = document.createElement('div'); const name = document.createElement('b'); name.textContent = title; const desc = document.createElement('p'); desc.textContent = description; info.append(name, desc); const toggle = document.createElement('input'); toggle.type = 'checkbox'; toggle.className = 'toggle'; toggle.checked = active.get(id) || false; toggle.setAttribute('aria-label', `Enable ${title}`); toggle.onchange = async () => { toggle.disabled = true; try { await api(`/api/skills/${id}`, { method: 'PUT', body: JSON.stringify({ enabled: toggle.checked }) }); } catch { toggle.checked = !toggle.checked; } finally { toggle.disabled = false; } }; card.append(info, toggle); skillList.append(card); });
  } catch (error) { document.querySelector('#memory-count').textContent = 'Unavailable'; document.querySelector('#memory-list').innerHTML = `<div class="empty-state">${error.message}</div>`; }
}
loadDashboard();
