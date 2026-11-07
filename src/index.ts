import type { Env } from './types';
import { handleTelegramUpdate } from './lib/bot';
import { authenticateMiniApp } from './lib/auth';
import { chat, getDashboard, setSkill, deleteMemory } from './lib/api';

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (request.method === 'GET' && url.pathname === '/api/health') {
        return json({ status: 'ok', app: 'Shemsi AI' });
      }

      if (request.method === 'POST' && url.pathname === '/telegram/webhook') {
        if (!env.TELEGRAM_SECRET_TOKEN || request.headers.get('x-telegram-bot-api-secret-token') !== env.TELEGRAM_SECRET_TOKEN) {
          return new Response('Unauthorized', { status: 401 });
        }
        if (!env.TELEGRAM_BOT_TOKEN || !env.DB) return new Response('Service not configured', { status: 503 });
        const update = await request.json();
        ctx.waitUntil(handleTelegramUpdate(update, env));
        return new Response('OK');
      }

      if (url.pathname.startsWith('/api/')) {
        if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
        const user = await authenticateMiniApp(request, env);
        if (!user) return json({ error: 'Telegram Mini App authentication required' }, 401);
        if (request.method === 'GET' && url.pathname === '/api/dashboard') return json(await getDashboard(env.DB, user.id));
        if (request.method === 'POST' && url.pathname === '/api/chat') {
          const body = await request.json().catch(() => null) as { message?: unknown } | null;
          if (typeof body?.message !== 'string' || !body.message.trim() || body.message.length > 4000) return json({ error: 'Message must be 1–4000 characters.' }, 400);
          return json({ reply: await chat(env, user, body.message.trim(), 'mini-app') });
        }
        if (request.method === 'PUT' && url.pathname.startsWith('/api/skills/')) {
          const skillId = url.pathname.slice('/api/skills/'.length);
          const body = await request.json().catch(() => null) as { enabled?: unknown } | null;
          if (typeof body?.enabled !== 'boolean') return json({ error: 'enabled must be a boolean.' }, 400);
          return json({ skill: await setSkill(env.DB, user.id, skillId, body.enabled) });
        }
        if (request.method === 'DELETE' && url.pathname.startsWith('/api/memory/')) {
          const memoryId = decodeURIComponent(url.pathname.slice('/api/memory/'.length));
          await deleteMemory(env.DB, user.id, memoryId);
          return json({ ok: true });
        }
        return json({ error: 'Not found' }, 404);
      }

      if (env.ASSETS) {
        if (request.method === 'GET' && (url.pathname === '/mini-app' || url.pathname === '/mini-app/')) {
          url.pathname = '/';
          return env.ASSETS.fetch(new Request(url, request));
        }
        return env.ASSETS.fetch(request);
      }
      return new Response('Shemsi AI is running. Open /mini-app in Telegram.', { status: 200 });
    } catch (error) {
      console.error('Request failed', error instanceof Error ? error.message : 'Unknown error');
      return json({ error: 'Something went wrong. Please try again.' }, 500);
    }
  },
};
