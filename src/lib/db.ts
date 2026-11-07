import type { Env, SafeUser } from '../types';

export async function upsertUser(db: D1Database, user: SafeUser) {
  const id = `tg_${user.telegramId}`;
  await db.prepare(`INSERT INTO users (id, telegram_id, username, first_name, last_name, language_code, onboarding_complete)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1)
    ON CONFLICT(telegram_id) DO UPDATE SET username = excluded.username, first_name = excluded.first_name,
      last_name = excluded.last_name, language_code = excluded.language_code, updated_at = CURRENT_TIMESTAMP`)
    .bind(id, user.telegramId, user.username ?? null, user.firstName ?? null, user.lastName ?? null, user.languageCode ?? null).run();
  return db.prepare('SELECT id FROM users WHERE telegram_id = ?1').bind(user.telegramId).first<{ id: string }>();
}

export async function addConversationMessage(db: D1Database, userId: string, chatId: string, role: 'user' | 'assistant', content: string) {
  await db.prepare('INSERT INTO conversations (id, user_id, chat_id, role, content) VALUES (?1, ?2, ?3, ?4, ?5)')
    .bind(crypto.randomUUID(), userId, chatId, role, content.slice(0, 4000)).run();
}

export async function listRecentConversation(db: D1Database, userId: string, limit = 12) {
  const rows = await db.prepare('SELECT role, content FROM conversations WHERE user_id = ?1 ORDER BY created_at DESC LIMIT ?2')
    .bind(userId, Math.min(Math.max(limit, 1), 30)).all<{ role: string; content: string }>();
  return rows.results.reverse();
}

export async function getUserMemories(db: D1Database, userId: string) {
  const rows = await db.prepare('SELECT id, memory_key, memory_value, source, created_at, updated_at FROM memories WHERE user_id = ?1 ORDER BY updated_at DESC LIMIT 100')
    .bind(userId).all<MemoryRow>();
  return rows.results;
}

export async function upsertMemory(db: D1Database, userId: string, value: string, source: string) {
  const clean = value.trim().slice(0, 1000);
  const key = crypto.randomUUID();
  await db.prepare('INSERT INTO memories (id, user_id, memory_key, memory_value, source) VALUES (?1, ?2, ?3, ?4, ?5)')
    .bind(key, userId, key, clean, source).run();
}
