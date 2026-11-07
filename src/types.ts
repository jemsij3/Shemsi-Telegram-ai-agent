export type Env = {
  DB: D1Database;
  AI?: Ai;
  ASSETS?: Fetcher;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_SECRET_TOKEN?: string;
  DEFAULT_MODEL?: string;
  MINI_APP_URL?: string;
};
export type SafeUser = { telegramId: string; username?: string; firstName?: string; lastName?: string; languageCode?: string };
export type MemoryRow = { id: string; memory_key: string; memory_value: string; source: string; created_at: string; updated_at: string };
