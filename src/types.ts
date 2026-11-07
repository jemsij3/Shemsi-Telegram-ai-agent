export type UserRecord = {
  id: string;
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  languageCode?: string;
  onboardingComplete: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ConversationMessage = {
  id: string;
  userId: string;
  chatId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

export type MemoryItem = {
  id: string;
  userId: string;
  key: string;
  value: string;
  source: string;
  createdAt: string;
  updatedAt: string;
};

export type ConnectedApp = {
  id: string;
  userId: string;
  appId: string;
  kind: 'oauth' | 'api-key' | 'mcp' | 'native' | 'custom';
  status: 'connected' | 'disconnected' | 'pending';
  authData?: string;
  scopes?: string;
  createdAt: string;
  updatedAt: string;
};

export type Skill = {
  id: string;
  userId: string;
  skillId: string;
  enabled: boolean;
  config?: string;
  createdAt: string;
};

export type TaskRecord = {
  id: string;
  userId: string;
  title: string;
  type: 'scheduled' | 'recurring' | 'reminder' | 'background';
  status: 'queued' | 'running' | 'completed' | 'failed';
  schedule?: string;
  payload?: string;
  output?: string;
  createdAt: string;
  updatedAt: string;
};

export type Env = {
  DB: D1Database;
  FILES: R2Bucket;
  AI: any;
  APP_NAME?: string;
  APP_BRAND?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_SECRET_TOKEN?: string;
  DEFAULT_MODEL?: string;
};
