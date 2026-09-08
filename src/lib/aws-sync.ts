import {
  CloudWatchClient,
  DescribeAlarmsCommand,
} from "@aws-sdk/client-cloudwatch";
import { prisma } from "@/lib/db";
import { decryptJSON } from "@/lib/crypto";
import { recomputeClientHealth } from "@/lib/integrations/health";
import type { SyncResult } from "@/lib/integrations/types";

interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
}

interface AwsConfig {
  region?: string;
  alarmNames?: string;
  mode?: string;
}

export async function syncAwsForClient(clientId: string): Promise<SyncResult> {
  const integration = await prisma.integration.findUnique({
    where: { clientId_provider: { clientId, provider: "aws" } },
  });

  if (!integration) {
    return {
      ok: false,
      provider: "aws",
      error: "No AWS integration configured",
    };
  }

  let cfg: AwsConfig = {};
  if (integration.config) {
    try {
      cfg = JSON.parse(integration.config) as AwsConfig;
    } catch {
      // ignore
    }
  }

  if (cfg.mode === "demo") {
    const alarmHealthPct = 96.5;
    await persistAws(clientId, integration.id, alarmHealthPct, {
      ok: 2,
      alarm: 0,
      insufficient: 0,
    });
    return {
      ok: true,
      provider: "aws",
      details: { alarmHealthPct, mode: "demo" },
    };
  }

  if (!integration.credentials) {
    return {
      ok: false,
      provider: "aws",
      error: "AWS credentials not configured",
    };
  }

  let creds: AwsCredentials;
  try {
    creds = decryptJSON<AwsCredentials>(integration.credentials);
  } catch {
    return {
      ok: false,
      provider: "aws",
      error: "Failed to read AWS credentials",
    };
  }

  const region = cfg.region?.trim() || "us-east-1";
  const alarmNames = (cfg.alarmNames ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (alarmNames.length === 0) {
    return {
      ok: false,
      provider: "aws",
      error: "No CloudWatch alarm names configured",
    };
  }

  try {
    const client = new CloudWatchClient({
      region,
      credentials: {
        accessKeyId: creds.accessKeyId,
        secretAccessKey: creds.secretAccessKey,
      },
    });

    const out = await client.send(
      new DescribeAlarmsCommand({ AlarmNames: alarmNames }),
    );

    const alarms = out.MetricAlarms ?? [];
    let ok = 0;
    let alarm = 0;
    let insufficient = 0;

    for (const a of alarms) {
      if (a.StateValue === "OK") ok++;
      else if (a.StateValue === "ALARM") alarm++;
      else insufficient++;
    }

    const total = alarms.length || alarmNames.length;
    const healthy = ok + insufficient; // INSUFFICIENT_DATA treated as non-down
    const alarmHealthPct = total > 0 ? (healthy / total) * 100 : 0;

    await persistAws(clientId, integration.id, alarmHealthPct, {
      ok,
      alarm,
      insufficient,
    });

    return {
      ok: alarm === 0,
      provider: "aws",
      details: { alarmHealthPct, ok, alarm, insufficient },
      error: alarm > 0 ? `${alarm}/${total} alarms in ALARM` : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown AWS error";
    await prisma.integration.update({
      where: { id: integration.id },
      data: { status: "error", lastError: message },
    });
    return { ok: false, provider: "aws", error: message };
  }
}

async function persistAws(
  clientId: string,
  integrationId: string,
  alarmHealthPct: number,
  breakdown: { ok: number; alarm: number; insufficient: number },
) {
  const now = new Date();

  await prisma.metricSnapshot.create({
    data: {
      clientId,
      metric: "aws_alarms",
      value: alarmHealthPct,
      capturedAt: now,
      granularity: "daily",
      breakdown: JSON.stringify(breakdown),
    },
  });

  await prisma.client.update({
    where: { id: clientId },
    data: { latestAwsAlarmPct: alarmHealthPct },
  });

  await prisma.integration.update({
    where: { id: integrationId },
    data: {
      status: breakdown.alarm === 0 ? "connected" : "error",
      lastSyncedAt: now,
      lastError:
        breakdown.alarm === 0
          ? null
          : `${breakdown.alarm} CloudWatch alarm(s) in ALARM`,
    },
  });

  await recomputeClientHealth(clientId);
}
