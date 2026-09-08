import { prisma } from "@/lib/db";

// All reads here are scoped by agencyId (except share-token reads, which are
// scoped by an opaque token). This is the single choke point where tenant
// isolation is enforced.

export interface SeriesPoint {
  capturedAt: string;
  value: number;
}

export async function getPortfolio(agencyId: string) {
  const clients = await prisma.client.findMany({
    where: { agencyId, archived: false },
    include: {
      integrations: { select: { provider: true, status: true } },
    },
  });

  clients.sort((a, b) => {
    const aScore = a.healthScore;
    const bScore = b.healthScore;
    if (aScore == null && bScore == null) return 0;
    if (aScore == null) return 1;
    if (bScore == null) return -1;
    return aScore - bScore;
  });

  const totalMrrCents = clients.reduce(
    (sum, c) => sum + (c.latestMrrCents ?? 0),
    0,
  );
  const totalPipelineCents = clients.reduce(
    (sum, c) => sum + (c.latestPipelineCents ?? 0),
    0,
  );

  const uptimeValues = clients
    .map((c) => c.latestUptimePct)
    .filter((v): v is number => v != null);
  const churnValues = clients
    .map((c) => c.latestChurnRate)
    .filter((v): v is number => v != null);
  const awsValues = clients
    .map((c) => c.latestAwsAlarmPct)
    .filter((v): v is number => v != null);

  const avgUptime = uptimeValues.length
    ? uptimeValues.reduce((s, v) => s + v, 0) / uptimeValues.length
    : 0;
  const avgChurn = churnValues.length
    ? churnValues.reduce((s, v) => s + v, 0) / churnValues.length
    : 0;
  const avgInfraHealth = awsValues.length
    ? awsValues.reduce((s, v) => s + v, 0) / awsValues.length
    : null;

  const atRisk = clients.filter(
    (c) => c.healthScore != null && c.healthScore < 55,
  ).length;

  const integrationGaps = clients.filter((c) => {
    const connected = new Set(
      c.integrations
        .filter((i) => i.status === "connected")
        .map((i) => i.provider),
    );
    return !connected.has("stripe") || !connected.has("uptime");
  }).length;

  const recentAlerts = await prisma.alertEvent.count({
    where: {
      agencyId,
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
  });

  return {
    clients,
    totalMrrCents,
    totalPipelineCents,
    avgUptime,
    avgChurn,
    avgInfraHealth,
    atRisk,
    integrationGaps,
    recentAlerts,
  };
}

async function seriesFor(clientId: string, metric: string): Promise<SeriesPoint[]> {
  const rows = await prisma.metricSnapshot.findMany({
    where: { clientId, metric },
    orderBy: { capturedAt: "asc" },
  });
  return rows.map((r) => ({
    capturedAt: r.capturedAt.toISOString(),
    value: r.value,
  }));
}

export async function getClientDetail(agencyId: string, clientId: string) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, agencyId },
    include: {
      integrations: true,
      shareLinks: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!client) return null;

  const [
    mrr,
    uptime,
    churn,
    activeSubs,
    health,
    pipeline,
    openDeals,
    awsAlarms,
    synthetics,
    errors,
  ] = await Promise.all([
    seriesFor(clientId, "mrr"),
    seriesFor(clientId, "uptime"),
    seriesFor(clientId, "churn"),
    seriesFor(clientId, "active_subs"),
    seriesFor(clientId, "health"),
    seriesFor(clientId, "pipeline"),
    seriesFor(clientId, "open_deals"),
    seriesFor(clientId, "aws_alarms"),
    seriesFor(clientId, "synthetics"),
    seriesFor(clientId, "errors"),
  ]);

  return {
    client,
    series: {
      mrr,
      uptime,
      churn,
      activeSubs,
      health,
      pipeline,
      openDeals,
      awsAlarms,
      synthetics,
      errors,
    },
  };
}

export async function getClientByShareToken(token: string) {
  const shareLink = await prisma.shareLink.findUnique({
    where: { token },
    include: { client: { include: { agency: true } } },
  });
  if (!shareLink || !shareLink.enabled) return null;
  if (shareLink.expiresAt && shareLink.expiresAt < new Date()) return null;

  await prisma.shareLink.update({
    where: { id: shareLink.id },
    data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
  });

  const clientId = shareLink.client.id;
  const [mrr, uptime, health, pipeline, awsAlarms, synthetics, errors] =
    await Promise.all([
      seriesFor(clientId, "mrr"),
      seriesFor(clientId, "uptime"),
      seriesFor(clientId, "health"),
      seriesFor(clientId, "pipeline"),
      seriesFor(clientId, "aws_alarms"),
      seriesFor(clientId, "synthetics"),
      seriesFor(clientId, "errors"),
    ]);

  return {
    client: shareLink.client,
    agency: shareLink.client.agency,
    series: { mrr, uptime, health, pipeline, awsAlarms, synthetics, errors },
  };
}

export async function getAgencySettings(agencyId: string) {
  const [agency, recentAlerts] = await Promise.all([
    prisma.agency.findUnique({ where: { id: agencyId } }),
    prisma.alertEvent.findMany({
      where: { agencyId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { client: { select: { name: true } } },
    }),
  ]);
  return { agency, recentAlerts };
}
