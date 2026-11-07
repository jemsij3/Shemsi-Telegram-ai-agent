# Shemsi AI

Shemsi AI is a Telegram-first personal AI agent platform built with Cloudflare Workers, Workers AI, Telegram Bot API, D1, and a mobile-first mini app.

## Architecture

- Bot layer: Telegram webhook handlers and conversational orchestration
- Agent layer: natural-language task planning, memory, and action execution
- App marketplace: reusable app connectors for GitHub, Gmail, Google Calendar, Notion, and custom APIs
- Skills marketplace: workflow skills for research, writing, productivity, and development tasks
- Memory layer: user-scoped memory persisted in Cloudflare D1
- Automation layer: queued tasks, scheduled reminders, and recurring actions
- Mini app: Telegram Mini App dashboard for chat, integrations, skills, automations, and settings

## Repository layout

- `src/index.ts` — Cloudflare Worker entry point and Telegram webhook handlers
- `src/lib/ai.ts` — AI prompt orchestration with Cloudflare Workers AI
- `src/lib/db.ts` — D1 helpers for users, memory, apps, skills, tasks, and conversation history
- `src/lib/integrations.ts` — marketplace definitions and secure connection flow scaffolding
- `src/db/schema.sql` — D1 schema for the platform
- `apps/mini-app/` — Telegram Mini App UI assets
- `wrangler.toml` — Cloudflare Worker and D1/R2 bindings

## Stages implemented

1. Platform foundation and architecture
2. Telegram webhook handling and command parsing
3. D1-backed memory, app connections, and automation tables
4. App marketplace and integration architecture
5. Mini app dashboard and interactive UX shell
6. Production hardening guidance for auth, webhooks, and secrets

## Local setup

1. Copy `.env.example` to `.env` and fill the secrets.
2. Install dependencies:
   npm install
3. Run the worker locally:
   npm run dev
4. Apply D1 migrations:
   npm run db:migrate
5. Configure your Telegram bot webhook to point at the deployed worker.

## Production notes

- Use a new Telegram bot token and a separate Cloudflare Worker.
- Never share secrets in source control.
- Use `x-telegram-bot-api-secret-token` validation for webhook protection.
- Require confirmation before sensitive actions such as sending emails or creating calendar events.

## Important

This repository contains the real platform scaffold and architecture for a working Shemsi AI implementation. Integration flows that require third-party OAuth credentials are implemented as secure connection templates and are intentionally not activated without valid app credentials.
