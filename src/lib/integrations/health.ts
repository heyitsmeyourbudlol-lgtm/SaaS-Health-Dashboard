import { prisma } from "@/lib/db";
import { computeHealthScore } from "@/lib/metrics";
import { evaluateAlerts } from "@/lib/alerts";

async function trendPct(
  clientId: string,
  metric: string,
): Promise<number> {
  const last = await prisma.metricSnapshot.findFirst({
    where: { clientId, metric },
    orderBy: { capturedAt: "desc" },
  });
  if (!last || last.value <= 0) return 0;

  const prev = await prisma.metricSnapshot.findFirst({
    where: {
      clientId,
      metric,
      capturedAt: { lt: last.capturedAt },
    },
    orderBy: { capturedAt: "desc" },
  });
  if (!prev || prev.value <= 0) return 0;

  return ((last.value - prev.value) / prev.value) * 100;
}

// Recompute blended health from the client's latest denormalized metrics.
export async function recomputeClientHealth(clientId: string): Promise<number> {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return 0;

  const [mrrTrendPct, pipelineTrendPct] = await Promise.all([
    trendPct(clientId, "mrr"),
    trendPct(clientId, "pipeline"),
  ]);

  const healthScore = computeHealthScore({
    churnRatePct: client.latestChurnRate ?? 0,
    uptimePct: client.latestUptimePct,
    mrrTrendPct,
    awsAlarmPct: client.latestAwsAlarmPct,
    syntheticsPct: client.latestSyntheticsPct,
    pipelineTrendPct,
    errorCount: client.latestErrorCount,
  });

  const now = new Date();
  await prisma.metricSnapshot.create({
    data: {
      clientId,
      metric: "health",
      value: healthScore,
      capturedAt: now,
      granularity: "daily",
    },
  });

  await prisma.client.update({
    where: { id: clientId },
    data: { healthScore },
  });

  await evaluateAlerts(clientId);

  return healthScore;
}
