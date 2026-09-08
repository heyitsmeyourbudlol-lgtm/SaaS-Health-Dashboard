import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { computeHealthScore } from "../src/lib/metrics";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

interface ClientSeed {
  name: string;
  website: string;
  currency: string;
  startMrrCents: number;
  monthlyGrowth: number; // e.g. 0.06 = +6%/mo
  churnRatePct: number;
  uptimePct: number;
  subsAtStart: number;
}

const CLIENTS: ClientSeed[] = [
  {
    name: "Northwind SaaS",
    website: "https://northwind.example.com",
    currency: "usd",
    startMrrCents: 1_820_000,
    monthlyGrowth: 0.07,
    churnRatePct: 1.8,
    uptimePct: 99.98,
    subsAtStart: 210,
  },
  {
    name: "Globex Analytics",
    website: "https://globex.example.com",
    currency: "usd",
    startMrrCents: 940_000,
    monthlyGrowth: 0.04,
    churnRatePct: 3.4,
    uptimePct: 99.9,
    subsAtStart: 128,
  },
  {
    name: "Initech Cloud",
    website: "https://initech.example.com",
    currency: "usd",
    startMrrCents: 2_650_000,
    monthlyGrowth: 0.02,
    churnRatePct: 6.9,
    uptimePct: 98.6,
    subsAtStart: 305,
  },
  {
    name: "Umbrella Metrics",
    website: "https://umbrella.example.com",
    currency: "eur",
    startMrrCents: 610_000,
    monthlyGrowth: 0.11,
    churnRatePct: 2.1,
    uptimePct: 99.95,
    subsAtStart: 74,
  },
  {
    name: "Hooli Streams",
    website: "https://hooli.example.com",
    currency: "usd",
    startMrrCents: 3_420_000,
    monthlyGrowth: -0.015,
    churnRatePct: 8.7,
    uptimePct: 97.4,
    subsAtStart: 460,
  },
];

const MONTHS = 12;

function monthsAgo(n: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setMonth(d.getMonth() - n);
  return d;
}

