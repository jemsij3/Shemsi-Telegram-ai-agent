# Shemsi AI deployment review and setup

Shemsi AI is a Cloudflare Worker with a Telegram webhook and a Telegram Mini App. The current working features are Telegram chat, Workers AI replies, D1 conversation history and private memory, and built-in prompt skills. It does not currently execute scheduled tasks, perform live web search, read uploaded files, or connect third-party apps.

## Cloudflare configuration

- Worker entry point: `src/index.ts` (`npm run deploy` invokes Wrangler).
- Workers AI binding: `AI`, configured in `wrangler.toml` and called as `env.AI.run(...)` in `src/lib/ai.ts`.
- D1 binding: `DB`, configured in `wrangler.toml`; schema migration: `migrations/0001_initial.sql`.
- Static assets binding: `ASSETS`, serves `public/`; `/mini-app` is internally mapped to the static root.
- There are no R2 buckets, Queues, or Workflows configured or used by the current code.
- No Gemini, Google AI Studio, or Google AI API dependencies are used. The Google Calendar/Gmail references in the older `src/db/schema.sql` are not active integrations; the canonical deployment migration is under `migrations/`.

## Required Cloudflare configuration

### Bindings

| Binding | Type | Required configuration |
| --- | --- | --- |
| `AI` | Workers AI | Configured by `[ai] binding = "AI"` in `wrangler.toml`; enable Workers AI for the Cloudflare account. |
| `DB` | D1 | Create a dedicated D1 database and replace `REPLACE_WITH_D1_DATABASE_ID` in `wrangler.toml` with its real database ID. |
| `ASSETS` | Static assets | Configured to serve `./public` in `wrangler.toml`. |

### Variables and secrets

| Name | Kind | Required? | Purpose |
| --- | --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | Worker secret | Required | Token for the newly created Shemsi Telegram bot. |
| `TELEGRAM_SECRET_TOKEN` | Worker secret | Required | Random webhook secret; must match the value sent when registering Telegram's webhook. |
| `DEFAULT_MODEL` | Wrangler variable | Optional | Workers AI model; default is `@cf/meta/llama-3.1-8b-instruct`. |
| `MINI_APP_URL` | Worker secret or variable | Optional for bot replies; set to `https://<worker-host>/mini-app` to show the Mini App button. | Full HTTPS Mini App URL. |

The D1 database ID is a required Wrangler resource identifier, not a secret or environment variable. Do not invent it; obtain it from the `wrangler d1 create` output.

## Deploy checklist

Do not deploy until the D1 ID placeholder has been replaced and both Telegram secrets have been set.

```sh
npm install
npx wrangler login
npx wrangler d1 create shemsi-ai-db
# Copy the returned database_id into wrangler.toml
npx wrangler d1 migrations apply shemsi-ai-db --remote
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_SECRET_TOKEN
npx wrangler secret put MINI_APP_URL
npm run typecheck
npm test
npm run deploy
```

`MINI_APP_URL` is optional; omit its secret command if you don't need the bot's inline Mini App button. A local `.dev.vars` file may be used for local secrets; it is ignored by Git.

After deployment, set the webhook, substituting your actual new token, Worker URL, and the same webhook secret configured above:

```sh
curl -X POST "https://api.telegram.org/bot<NEW_BOT_TOKEN>/setWebhook" \
  -d "url=https://<WORKER_HOST>/telegram/webhook" \
  -d "secret_token=<WEBHOOK_SECRET>" \
  -d 'allowed_updates=["message"]'
```

The exact webhook endpoint is `POST /telegram/webhook`. Check `/api/health`, message the new bot with `/start`, and open `/mini-app` from Telegram to test authenticated dashboard access.

## Commands

- `npm run dev` — local Wrangler Worker development server.
- `npm run deploy` — deploy with Wrangler.
- `npm run db:create` — create the named D1 database.
- `npm run db:migrate` — apply migrations remotely.
- `npm run typecheck` — TypeScript check (`tsc --noEmit`).
- `npm test` — Node's test runner; no test files are currently included, so this is not meaningful feature validation yet.

## Limits and safety

Only the Telegram bot token, webhook token, and optional Mini App URL are runtime configuration values for this version. App marketplace OAuth credentials, R2 storage, Queues, and Workflows are not configured. Do not advertise integrations as usable until their authorization and action handlers exist. Do not commit bot tokens, `.dev.vars`, or real D1 credentials.
