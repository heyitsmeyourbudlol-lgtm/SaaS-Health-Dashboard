import { syncStripeForClient } from "@/lib/stripe-sync";
import { checkUptimeForClient } from "@/lib/uptime";
import { syncHubSpotForClient } from "@/lib/hubspot-sync";
import { syncAwsForClient } from "@/lib/aws-sync";
import { syncDatadogForClient } from "@/lib/datadog-sync";
import { syncSentryForClient } from "@/lib/sentry-sync";
import type { IntegrationProvider, SyncResult } from "@/lib/integrations/types";

type SyncFn = (clientId: string) => Promise<SyncResult>;

const SYNC_BY_PROVIDER: Record<IntegrationProvider, SyncFn> = {
  stripe: async (clientId) => {
    const r = await syncStripeForClient(clientId);
    return { ...r, provider: "stripe" as const };
  },
  uptime: async (clientId) => {
    const r = await checkUptimeForClient(clientId);
    return {
      ok: r.ok,
      provider: "uptime" as const,
      error: r.error,
      details: {
        uptimePct: r.uptimePct,
        healthyTargets: r.healthyTargets,
        checkedTargets: r.checkedTargets,
      },
    };
  },
  hubspot: syncHubSpotForClient,
  aws: syncAwsForClient,
  datadog: syncDatadogForClient,
  sentry: syncSentryForClient,
};

export async function syncIntegration(
  clientId: string,
  provider: IntegrationProvider,
): Promise<SyncResult> {
  const fn = SYNC_BY_PROVIDER[provider];
  return fn(clientId);
}

export async function syncAllIntegrationsForClient(
  clientId: string,
  providers?: IntegrationProvider[],
): Promise<SyncResult[]> {
  const list = providers ?? [
    "stripe",
    "uptime",
    "hubspot",
    "aws",
    "datadog",
    "sentry",
  ];
  const results: SyncResult[] = [];

  for (const provider of list) {
    try {
      results.push(await syncIntegration(clientId, provider));
    } catch (err) {
      results.push({
        ok: false,
        provider,
        error: err instanceof Error ? err.message : "Sync failed",
      });
    }
  }

  return results;
}
