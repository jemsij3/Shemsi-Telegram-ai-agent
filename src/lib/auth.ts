import type { Env, SafeUser } from '../types';

async function hmac(key: CryptoKey, data: string): Promise<ArrayBuffer> {
  return crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
}

const hex = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');

export async function verifyTelegramInitData(initData: string, botToken: string): Promise<SafeUser | null> {
  if (!initData || initData.length > 8192) return null;
  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  const authDate = Number(params.get('auth_date'));
  const userJson = params.get('user');
  if (!receivedHash || !/^[a-f0-9]{64}$/i.test(receivedHash) || !Number.isFinite(authDate) || !userJson) return null;
  const now = Math.floor(Date.now() / 1000);
  if (authDate > now + 60 || now - authDate > 86400) return null;

  params.delete('hash');
  const dataCheckString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('\n');
  const secretKey = await crypto.subtle.importKey('raw', new TextEncoder().encode('WebAppData'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const secret = await hmac(secretKey, botToken);
  const signingKey = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = hex(await hmac(signingKey, dataCheckString));
  if (expected.length !== receivedHash.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ receivedHash.toLowerCase().charCodeAt(i);
  if (diff !== 0) return null;

  try {
    const user = JSON.parse(userJson) as { id?: number; username?: string; first_name?: string; last_name?: string; language_code?: string };
    if (!Number.isSafeInteger(user.id) || !user.id || user.id < 1) return null;
    return { telegramId: String(user.id), username: user.username, firstName: user.first_name, lastName: user.last_name, languageCode: user.language_code };
  } catch {
    return null;
  }
}

export async function authenticateMiniApp(request: Request, env: Env): Promise<{ id: string } | null> {
  const authorization = request.headers.get('authorization') || '';
  const initData = authorization.startsWith('tma ') ? authorization.slice(4) : '';
  if (!env.TELEGRAM_BOT_TOKEN || !initData || !env.DB) return null;
  const telegramUser = await verifyTelegramInitData(initData, env.TELEGRAM_BOT_TOKEN);
  if (!telegramUser) return null;
  const user = await env.DB.prepare('SELECT id FROM users WHERE telegram_id = ?1').bind(telegramUser.telegramId).first<{ id: string }>();
  return user ?? null;
}
