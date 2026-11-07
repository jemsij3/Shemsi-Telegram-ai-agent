import { getAppCatalog } from './integrations';
import { generateAssistantReply } from './ai';
import { addConversationMessage, createSkill, createTask, getConnectedApps, getSkills, getUserMemories, listRecentConversation, upsertConnectedApp, upsertMemory, upsertUser } from './db';

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

async function handleTelegramWebhook(request: Request, env: any) {
  const secretToken = env.TELEGRAM_SECRET_TOKEN;
  const secretHeader = request.headers.get('x-telegram-bot-api-secret-token');

  if (secretToken && secretHeader !== secretToken) {
    return new Response('Unauthorized', { status: 401 });
  }

  const update = await request.json();
  const message = update?.message;

  if (!message) {
    return new Response('OK');
  }

  const telegramUser = message.from;
  const chatId = String(message.chat.id);
  const text = (message.text || '').trim();
  const userRecord = await upsertUser(env.DB, telegramUser);

  if (!userRecord) {
    return new Response('OK');
  }

  const userId = userRecord.id;
  const command = text.toLowerCase();

  if (command === '/start' || command === '/help') {
    const welcome = `Welcome to Shemsi AI 👋\n\nI can help with personal tasks, research, app actions, automations, and memory.\n\nTry:\n- /marketplace\n- /apps\n- /skills\n- /memory\n- /task "Plan my week"\n- /connect github`;

    await addConversationMessage(env.DB, userId, chatId, 'assistant', welcome);
    await upsertMemory(env.DB, userId, 'onboarding_done', 'true', 'system');

    return new Response('OK', { headers: { 'content-type': 'application/json' } });
  }

  if (command === '/marketplace' || command === '/apps') {
    const catalog = getAppCatalog();
    const response = `Shemsi App Marketplace\n\n${catalog.map((app) => `• ${app.label} — ${app.category}`).join('\n')}\n\nUse /connect <app> to begin. Example: /connect github`;
    await addConversationMessage(env.DB, userId, chatId, 'assistant', response);
    return new Response('OK', { headers: { 'content-type': 'application/json' } });
  }

  if (command.startsWith('/connect ')) {
    const requested = command.replace('/connect ', '').trim();
    const app = getAppCatalog().find((entry) => entry.id.toLowerCase() === requested.toLowerCase() || entry.label.toLowerCase() === requested.toLowerCase());

    if (!app) {
      const response = 'I could not find that app. Try /apps or /marketplace to see available integrations.';
      await addConversationMessage(env.DB, userId, chatId, 'assistant', response);
      return new Response('OK');
    }

    const authUrl = `https://shemsi-ai.example/connect/${app.id}?user=${encodeURIComponent(userId)}`;
    const response = `Connecting ${app.label}\n\nUse this secure authorization link:\n${authUrl}\n\nI will keep the connection private and ask for confirmation before any sensitive action.`;
    await addConversationMessage(env.DB, userId, chatId, 'assistant', response);
    await upsertConnectedApp(env.DB, userId, app.id, app.authType, 'pending', JSON.stringify({ authUrl }));
    return new Response('OK');
  }

  if (command.startsWith('/task ')) {
    const payload = text.replace('/task ', '').trim();
    await createTask(env.DB, userId, payload, 'background', 'queued', 'manual', JSON.stringify({ payload }));
    const response = `Task queued: ${payload}\n\nShemsi will process it in the background and keep a record in your task history.`;
    await addConversationMessage(env.DB, userId, chatId, 'assistant', response);
    return new Response('OK');
  }

  if (command === '/skills') {
    const skills = await getSkills(env.DB, userId);
    const response = skills.length > 0
      ? `Your active skills:\n${skills.map((skill) => `• ${skill.skillId}`).join('\n')}`
      : 'No skills are enabled yet. Skills marketplace is ready to add research, writing, and productivity tools.';
    await addConversationMessage(env.DB, userId, chatId, 'assistant', response);
    return new Response('OK');
  }

  if (command === '/memory') {
    const memories = await getUserMemories(env.DB, userId);
    const response = memories.length > 0
      ? `Stored memory:\n${memories.map((memory) => `• ${memory.key}: ${memory.value}`).join('\n')}`
      : 'No personal memory is stored yet. I will remember your preferences and ongoing projects after you tell me about them.';
    await addConversationMessage(env.DB, userId, chatId, 'assistant', response);
    return new Response('OK');
  }

  await addConversationMessage(env.DB, userId, chatId, 'user', text);

  if (text) {
    const recentMessages = await listRecentConversation(env.DB, userId, 6);
    const reply = await generateAssistantReply(env, text, {
      userId,
      username: telegramUser.username,
      recentMessages,
    });

    await addConversationMessage(env.DB, userId, chatId, 'assistant', reply);

    if (text.toLowerCase().includes('remember') || text.toLowerCase().includes('prefer')) {
      const memoryKey = 'user_preference';
      await upsertMemory(env.DB, userId, memoryKey, text, 'user');
    }

    if (text.toLowerCase().includes('github')) {
      await upsertConnectedApp(env.DB, userId, 'github', 'oauth', 'pending', JSON.stringify({ status: 'authorization_requested' }));
    }

    if (text.toLowerCase().includes('gmail')) {
      await upsertConnectedApp(env.DB, userId, 'gmail', 'oauth', 'pending', JSON.stringify({ status: 'authorization_requested' }));
    }

    if (text.toLowerCase().includes('calendar')) {
      await upsertConnectedApp(env.DB, userId, 'google-calendar', 'oauth', 'pending', JSON.stringify({ status: 'authorization_requested' }));
    }

    if (text.toLowerCase().includes('skill') || text.toLowerCase().includes('research') || text.toLowerCase().includes('write')) {
      await createSkill(env.DB, userId, 'research-assistant', true, JSON.stringify({ enabled: true }));
    }
  }

  return new Response('OK');
}

