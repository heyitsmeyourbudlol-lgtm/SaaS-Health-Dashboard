import { prisma } from "@/lib/db";
import { assertSafeOutboundUrl } from "@/lib/security/outbound-url";

interface AlertCheck {
  kind: string;
  severity: "warning" | "critical";
  message: string;
}

// Evaluate thresholds and notify the agency webhook (Slack-compatible).
export async function evaluateAlerts(clientId: string): Promise<void> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { agency: true },
  });
  if (!client) return;

  const checks: AlertCheck[] = [];

  if (client.healthScore != null && client.healthScore < 55) {
    checks.push({
      kind: "health",
      severity: "critical",
      message: `${client.name} health score dropped to ${client.healthScore}`,
    });
  }

  if (client.latestUptimePct != null && client.latestUptimePct < 99) {
    checks.push({
      kind: "uptime",
      severity: client.latestUptimePct < 98 ? "critical" : "warning",
      message: `${client.name} uptime at ${client.latestUptimePct.toFixed(2)}%`,
    });
  }

  if (client.latestChurnRate != null && client.latestChurnRate > 5) {
    checks.push({
      kind: "churn",
      severity: client.latestChurnRate > 8 ? "critical" : "warning",
      message: `${client.name} revenue churn at ${client.latestChurnRate.toFixed(1)}%`,
    });
  }

  if (client.latestAwsAlarmPct != null && client.latestAwsAlarmPct < 95) {
    checks.push({
      kind: "aws",
      severity: "warning",
      message: `${client.name} CloudWatch alarm health at ${client.latestAwsAlarmPct.toFixed(1)}%`,
    });
  }

  if (client.latestSyntheticsPct != null && client.latestSyntheticsPct < 99) {
    checks.push({
      kind: "synthetics",
      severity: "warning",
      message: `${client.name} Datadog synthetics at ${client.latestSyntheticsPct.toFixed(1)}%`,
    });
  }

  if (client.latestErrorCount != null && client.latestErrorCount > 25) {
    checks.push({
      kind: "errors",
      severity: client.latestErrorCount > 50 ? "critical" : "warning",
      message: `${client.name} has ${client.latestErrorCount} unresolved Sentry issues`,
    });
  }

  if (checks.length === 0) return;

  const webhookUrl = client.agency.alertWebhookUrl;
  const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";

  for (const check of checks) {
    const recent = await prisma.alertEvent.findFirst({
      where: {
        clientId,
        kind: check.kind,
        createdAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) },
      },
    });
    if (recent) continue;

    let sent = false;
    if (webhookUrl) {
      sent = await sendWebhook(webhookUrl, {
        text: `[${check.severity.toUpperCase()}] ${check.message}`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*${check.severity.toUpperCase()}* · ${check.message}\n<${baseUrl}/dashboard/clients/${clientId}|View client →>`,
            },
          },
        ],
      });
    }

    await prisma.alertEvent.create({
      data: {
        agencyId: client.agencyId,
        clientId,
        severity: check.severity,
        kind: check.kind,
        message: check.message,
        sent,
      },
    });
  }
}

async function sendWebhook(
  url: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  // Fail-closed SSRF: https-only + block private/metadata (Newdrop assertSafeWebhookUrl class).
  const safe = await assertSafeOutboundUrl(url, { httpsOnly: true });
  if (!safe.ok) return false;
  try {
    const res = await fetch(safe.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      redirect: "error",
    });
    return res.ok;
  } catch {
    return false;
  }
}
