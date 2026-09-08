import { prisma } from "@/lib/db";
import { decryptJSON } from "@/lib/crypto";
import { recomputeClientHealth } from "@/lib/integrations/health";
import type { SyncResult } from "@/lib/integrations/types";

interface HubSpotCredentials {
  accessToken: string;
}

interface HubSpotConfig {
  dealStageFilter?: string;
  mode?: string;
}

interface HubSpotDeal {
  id: string;
  properties?: {
    amount?: string;
    dealstage?: string;
    hs_is_closed?: string;
  };
}

export async function syncHubSpotForClient(
  clientId: string,
): Promise<SyncResult> {
  const integration = await prisma.integration.findUnique({
    where: { clientId_provider: { clientId, provider: "hubspot" } },
  });

  if (!integration) {
    return {
      ok: false,
      provider: "hubspot",
      error: "No HubSpot integration configured",
    };
  }

  let cfg: HubSpotConfig = {};
  if (integration.config) {
    try {
      cfg = JSON.parse(integration.config) as HubSpotConfig;
    } catch {
      // ignore
    }
  }

  // Demo mode for seeded clients without real tokens.
  if (cfg.mode === "demo") {
    const openDeals = 12;
    const pipelineCents = 2_400_000;
    await persistHubSpot(clientId, integration.id, openDeals, pipelineCents);
    return {
      ok: true,
      provider: "hubspot",
      details: { openDeals, pipelineCents, mode: "demo" },
    };
  }

  if (!integration.credentials) {
    return {
      ok: false,
      provider: "hubspot",
      error: "HubSpot access token not configured",
    };
  }

  let creds: HubSpotCredentials;
  try {
    creds = decryptJSON<HubSpotCredentials>(integration.credentials);
  } catch {
    return {
      ok: false,
      provider: "hubspot",
      error: "Failed to read HubSpot credentials",
    };
  }

  try {
    const deals = await fetchOpenDeals(creds.accessToken, cfg.dealStageFilter);
    const openDeals = deals.length;
    const pipelineCents = Math.round(
      deals.reduce((sum, d) => sum + parseAmount(d.properties?.amount), 0) * 100,
    );

    await persistHubSpot(clientId, integration.id, openDeals, pipelineCents);

    return {
      ok: true,
      provider: "hubspot",
      details: { openDeals, pipelineCents },
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown HubSpot error";
    await prisma.integration.update({
      where: { id: integration.id },
      data: { status: "error", lastError: message },
    });
    return { ok: false, provider: "hubspot", error: message };
  }
}

async function fetchOpenDeals(
  accessToken: string,
  stageFilter?: string,
): Promise<HubSpotDeal[]> {
  const url = new URL("https://api.hubapi.com/crm/v3/objects/deals");
  url.searchParams.set("limit", "100");
  url.searchParams.set(
    "properties",
    "amount,dealstage,hs_is_closed,dealname",
  );

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HubSpot API ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as { results?: HubSpotDeal[] };
  const stages = stageFilter
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return (data.results ?? []).filter((deal) => {
    const closed = deal.properties?.hs_is_closed === "true";
    if (closed) return false;
    if (!stages?.length) return true;
    return stages.includes(deal.properties?.dealstage ?? "");
  });
}

function parseAmount(raw?: string): number {
  const n = parseFloat(raw ?? "0");
  return Number.isFinite(n) ? n : 0;
}

async function persistHubSpot(
  clientId: string,
  integrationId: string,
  openDeals: number,
  pipelineCents: number,
) {
  const now = new Date();

  await prisma.metricSnapshot.createMany({
    data: [
      {
        clientId,
        metric: "open_deals",
        value: openDeals,
        capturedAt: now,
        granularity: "daily",
      },
      {
        clientId,
        metric: "pipeline",
        value: pipelineCents,
        capturedAt: now,
        granularity: "daily",
      },
    ],
  });

  await prisma.client.update({
    where: { id: clientId },
    data: {
      latestOpenDeals: openDeals,
      latestPipelineCents: pipelineCents,
    },
  });

  await prisma.integration.update({
    where: { id: integrationId },
    data: { status: "connected", lastSyncedAt: now, lastError: null },
  });

  await recomputeClientHealth(clientId);
}
