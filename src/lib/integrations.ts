export const appCatalog = [
  {
    id: 'github',
    label: 'GitHub',
    category: 'Developer',
    description: 'Repository search, issue summaries, and scheduled code task coordination.',
    authType: 'oauth',
    scopes: ['repo', 'read:user'],
    implemented: true,
  },
  {
    id: 'gmail',
    label: 'Gmail',
    category: 'Productivity',
    description: 'Read labels, drafts, and follow-up summaries from your inbox.',
    authType: 'oauth',
    scopes: ['mail.read', 'mail.send'],
    implemented: true,
  },
  {
    id: 'google-calendar',
    label: 'Google Calendar',
    category: 'Scheduling',
    description: 'Create events, manage reminders, and check your schedule.',
    authType: 'oauth',
    scopes: ['calendar.events'],
    implemented: true,
  },
  {
    id: 'notion',
    label: 'Notion',
    category: 'Workspace',
    description: 'Create notes, organize projects, and maintain operational knowledge.',
    authType: 'api-key',
    scopes: ['read_content', 'write_content'],
    implemented: true,
  },
  {
    id: 'custom-api',
    label: 'Custom API',
    category: 'Automation',
    description: 'Connect a custom REST endpoint or MCP-compatible API.',
    authType: 'custom',
    scopes: ['read', 'write'],
    implemented: true,
  },
];

export function getAppCatalog() {
  return appCatalog.filter((app) => app.implemented);
}

export function buildAuthUrl(appId: string, userId: string) {
  const base = 'https://shemsi-ai.example/auth';
  const params = new URLSearchParams({
    app: appId,
    user: userId,
    redirect: 'https://shemsi-ai.example/connect/callback',
  });

  return `${base}?${params.toString()}`;
}
