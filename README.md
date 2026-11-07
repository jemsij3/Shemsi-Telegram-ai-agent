# Shemsi AI setup (developer handoff)

Shemsi AI uses one Cloudflare Worker, D1, Workers AI, Telegram Bot API, and a Telegram Mini App. Third-party app integrations and live web search are intentionally not advertised until real authorization and action handlers exist.

## Current implementation

- Telegram `/start`, `/help`, `/memory`, `/forget`, `/skills`, and `/apps` handlers
- Telegram webhook secret validation (required)
- Workers AI conversational replies and D1 conversation history
- Private D1 memory, `/forget`, Mini App memory deletion
- Telegram Mini App authentication using Telegram's signed `initData` (24-hour maximum age)
- Private dashboard API; no user IDs accepted from query parameters
- Four real built-in AI prompt workflows in the skills list
- Responsive Mini App with light/dark theme

## Create a new Telegram bot

1. In Telegram, open the official **@BotFather** account and use `/newbot`.
2. Choose a new display name and unique username. Copy the token once and keep it secret. Do not reuse a token from another bot.
3. Set the bot's Mini App menu button to the deployed Worker URL ending in `/mini-app` (BotFather `/setmenubutton`), or use `/setdomain` with the Worker hostname if Telegram requests a domain.
4. Store the token as a Cloudflare Worker secret; never commit it.

## Cloudflare deploy steps

Prerequisites: Node.js/npm and a Cloudflare account with Workers AI available.

1. Clone this repo and run `npm install`.
2. Authenticate: `npx wrangler login`.
3. Create a separate D1 database for this app: `npx wrangler d1 create shemsi-ai-db`. Copy the returned database ID into `wrangler.toml` replacing `REPLACE_WITH_D1_DATABASE_ID`.
4. Apply schema: `npx wrangler d1 migrations apply shemsi-ai-db --remote`.
5. Set secrets interactively: `npx wrangler secret put TELEGRAM_BOT_TOKEN` (paste the new BotFather token), then `npx wrangler secret put TELEGRAM_SECRET_TOKEN` (use a long random value; keep it private). Optional: `npx wrangler secret put MINI_APP_URL` with the final `https://<worker>.<account>.workers.dev/mini-app` URL.
6. Deploy: `npm run deploy`. Visit `/api/health` and verify `{"status":"ok"...}`.
7. Register webhook, replacing placeholders and using the exact same secret token as step 5:

```sh
curl -X POST "https://api.telegram.org/bot<NEW_BOT_TOKEN>/setWebhook" \
  -d "url=https://<WORKER_HOST>/telegram/webhook" \
  -d "secret_token=<WEBHOOK_SECRET>" \
  -d 'allowed_updates=["message"]'
```

8. Message your new bot with `/start`, then open the Mini App from its menu button. It must be opened inside Telegram; direct browser access cannot authenticate private data.

## Workers AI

`wrangler.toml` binds Workers AI as `AI`; the model is selected by `DEFAULT_MODEL` and defaults to `@cf/meta/llama-3.1-8b-instruct`. Make sure Workers AI is enabled for your Cloudflare account. No Gemini, Google AI Studio, or Google AI APIs are used.

## Local development

Use `npm run dev`. Telegram cannot call a local Worker without a secure tunnel; do not expose a production bot token in local logs. D1 local migrations can be run with `npx wrangler d1 migrations apply shemsi-ai-db --local` after creating the local DB. Configure local secrets in an ignored `.dev.vars` file.

## Current limits

The project currently provides conversational AI, saved memory, and built-in prompt skills. It does not yet execute scheduled tasks, perform live web search, read uploaded files, or connect Gmail, Calendar, GitHub, Notion, OAuth, MCP, or custom APIs. Marketplace commands explicitly say so instead of reporting fake connections or completed work. Never store app credentials in D1 plaintext.
