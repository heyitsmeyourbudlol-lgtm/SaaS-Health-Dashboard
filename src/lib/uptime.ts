import { prisma } from "@/lib/db";
import { recomputeClientHealth } from "@/lib/integrations/health";
import { assertSafeOutboundUrl } from "@/lib/security/outbound-url";

interface TargetConfig {
  targets?: string[];
}

export interface UptimeCheckResult {
  ok: boolean;
  uptimePct: number;
  checkedTargets: number;
  healthyTargets: number;
  error?: string;
}

// Run a simple HTTP health check against all configured targets for a client.
// Each target contributes equally to the point-in-time uptime %. Over time,
// repeated checks append to the `uptime` metric series.
export async function checkUptimeForClient(
  clientId: string,
): Promise<UptimeCheckResult> {
  const integration = await prisma.integration.findUnique({
    where: { clientId_provider: { clientId, provider: "uptime" } },
  });

  if (!integration) {
    return {
      ok: false,
      uptimePct: 0,
      checkedTargets: 0,
      healthyTargets: 0,
      error: "No uptime integration configured",
    };
  }

  let cfg: TargetConfig = {};
  if (integration.config) {
    try {
      cfg = JSON.parse(integration.config) as TargetConfig;
    } catch {
      // Ignore bad config; we'll treat it as no targets.
    }
  }

  const targets = (cfg.targets ?? []).filter((t) => !!t);
  if (targets.length === 0) {
    return {
      ok: false,
      uptimePct: 0,
      checkedTargets: 0,
      healthyTargets: 0,
      error: "No uptime targets configured",
    };
  }

  const checks = await Promise.all(targets.map((url) => probe(url)));
  const healthy = checks.filter((c) => c.ok).length;
  const uptimePct = (healthy / checks.length) * 100;

  await persistUptimeSnapshot(clientId, uptimePct);

  await prisma.integration.update({
    where: { id: integration.id },
    data: {
      status: healthy === checks.length ? "connected" : "error",
      lastSyncedAt: new Date(),
      lastError:
        healthy === checks.length
          ? null
          : `One or more targets failed (${healthy}/${checks.length} healthy)`,
    },
  });

  return {
    ok: healthy === checks.length,
    uptimePct,
    checkedTargets: checks.length,
    healthyTargets: healthy,
    error:
      healthy === checks.length
        ? undefined
        : `One or more targets failed (${healthy}/${checks.length} healthy)`,
  };
}

async function probe(url: string): Promise<{ ok: boolean; latencyMs: number }> {
  // Fail-closed SSRF: no private/metadata/link-local targets (literal IP or DNS).
  const safe = await assertSafeOutboundUrl(url, { httpsOnly: false });
  if (!safe.ok) {
    return { ok: false, latencyMs: 0 };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const start = Date.now();
  try {
    const res = await fetch(safe.url, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
      // manual: count 3xx healthy without following (redirect→metadata SSRF).
      redirect: "manual",
    });
    const latencyMs = Date.now() - start;
    clearTimeout(timeout);
    // Treat 2xx and 3xx as healthy; 4xx/5xx as down for this check.
    const ok = res.status >= 200 && res.status < 400;
    return { ok, latencyMs };
  } catch {
    clearTimeout(timeout);
    return { ok: false, latencyMs: Date.now() - start };
  }
}

async function persistUptimeSnapshot(
  clientId: string,
  uptimePct: number,
): Promise<void> {
  const now = new Date();
  // Store uptime as a monthly rollup to keep charts stable (and avoid
  // a growing daily series when users click "Run uptime check now").
  const monthStart = new Date(now);
  monthStart.setDate(1);
  monthStart.setHours(12, 0, 0, 0);
  const nextMonthStart = new Date(monthStart);
  nextMonthStart.setMonth(nextMonthStart.getMonth() + 1);

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return;

  await prisma.metricSnapshot.deleteMany({
    where: {
      clientId,
      metric: "uptime",
      capturedAt: { gte: monthStart, lt: nextMonthStart },
    },
  });

  await prisma.metricSnapshot.create({
    data: {
      clientId,
      metric: "uptime",
      value: uptimePct,
      capturedAt: now,
      granularity: "monthly",
    },
  });

  await prisma.client.update({
    where: { id: clientId },
    data: { latestUptimePct: uptimePct },
  });

  await recomputeClientHealth(clientId);
}

