import { prisma } from "@/lib/db";
import { decryptJSON } from "@/lib/crypto";
import { recomputeClientHealth } from "@/lib/integrations/health";
import type { SyncResult } from "@/lib/integrations/types";

interface DatadogCredentials {
  apiKey: string;
  appKey: string;
}

interface DatadogConfig {
  testIds?: string;
  site?: string;
  mode?: string;
}

export async function syncDatadogForClient(
  clientId: string,
): Promise<SyncResult> {
  const integration = await prisma.integration.findUnique({
    where: { clientId_provider: { clientId, provider: "datadog" } },
  });

  if (!integration) {
    return {
      ok: false,
      provider: "datadog",
      error: "No Datadog integration configured",
    };
  }

  let cfg: DatadogConfig = {};
  if (integration.config) {
    try {
      cfg = JSON.parse(integration.config) as DatadogConfig;
    } catch {
      // ignore
    }
  }

  if (cfg.mode === "demo") {
    const passPct = 99.2;
    await persistDatadog(clientId, integration.id, passPct, 5, 5);
    return {
      ok: true,
      provider: "datadog",
      details: { passPct, mode: "demo" },
    };
  }

  if (!integration.credentials) {
    return {
      ok: false,
      provider: "datadog",
      error: "Datadog API keys not configured",
    };
  }

  const testIds = (cfg.testIds ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (testIds.length === 0) {
    return {
      ok: false,
      provider: "datadog",
      error: "No Datadog synthetic test IDs configured",
    };
  }

  let creds: DatadogCredentials;
  try {
    creds = decryptJSON<DatadogCredentials>(integration.credentials);
  } catch {
    return {
      ok: false,
      provider: "datadog",
      error: "Failed to read Datadog credentials",
    };
  }

  const site = cfg.site?.trim() || "datadoghq.com";
  const baseUrl = `https://api.${site}`;

  try {
    let passing = 0;
    for (const testId of testIds) {
      const res = await fetch(
        `${baseUrl}/api/v1/synthetics/tests/${encodeURIComponent(testId)}`,
        {
          headers: {
            "DD-API-KEY": creds.apiKey,
            "DD-APPLICATION-KEY": creds.appKey,
          },
          cache: "no-store",
        },
      );
      if (!res.ok) {
        throw new Error(`Datadog test ${testId}: HTTP ${res.status}`);
      }
      const test = (await res.json()) as {
        monitor_id?: number;
        status?: string;
      };
      if (test.status === "live" || test.status === "paused") {
        passing++;
      }
    }

    const passPct = (passing / testIds.length) * 100;
    await persistDatadog(
      clientId,
      integration.id,
      passPct,
      passing,
      testIds.length,
    );

    return {
      ok: passPct === 100,
      provider: "datadog",
      details: { passPct, passing, total: testIds.length },
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown Datadog error";
    await prisma.integration.update({
      where: { id: integration.id },
      data: { status: "error", lastError: message },
    });
    return { ok: false, provider: "datadog", error: message };
  }
}

async function persistDatadog(
  clientId: string,
  integrationId: string,
  passPct: number,
  passing: number,
  total: number,
) {
  const now = new Date();

  await prisma.metricSnapshot.create({
    data: {
      clientId,
      metric: "synthetics",
      value: passPct,
      capturedAt: now,
      granularity: "daily",
      breakdown: JSON.stringify({ passing, total }),
    },
  });

  await prisma.client.update({
    where: { id: clientId },
    data: { latestSyntheticsPct: passPct },
  });

  await prisma.integration.update({
    where: { id: integrationId },
    data: {
      status: passing === total ? "connected" : "error",
      lastSyncedAt: now,
      lastError:
        passing === total
          ? null
          : `${total - passing} Datadog synthetic test(s) not healthy`,
    },
  });

  await recomputeClientHealth(clientId);
}