async function main() {
  console.log("Resetting demo data…");
  await prisma.agency.deleteMany({ where: { slug: "acme-agency" } });

  const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
  const demoPassword = process.env.DEMO_ADMIN_PASSWORD ?? "demo1234";

  const agency = await prisma.agency.create({
    data: {
      name: "Acme Agency",
      slug: "acme-agency",
      plan: "growth",
      status: "active",
      primaryColor: "#4f46e5",
      accentColor: "#0ea5e9",
      users: {
        create: {
          email: "owner@acme.agency",
          name: "Alex Rivera",
          role: "owner",
          passwordHash: await bcrypt.hash(demoPassword, 10),
        },
      },
    },
  });

  console.log(`Created agency ${agency.name} (${agency.slug})`);

  for (const seed of CLIENTS) {
    const client = await prisma.client.create({
      data: {
        agencyId: agency.id,
        name: seed.name,
        website: seed.website,
        currency: seed.currency,
      },
    });

    // Build a 12-month history for MRR, subscribers, uptime, churn, health.
    const snapshots: {
      clientId: string;
      metric: string;
      value: number;
      capturedAt: Date;
      granularity: string;
      breakdown?: string;
    }[] = [];

    let latestMrr = 0;
    let latestSubs = 0;
    let latestHealth = 0;
    let latestOpenDeals = 0;
    let latestPipelineCents = 0;
    let latestAwsAlarmPct = 0;
    let latestSyntheticsPct = 0;
    let latestErrorCount = 0;

    for (let i = MONTHS - 1; i >= 0; i--) {
      const monthIndex = MONTHS - 1 - i;
      const growthFactor = Math.pow(1 + seed.monthlyGrowth, monthIndex);
      // Small deterministic wobble so charts look organic.
      const wobble = 1 + Math.sin(monthIndex * 1.3) * 0.015;
      const mrr = Math.round(seed.startMrrCents * growthFactor * wobble);
      const subs = Math.round(seed.subsAtStart * growthFactor);
      const uptime = clamp(
        seed.uptimePct + Math.sin(monthIndex * 0.9) * 0.05,
        95,
        100,
      );
      const prevMrr =
        monthIndex === 0
          ? seed.startMrrCents
          : Math.round(
              seed.startMrrCents * Math.pow(1 + seed.monthlyGrowth, monthIndex - 1),
            );
      const trendPct = prevMrr > 0 ? ((mrr - prevMrr) / prevMrr) * 100 : 0;
      const churnedMrr = Math.round(mrr * (seed.churnRatePct / 100));

      const openDeals = Math.max(3, Math.round(subs * 0.08));
      const pipelineCents = Math.round(mrr * 1.35);
      const awsAlarmPct = round2(clamp(uptime - 2.5, 90, 100));
      const syntheticsPct = round2(clamp(uptime - 0.3, 95, 100));
      const errorCount =
        seed.churnRatePct > 6 ? 38 : seed.churnRatePct > 3 ? 14 : 4;

      const health = computeHealthScore({
        churnRatePct: seed.churnRatePct,
        uptimePct: uptime,
        mrrTrendPct: trendPct,
        awsAlarmPct,
        syntheticsPct,
        pipelineTrendPct: seed.monthlyGrowth * 100,
        errorCount,
      });

      const capturedAt = monthsAgo(i);

      snapshots.push(
        { clientId: client.id, metric: "mrr", value: mrr, capturedAt, granularity: "monthly", breakdown: JSON.stringify({ churnedMrr, netMrr: mrr - prevMrr }) },
        { clientId: client.id, metric: "active_subs", value: subs, capturedAt, granularity: "monthly" },
        { clientId: client.id, metric: "uptime", value: round2(uptime), capturedAt, granularity: "monthly" },
        { clientId: client.id, metric: "churn", value: seed.churnRatePct, capturedAt, granularity: "monthly" },
        { clientId: client.id, metric: "health", value: health, capturedAt, granularity: "monthly" },
        { clientId: client.id, metric: "open_deals", value: openDeals, capturedAt, granularity: "monthly" },
        { clientId: client.id, metric: "pipeline", value: pipelineCents, capturedAt, granularity: "monthly" },
        { clientId: client.id, metric: "aws_alarms", value: awsAlarmPct, capturedAt, granularity: "monthly" },
        { clientId: client.id, metric: "synthetics", value: syntheticsPct, capturedAt, granularity: "monthly" },
        { clientId: client.id, metric: "errors", value: errorCount, capturedAt, granularity: "monthly" },
      );

      latestMrr = mrr;
      latestSubs = subs;
      latestHealth = health;
      latestOpenDeals = openDeals;
      latestPipelineCents = pipelineCents;
      latestAwsAlarmPct = awsAlarmPct;
      latestSyntheticsPct = syntheticsPct;
      latestErrorCount = errorCount;
    }

    await prisma.metricSnapshot.createMany({ data: snapshots });

    await prisma.client.update({
      where: { id: client.id },
      data: {
        latestMrrCents: latestMrr,
        latestChurnRate: seed.churnRatePct,
        latestUptimePct: round2(seed.uptimePct),
        latestOpenDeals,
        latestPipelineCents,
        latestAwsAlarmPct,
        latestSyntheticsPct,
        latestErrorCount,
        healthScore: latestHealth,
      },
    });

    // A placeholder Stripe integration (no live key in the demo).
    await prisma.integration.create({
      data: {
        clientId: client.id,
        provider: "stripe",
        status: "connected",
        lastSyncedAt: new Date(),
        config: JSON.stringify({ mode: "demo" }),
      },
    });

    // An uptime integration with monitored endpoints.
    await prisma.integration.create({
      data: {
        clientId: client.id,
        provider: "uptime",
        status: "connected",
        lastSyncedAt: new Date(),
        // Use an internal, deterministic health endpoint so uptime checks work
        // in local dev without external DNS access.
        config: JSON.stringify({
          targets: [
            `${baseUrl}/api/healthz?pattern=${slugify(seed.name)}:a`,
            `${baseUrl}/api/healthz?pattern=${slugify(seed.name)}:b`,
          ],
        }),
      },
    });

    await prisma.integration.create({
      data: {
        clientId: client.id,
        provider: "hubspot",
        status: "connected",
        lastSyncedAt: new Date(),
        config: JSON.stringify({ mode: "demo" }),
      },
    });

    await prisma.integration.create({
      data: {
        clientId: client.id,
        provider: "aws",
        status: "connected",
        lastSyncedAt: new Date(),
        config: JSON.stringify({ mode: "demo", region: "us-east-1" }),
      },
    });

    await prisma.integration.create({
      data: {
        clientId: client.id,
        provider: "datadog",
        status: "connected",
        lastSyncedAt: new Date(),
        config: JSON.stringify({ mode: "demo", site: "datadoghq.com" }),
      },
    });

    await prisma.integration.create({
      data: {
        clientId: client.id,
        provider: "sentry",
        status: "connected",
        lastSyncedAt: new Date(),
        config: JSON.stringify({ mode: "demo", orgSlug: "demo-org" }),
      },
    });

    // A live shareable client link for the first client.
    await prisma.shareLink.create({
      data: {
        clientId: client.id,
        token: randomBytes(16).toString("hex"),
        enabled: true,
      },
    });

    console.log(`  • ${seed.name}: MRR ${(latestMrr / 100).toLocaleString()} ${seed.currency.toUpperCase()}, health ${latestHealth}`);
  }

  const shareLink = await prisma.shareLink.findFirst({
    include: { client: true },
    orderBy: { createdAt: "asc" },
  });
  if (shareLink) {
    console.log(`\nSample share link: /share/${shareLink.token} (${shareLink.client.name})`);
  }

  console.log("\nSeed complete.");
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
