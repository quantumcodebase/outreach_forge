# Cold Email Cockpit (Phase 0 Foundations)

Compliance-first outbound foundation using Next.js + Postgres + pg-boss.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Postgres 16
- Queue/workers: pg-boss (no Redis)
- Prisma ORM + migrations
- AES-256-GCM credential encryption utility

## Monorepo Layout

- `apps/web` — Next.js app + `/api/health`
- `apps/worker` — pg-boss worker with heartbeat job
- `packages/db` — Prisma schema, migrations, shared Prisma client
- `packages/shared` — crypto helpers (`encrypt`, `decrypt`)

## Required Environment Variables

- `DATABASE_URL` — PostgreSQL connection string
- `ENCRYPTION_KEY` — base64 encoded 32-byte key (AES-256-GCM)

Use `.env.example` as a starting point.

## IONOS Defaults

- IMAP host: `imap.ionos.com`
- IMAP port: `993` (SSL)
- SMTP host: `smtp.ionos.com`
- SMTP port: `587` (STARTTLS)

## Quickstart

```bash
cp .env.example .env
# set ENCRYPTION_KEY in .env to a real base64 32-byte value
# example: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

docker compose up --build
```

Verify health endpoint:

```bash
curl http://localhost:3000/api/health
# => {"ok":true,"db":true}
```

## Tooling

```bash
npm install
npm run lint
npm run typecheck
```

## Safe Ramp Guide

| Week | Emails/Day/Inbox | Max Sequence Steps | Notes |
|---|---:|---:|---|
| 1 | 10–15 | 1 | Monitor bounce + complaint rate closely |
| 2 | 20–25 | 2 | Add follow-up step if week 1 bounces < 2% |
| 3–4 | 30–40 | 3 | Expand to full sequence if healthy |
| 5+ | 40–60 | Full sequence | Maintain bounce rate < 3%, reply rate > 2% |

## Health Thresholds (Auto-Pause)

- Bounce rate > 5% on any inbox in rolling 7 days
- Hard bounce rate > 3% on any campaign
- 0 replies across 200+ sends (audience mismatch signal)
- Any spam complaint received (immediate pause + review)

## Conservative Defaults

- Daily cap default: `50`
- Sending window default (to be stored per account/campaign): `08:00–17:00` local timezone

## Host vs Docker DATABASE_URL

- Inside containers, services use `db:5432` hostnames.
- From your host shell, use `localhost:5432`.

Convenience command for host-side migration status:

```bash
npm run db:status:host
```
