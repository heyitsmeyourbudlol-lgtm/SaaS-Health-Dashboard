# SaaS Health Dashboard for Agencies

One dashboard showing **MRR + churn + uptime + pipeline + infra health** per client,
for digital agencies managing 10+ accounts — with a **white-labeled, shareable
client link**.

## Stack

- **Next.js 15** (App Router) + **TypeScript**
- **Tailwind CSS v4**
- **Prisma** ORM — **SQLite** for local dev (zero setup); **Postgres** is the
  production target (change the `datasource` provider + `DATABASE_URL`)
- **Stripe** SDK for financial data + agency billing
- **AWS CloudWatch**, **HubSpot**, **Datadog** sync modules
- **Recharts** for MRR/uptime charts

## Quick start

```bash
npm install
cp .env.example .env          # defaults work out of the box for local dev
npm run db:migrate            # creates prisma/dev.db
npm run db:seed               # loads a demo agency + 5 clients with history
npm run dev                   # http://localhost:3000
```

Then open:

- `owner@acme.agency` / `demo1234` (or `DEMO_ADMIN_PASSWORD`) to log into the seeded demo
- `/dashboard` — agency portfolio (health, MRR, churn, uptime per client)
- `/dashboard/clients/[id]` — client detail with **5 integration panels** + **Sync all services**
- `/share/[token]` — public, white-labeled, read-only client report
- `/dashboard/settings` — branding + Stripe Billing subscribe
- `/pricing` — pricing page
- `/login`, `/signup` — agency owner auth

## Integrations

| Provider | Metrics | Connect with |
|---|---|---|
| **Stripe** | MRR, active subscribers | Restricted read-only API key (`rk_…`) or demo mode in seed |
| **Uptime** | HTTP uptime % | Comma-separated URLs to monitor |
| **HubSpot** | Open deals, pipeline value | Private app access token |
| **AWS** | CloudWatch alarm health % | IAM access key + secret (read-only alarms) |
| **Datadog** | Synthetic test pass rate | API + app keys |
| **Sentry** | Unresolved error count | Auth token + org slug |

All integrations write to **`MetricSnapshot`** via a unified sync layer
(`src/lib/integrations/sync-all.ts`). Dashboards read snapshots only — never
call external APIs on page load.

**Sync all services** on a client page runs every connected integration for that
client. For scheduled sync across all clients, call:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/sync
```

Wire this to Vercel Cron or any external scheduler in production.
`vercel.json` is included with an hourly schedule.

## Alerts

Configure a Slack-compatible webhook in **Settings → Alert notifications**.
After each sync, the app evaluates thresholds (health &lt; 55, uptime &lt; 99%,
churn &gt; 5%, etc.) and posts to your webhook. Alert history is shown on the
settings page.

## How it's wired

```
Agency users ─▶ Next.js (dashboard) ─▶ agency-scoped queries ─▶ Prisma/SQLite
                        │
                        ├─ server actions: connect integrations, sync, share links
                        └─ sync-all ─▶ Stripe / HubSpot / AWS / Datadog / uptime
                                         └─ MetricSnapshot + denormalized client fields
Public: /share/[token] ─▶ token-scoped read of MetricSnapshot (no credentials exposed)
```

## Stripe Billing (to go live)

This MVP includes Stripe Checkout + webhook endpoints:

- `POST /api/billing/checkout` (requires an authenticated agency owner)
- `POST /api/billing/webhook` (Stripe webhook signature verification)

Set these in `.env`:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID` (monthly price for $99/mo)
- `STRIPE_SUCCESS_URL`
- `STRIPE_CANCEL_URL`

Also set `CRON_SECRET` for scheduled sync and `DEMO_ADMIN_PASSWORD` if you
want a custom seed login password.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run db:migrate` | Apply Prisma migrations (SQLite) |
| `npm run db:seed` | Load demo data |
| `npm run db:reset` | Reset DB + reseed |
| `npx tsx scripts/update-uptime-targets.ts` | Point demo uptime checks to internal endpoints |
| `npx tsx scripts/run-uptime-check-once.ts` | Run one uptime check (updates dashboard snapshots) |
| `npm run typecheck` | `tsc --noEmit` |

## Roadmap

- **Stripe Connect OAuth** (replace per-client restricted keys)
- **Editable branding** — color pickers, logo upload, custom domains
- **Background scheduler** — Vercel Cron / Inngest for periodic syncs
- **Alerts** — churn spikes, downtime, alarm state changes
- **Prod hardening** — Postgres, Auth.js upgrade, real Terms/Privacy pages
