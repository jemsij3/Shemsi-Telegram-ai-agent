import type { ConnectedApp, ConversationMessage, MemoryItem, Skill, TaskRecord, UserRecord } from '../types';

const makeId = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

export async function upsertUser(db: D1Database, telegramUser: {
  id: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
}) {
  const existing = await db.prepare('SELECT * FROM users WHERE telegram_id = ?1').bind(telegramUser.id).first<UserRecord>();

  if (existing) {
    const updated = await db.prepare(`
      UPDATE users
      SET username = ?, first_name = ?, last_name = ?, language_code = ?, updated_at = CURRENT_TIMESTAMP
      WHERE telegram_id = ?
    `).bind(
      telegramUser.username ?? null,
      telegramUser.first_name ?? null,
      telegramUser.last_name ?? null,
      telegramUser.language_code ?? null,
      telegramUser.id,
    ).run();

    return await db.prepare('SELECT * FROM users WHERE telegram_id = ?1').bind(telegramUser.id).first<UserRecord>();
  }

  const id = makeId('user');
  await db.prepare(`
    INSERT INTO users (id, telegram_id, username, first_name, last_name, language_code, onboarding_complete, created_at, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).bind(
    id,
    telegramUser.id,
    telegramUser.username ?? null,
    telegramUser.first_name ?? null,
    telegramUser.last_name ?? null,
    telegramUser.language_code ?? null,
  ).run();

  return await db.prepare('SELECT * FROM users WHERE telegram_id = ?1').bind(telegramUser.id).first<UserRecord>();
}

export async function addConversationMessage(db: D1Database, userId: string, chatId: string, role: 'user' | 'assistant', content: string) {
  const id = makeId('msg');
  await db.prepare(`
    INSERT INTO conversations (id, user_id, chat_id, role, content, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5, CURRENT_TIMESTAMP)
  `).bind(id, userId, chatId, role, content).run();
}

export async function listRecentConversation(db: D1Database, userId: string, limit = 10) {
  const rows = await db.prepare(`
    SELECT * FROM conversations
    WHERE user_id = ?1
    ORDER BY created_at DESC
    LIMIT ?2
  `).bind(userId, limit).all<ConversationMessage>();

  return rows.results.reverse();
}

export async function upsertMemory(db: D1Database, userId: string, key: string, value: string, source = 'user') {
  const existing = await db.prepare('SELECT * FROM memories WHERE user_id = ?1 AND memory_key = ?2').bind(userId, key).first<MemoryItem>();

  if (existing) {
    await db.prepare(`
      UPDATE memories
      SET memory_value = ?, source = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?1
    `).bind(value, source, existing.id).run();
    return existing;
  }

  const id = makeId('mem');
  await db.prepare(`
    INSERT INTO memories (id, user_id, memory_key, memory_value, source, created_at, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).bind(id, userId, key, value, source).run();

  return await db.prepare('SELECT * FROM memories WHERE id = ?1').bind(id).first<MemoryItem>();
}

export async function getUserMemories(db: D1Database, userId: string) {
  const rows = await db.prepare('SELECT * FROM memories WHERE user_id = ?1 ORDER BY updated_at DESC').bind(userId).all<MemoryItem>();
  return rows.results;
}

export async function upsertConnectedApp(db: D1Database, userId: string, appId: string, kind: 'oauth' | 'api-key' | 'mcp' | 'native' | 'custom', status: 'connected' | 'disconnected' | 'pending', authData?: string, scopes?: string) {
  const current = await db.prepare('SELECT * FROM connected_apps WHERE user_id = ?1 AND app_id = ?2').bind(userId, appId).first<ConnectedApp>();

  if (current) {
    await db.prepare(`
      UPDATE connected_apps
      SET kind = ?, status = ?, auth_data = ?, scopes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?1
    `).bind(kind, status, authData ?? current.authData ?? null, scopes ?? current.scopes ?? null, current.id).run();
    return current;
  }

  const id = makeId('app');
  await db.prepare(`
    INSERT INTO connected_apps (id, user_id, app_id, kind, status, auth_data, scopes, created_at, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).bind(id, userId, appId, kind, status, authData ?? null, scopes ?? null).run();

  return await db.prepare('SELECT * FROM connected_apps WHERE id = ?1').bind(id).first<ConnectedApp>();
}

export async function getConnectedApps(db: D1Database, userId: string) {
  const rows = await db.prepare('SELECT * FROM connected_apps WHERE user_id = ?1 ORDER BY updated_at DESC').bind(userId).all<ConnectedApp>();
  return rows.results;
}

export async function createSkill(db: D1Database, userId: string, skillId: string, enabled = true, config?: string) {
  const existing = await db.prepare('SELECT * FROM skills WHERE user_id = ?1 AND skill_id = ?2').bind(userId, skillId).first<Skill>();

  if (existing) {
    await db.prepare(`
      UPDATE skills
      SET enabled = ?, config = ?, created_at = CURRENT_TIMESTAMP
      WHERE id = ?1
    `).bind(enabled ? 1 : 0, config ?? existing.config ?? null, existing.id).run();
    return existing;
  }

  const id = makeId('skill');
  await db.prepare(`
    INSERT INTO skills (id, user_id, skill_id, enabled, config, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5, CURRENT_TIMESTAMP)
  `).bind(id, userId, skillId, enabled ? 1 : 0, config ?? null).run();

  return await db.prepare('SELECT * FROM skills WHERE id = ?1').bind(id).first<Skill>();
}

export async function getSkills(db: D1Database, userId: string) {
  const rows = await db.prepare('SELECT * FROM skills WHERE user_id = ?1 ORDER BY created_at DESC').bind(userId).all<Skill>();
  return rows.results;
}

export async function createTask(db: D1Database, userId: string, title: string, type: 'scheduled' | 'recurring' | 'reminder' | 'background', status: 'queued' | 'running' | 'completed' | 'failed' = 'queued', schedule?: string, payload?: string, output?: string) {
  const id = makeId('task');
  await db.prepare(`
    INSERT INTO tasks (id, user_id, title, type, status, schedule, payload, output, created_at, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).bind(id, userId, title, type, status, schedule ?? null, payload ?? null, output ?? null).run();

  return await db.prepare('SELECT * FROM tasks WHERE id = ?1').bind(id).first<TaskRecord>();
}

export async function listTasks(db: D1Database, userId: string, limit = 20) {
  const rows = await db.prepare('SELECT * FROM tasks WHERE user_id = ?1 ORDER BY created_at DESC LIMIT ?2').bind(userId, limit).all<TaskRecord>();
  return rows.results;
}