async function handleApiRoutes(request: Request, env: any) {
  const url = new URL(request.url);

  if (url.pathname === '/api/health') {
    return Response.json({ status: 'ok', app: env.APP_NAME || 'Shemsi AI' });
  }

  if (url.pathname === '/api/app-marketplace') {
    return Response.json({ items: getAppCatalog() });
  }

  if (url.pathname === '/api/dashboard') {
    const userId = url.searchParams.get('user') || 'demo-user';
    const connectedApps = await getConnectedApps(env.DB, userId);
    const skills = await getSkills(env.DB, userId);
    const memories = await getUserMemories(env.DB, userId);
    return Response.json({
      appName: env.APP_NAME || 'Shemsi AI',
      connectedApps,
      skills,
      memories,
      tasks: [],
    });
  }

  if (url.pathname.startsWith('/api/user/')) {
    const telegramId = url.pathname.split('/').at(-1);
    if (!telegramId) {
      return Response.json({ error: 'Missing telegram user id' }, { status: 400 });
    }

    const user = await env.DB.prepare('SELECT * FROM users WHERE telegram_id = ?1').bind(telegramId).first();
    const apps = await getConnectedApps(env.DB, user?.id || '');
    return Response.json({ user, apps, ok: Boolean(user) });
  }

  if (url.pathname === '/api/mini-app') {
    return new Response(`<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Shemsi AI</title><style>${miniAppStyles}</style></head><body><div id="app"></div><script>${miniAppScript}</script></body></html>`, {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}

export default {
  async fetch(request: Request, env: any, ctx: any) {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/telegram/webhook') {
      return handleTelegramWebhook(request, env);
    }

    if (url.pathname.startsWith('/api/')) {
      return handleApiRoutes(request, env);
    }

    if (url.pathname === '/' || url.pathname === '/mini-app') {
      return new Response(`<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Shemsi AI</title><style>${miniAppStyles}</style></head><body><div id="app"></div><script>${miniAppScript}</script></body></html>`, {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }

    return new Response('Shemsi AI is running.', { status: 200 });
  },
};

const miniAppStyles = `
  :root {
    --bg: #0b1020;
    --panel: #121a2d;
    --panel-alt: #1a2441;
    --primary: #7c5cff;
    --secondary: #2dd4bf;
    --text: #edf2ff;
    --muted: #9aa8bf;
    --border: rgba(255,255,255,0.08);
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; font-family: Inter, sans-serif; background: linear-gradient(180deg, #0b1020 0%, #111827 100%); color: var(--text);
  }
  .shell {
    max-width: 440px; margin: 0 auto; padding: 24px 18px 50px;
  }
  .topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
  .brand { font-size: 1.3rem; font-weight: 800; letter-spacing: 0.06em; }
  .chip { background: rgba(124,92,255,0.18); color: #d7ceff; border: 1px solid rgba(124,92,255,0.33); padding: 6px 10px; border-radius: 999px; font-size: 0.72rem; }
  .card { background: rgba(18,26,45,0.9); border: 1px solid var(--border); border-radius: 18px; padding: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.2); }
  .grid { display: grid; gap: 12px; }
  .action { background: linear-gradient(135deg, var(--primary), #5b81ff); border: none; border-radius: 12px; color: white; padding: 12px 14px; font-weight: 700; }
  .section { margin-top: 18px; }
  .label { color: var(--muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 10px; }
  .list { display: grid; gap: 10px; }
  .item { display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; border-radius: 12px; background: var(--panel-alt); border: 1px solid var(--border); }
  .status { color: var(--secondary); font-weight: 700; }
  .chatBox { min-height: 180px; display: flex; flex-direction: column; gap: 10px; }
  .bubble { max-width: 82%; padding: 10px 12px; border-radius: 12px; font-size: 0.93rem; }
  .bubble.user { align-self: flex-end; background: rgba(124,92,255,0.18); border: 1px solid rgba(124,92,255,0.25); }
  .bubble.assistant { align-self: flex-start; background: rgba(45,212,191,0.14); border: 1px solid rgba(45,212,191,0.2); }
  input, textarea { width: 100%; border-radius: 12px; border: 1px solid var(--border); background: #0e1529; color: var(--text); padding: 12px 14px; }
`;

const miniAppScript = `
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="shell">
      <div class="topbar">
        <div class="brand">SHEMSI</div>
        <div class="chip">Personal AI</div>
      </div>

      <div class="card grid">
        <div class="label">Home</div>
        <button class="action">Ask Shemsi</button>
        <div class="list">
          <div class="item"><span>Tasks</span><span class="status">3 active</span></div>
          <div class="item"><span>Connected apps</span><span class="status">4</span></div>
          <div class="item"><span>Memory</span><span class="status">Synced</span></div>
        </div>
      </div>

      <div class="section card chatBox">
        <div class="label">AI Chat</div>
        <div class="bubble assistant">Hi! I can help you plan work, manage apps, and automate tasks.</div>
        <div class="bubble user">Connect my GitHub account.</div>
        <div class="bubble assistant">I can start the GitHub OAuth flow and keep a private record of the connection.</div>
        <input placeholder="Type a message to Shemsi…" />
      </div>

      <div class="section card">
        <div class="label">Marketplace</div>
        <div class="list">
          <div class="item"><span>GitHub</span><span class="status">OAuth</span></div>
          <div class="item"><span>Gmail</span><span class="status">OAuth</span></div>
          <div class="item"><span>Notion</span><span class="status">API Key</span></div>
        </div>
      </div>
    </div>
  `;
`;

export { handleTelegramWebhook };
