import type { Env, SafeUser } from '../types';
import { generateAssistantReply } from './ai';
import { addConversationMessage, getUserMemories, listRecentConversation, upsertMemory, upsertUser } from './db';

const skillButtons = [[{ text: 'Open Shemsi Mini App', web_app: { url: 'https://REPLACE_WITH_WORKER_HOST/mini-app' } }]];

async function telegram(env: Env, method: string, payload: Record<string, unknown>) {
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error('Telegram bot token is not configured');
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
  });
  if (!response.ok) console.error(`Telegram API error (${method}): ${response.status}`);
}

async function sendMessage(env: Env, chatId: string, text: string, keyboard?: unknown) {
  const chunks = text.match(/[\s\S]{1,4000}/g) ?? [''];
  for (let index = 0; index < chunks.length; index++) {
    await telegram(env, 'sendMessage', {
      chat_id: chatId, text: chunks[index],
      ...(keyboard && index === chunks.length - 1 ? { reply_markup: keyboard } : {}),
      disable_web_page_preview: true,
    });
  }
}

function commandText(text: string) { return text.trim().split(/\s+/)[0].split('@')[0].toLowerCase(); }

async function processMessage(text: string, env: Env, user: SafeUser, chatId: string, telegramUserId: string, webAppUrl?: string) {
  const record = await upsertUser(env.DB, user);
  if (!record) throw new Error('Could not create user record');
  const command = commandText(text);
  const miniAppUrl = webAppUrl || env.MINI_APP_URL;
  const keyboard = miniAppUrl ? { inline_keyboard: [[{ text: 'Open Shemsi AI', web_app: { url: miniAppUrl } }]] } : undefined;

  if (command === '/start' || command === '/help') {
    const welcome = `Welcome to Shemsi AI${user.firstName ? `, ${user.firstName}` : ''}!\n\nI’m your private AI assistant. Chat with me naturally, or use /memory, /forget, /skills, and /apps.\n\nYou can also open the dashboard for your chat, saved memory, and settings.`;
    await addConversationMessage(env.DB, record.id, chatId, 'assistant', welcome);
    await sendMessage(env, chatId, welcome, keyboard);
    return;
  }
  if (command === '/apps' || command === '/marketplace' || command === '/connect') {
    const response = 'App marketplace setup is not available yet. Shemsi will only list integrations after their secure authorization and actions are implemented; no accounts are connected by this command.';
    await sendMessage(env, chatId, response, keyboard);
    return;
  }
  if (command === '/skills') {
    const response = 'Available built-in skills: research planning, writing, summarization, and task planning. These use Workers AI and do not access external apps or the live web.';
    await sendMessage(env, chatId, response, keyboard);
    return;
  }
  if (command === '/memory') {
    const memories = await getUserMemories(env.DB, record.id);
    const response = memories.length ? `Your saved memories:\n${memories.map((item) => `• ${item.memory_value}`).join('\n')}` : 'Your memory is empty. Tell me “remember that …” to save a note. Use /forget to clear all saved memories.';
    await sendMessage(env, chatId, response, keyboard);
    return;
  }
  if (command === '/forget') {
    await env.DB.prepare('DELETE FROM memories WHERE user_id = ?1').bind(record.id).run();
    await sendMessage(env, chatId, 'Your saved memories have been deleted. Conversation history is separate.', keyboard);
    return;
  }

  if (!text.trim()) return;
  await addConversationMessage(env.DB, record.id, chatId, 'user', text.trim());
  const rememberMatch = text.trim().match(/^(?:please\s+)?remember(?:\s+that)?\s+(.+)$/i);
  if (rememberMatch) {
    await upsertMemory(env.DB, record.id, rememberMatch[1].slice(0, 1000), 'telegram');
  }
  const recent = await listRecentConversation(env.DB, record.id, 12);
  const memories = await getUserMemories(env.DB, record.id);
  const reply = await generateAssistantReply(env, text.trim(), recent, memories.map((item) => item.memory_value));
  await addConversationMessage(env.DB, record.id, chatId, 'assistant', reply);
  await sendMessage(env, chatId, reply, keyboard);
}

export async function handleTelegramUpdate(update: any, env: Env) {
  try {
    const message = update?.message;
    const webAppData = message?.web_app_data?.data;
    const text = typeof webAppData === 'string' ? webAppData : typeof message?.text === 'string' ? message.text : '';
    const telegramUser = message?.from;
    const chatId = message?.chat?.id;
    if (!telegramUser?.id || !chatId || !text) return;
    await processMessage(text, env, {
      telegramId: String(telegramUser.id), username: telegramUser.username,
      firstName: telegramUser.first_name, lastName: telegramUser.last_name,
      languageCode: telegramUser.language_code,
    }, String(chatId), String(telegramUser.id));
  } catch (error) {
    console.error('Telegram update processing failed', error instanceof Error ? error.message : 'Unknown error');
  }
}

export { processMessage };
