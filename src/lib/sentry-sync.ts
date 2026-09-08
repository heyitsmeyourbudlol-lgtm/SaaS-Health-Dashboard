import { prisma } from "@/lib/db";
import { decryptJSON } from "@/lib/crypto";
import { recomputeClientHealth } from "@/lib/integrations/health";
import type { SyncResult } from "@/lib/integrations/types";

interface SentryCredentials {
  authToken: string;
}

interface SentryConfig {
  orgSlug?: string;
  projectSlug?: string;
  mode?: string;
}

export async function syncSentryForClient(
  clientId: string,
): Promise<SyncResult> {
  const integration = await prisma.integration.findUnique({
    where: { clientId_provider: { clientId, provider: "sentry" } },
  });

  if (!integration) {
    return {
      ok: false,
      provider: "sentry",
      error: "No Sentry integration configured",
    };
  }

  let cfg: SentryConfig = {};
  if (integration.config) {
    try {
      cfg = JSON.parse(integration.config) as SentryConfig;
    } catch {
      // ignore
    }
  }

  if (cfg.mode === "demo") {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { healthScore: true },
    });
    const errorCount =
      client?.healthScore != null && client.healthScore < 60 ? 42 : 8;
    await persistSentry(clientId, integration.id, errorCount);
    return {
      ok: errorCount < 25,
      provider: "sentry",
      details: { errorCount, mode: "demo" },
    };
  }

  if (!integration.credentials) {
    return {
      ok: false,
      provider: "sentry",
      error: "Sentry auth token not configured",
    };
  }

  const orgSlug = cfg.orgSlug?.trim();
  const projectSlug = cfg.projectSlug?.trim();
  if (!orgSlug) {
    return {
      ok: false,
      provider: "sentry",
      error: "Sentry organization slug required",
    };
  }

  let creds: SentryCredentials;
  try {
    creds = decryptJSON<SentryCredentials>(integration.credentials);
  } catch {
    return {
      ok: false,
      provider: "sentry",
      error: "Failed to read Sentry credentials",
    };
  }

  try {
    const query = projectSlug
      ? `is:unresolved project:${projectSlug}`
      : "is:unresolved";
    const url = new URL(
      `https://sentry.io/api/0/organizations/${encodeURIComponent(orgSlug)}/issues/`,
    );
    url.searchParams.set("query", query);
    url.searchParams.set("limit", "100");

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${creds.authToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Sentry API HTTP ${res.status}`);
    }

    const issues = (await res.json()) as unknown[];
    const errorCount = Array.isArray(issues) ? issues.length : 0;

    await persistSentry(clientId, integration.id, errorCount);

    return {
      ok: errorCount < 25,
      provider: "sentry",
      details: { errorCount, orgSlug, projectSlug },
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown Sentry error";
    await prisma.integration.update({
      where: { id: integration.id },
      data: { status: "error", lastError: message },
    });
    return { ok: false, provider: "sentry", error: message };
  }
}

async function persistSentry(
  clientId: string,
  integrationId: string,
  errorCount: number,
) {
  const now = new Date();

  await prisma.metricSnapshot.create({
    data: {
      clientId,
      metric: "errors",
      value: errorCount,
      capturedAt: now,
      granularity: "daily",
    },
  });

  await prisma.client.update({
    where: { id: clientId },
    data: { latestErrorCount: errorCount },
  });

  await prisma.integration.update({
    where: { id: integrationId },
    data: {
      status: errorCount < 25 ? "connected" : "error",
      lastSyncedAt: now,
      lastError:
        errorCount < 25
          ? null
          : `${errorCount} unresolved Sentry issue(s)`,
    },
  });

  await recomputeClientHealth(clientId);
}
