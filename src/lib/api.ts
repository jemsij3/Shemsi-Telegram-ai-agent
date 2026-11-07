import type { Env, MemoryRow, SafeUser } from '../types';
import { authenticateMiniApp } from './auth';
import { addConversationMessage, getUserMemories, listRecentConversation, upsertMemory, upsertUser } from './db';
import { generateAssistantReply } from './ai';

export async function chat(env: Env, user: { id: string }, message: string, chatId: string) {
  const recent = await listRecentConversation(env.DB, user.id, 12);
  await addConversationMessage(env.DB, user.id, chatId, 'user', message);
  const memories = await getUserMemories(env.DB, user.id);
  const rememberMatch = message.match(/^(?:please\s+)?remember(?:\s+that)?\s+(.+)$/i);
  if (rememberMatch) await upsertMemory(env.DB, user.id, rememberMatch[1].slice(0, 1000), 'mini-app');
  const reply = await generateAssistantReply(env, message, [...recent, { role: 'user', content: message }], memories.map((item) => item.memory_value));
  await addConversationMessage(env.DB, user.id, chatId, 'assistant', reply);
  return reply;
}

export async function getDashboard(db: D1Database, userId: string) {
  const [messages, memories, skills, tasks] = await Promise.all([
    db.prepare('SELECT role, content, created_at FROM conversations WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 30').bind(userId).all<{ role: string; content: string; created_at: string }>(),
    getUserMemories(db, userId),
    db.prepare('SELECT skill_id, enabled FROM skills WHERE user_id = ?1 ORDER BY skill_id').bind(userId).all<{ skill_id: string; enabled: number }>(),
    db.prepare('SELECT id, title, type, status, created_at FROM tasks WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 20').bind(userId).all(),
  ]);
  return {
    conversations: messages.results.reverse(),
    memories: memories.map((memory: MemoryRow) => ({ id: memory.id, value: memory.memory_value, created_at: memory.created_at })),
    skills: skills.results,
    tasks: tasks.results,
    integrations: [],
    marketplaceNote: 'No third-party integrations are currently active. They will appear here only after a real connection flow is implemented.',
  };
}

export async function setSkill(db: D1Database, userId: string, skillId: string, enabled: boolean) {
  const allowed = new Set(['research-planning', 'writing', 'summarization', 'task-planning']);
  if (!allowed.has(skillId)) throw new Error('Unknown skill');
  await db.prepare(`INSERT INTO skills (id, user_id, skill_id, enabled, config, created_at)
    VALUES (?1, ?2, ?3, ?4, NULL, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, skill_id) DO UPDATE SET enabled = excluded.enabled`).bind(crypto.randomUUID(), userId, skillId, enabled ? 1 : 0).run();
  return { id: skillId, enabled };
}

export async function deleteMemory(db: D1Database, userId: string, memoryId: string) {
  await db.prepare('DELETE FROM memories WHERE id = ?1 AND user_id = ?2').bind(memoryId, userId).run();
}
