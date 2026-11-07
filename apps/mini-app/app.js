document.getElementById('themeToggle').addEventListener('click', () => {
  document.body.classList.toggle('light');
  const mode = document.body.classList.contains('light') ? 'Light' : 'Dark';
  document.getElementById('themeToggle').textContent = mode;
});

document.getElementById('sendButton').addEventListener('click', () => {
  const input = document.getElementById('messageInput');
  const value = input.value.trim();
  if (!value) return;

  const messagesEl = document.querySelector('.messages');
  const bubble = document.createElement('div');
  bubble.className = 'bubble user';
  bubble.textContent = value;
  messagesEl.appendChild(bubble);

  const reply = document.createElement('div');
  reply.className = 'bubble assistant';
  reply.textContent = 'I can help with that. I will route it through the correct app or workflow and ask for confirmation before any sensitive action.';
  messagesEl.appendChild(reply);

  input.value = '';
});
