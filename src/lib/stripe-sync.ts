import Stripe from "stripe";
import { prisma } from "@/lib/db";
import { decryptJSON } from "@/lib/crypto";
import {
  computeMrrCents,
  countActiveSubscribers,
  churnFromMrrDelta,
  type BillingInterval,
  type NormalizedSubscription,
} from "@/lib/metrics";
import { recomputeClientHealth } from "@/lib/integrations/health";

interface StripeCredentials {
  // MVP: restricted read-only secret key. Later: { connectedAccountId } for
  // Stripe Connect, using the platform key + Stripe-Account header instead.
  apiKey?: string;
  connectedAccountId?: string;
}

export interface SyncResult {
  ok: boolean;
  mrrCents?: number;
  activeSubscribers?: number;
  error?: string;
}

// Map a Stripe subscription into our provider-agnostic normalized shape.
function normalize(sub: Stripe.Subscription): NormalizedSubscription {
  let amountCents = 0;
  let interval: BillingInterval = "month";
  let intervalCount = 1;

  for (const item of sub.items.data) {
    const price = item.price;
    const qty = item.quantity ?? 1;
    if (price.unit_amount != null) {
      amountCents += price.unit_amount * qty;
    }
    if (price.recurring) {
      interval = price.recurring.interval as BillingInterval;
      intervalCount = price.recurring.interval_count ?? 1;
    }
  }

  return {
    id: sub.id,
    status: sub.status,
    amountCents,
    interval,
    intervalCount,
    currency: sub.currency,
    customerId:
      typeof sub.customer === "string" ? sub.customer : sub.customer.id,
  };
}

async function fetchAllSubscriptions(
  stripe: Stripe,
  connectedAccountId?: string,
): Promise<NormalizedSubscription[]> {
  const requestOptions = connectedAccountId
    ? { stripeAccount: connectedAccountId }
    : undefined;

  const subs: NormalizedSubscription[] = [];
  const params: Stripe.SubscriptionListParams = {
    status: "all",
    limit: 100,
    expand: ["data.items.data.price"],
  };

  for await (const sub of stripe.subscriptions.list(params, requestOptions)) {
    subs.push(normalize(sub));
  }
  return subs;
}

export async function syncStripeForClient(clientId: string): Promise<SyncResult> {
  const integration = await prisma.integration.findUnique({
    where: { clientId_provider: { clientId, provider: "stripe" } },
  });

  if (!integration) {
    return { ok: false, error: "No Stripe integration connected" };
  }

  let cfg: { mode?: string } = {};
  if (integration.config) {
    try {
      cfg = JSON.parse(integration.config) as { mode?: string };
    } catch {
      // ignore
    }
  }

  // Demo mode for seeded clients without real keys.
  if (cfg.mode === "demo") {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { latestMrrCents: true, currency: true },
    });
    const mrrCents = client?.latestMrrCents ?? 0;
    const activeSubscribers = Math.max(1, Math.round(mrrCents / 8500));
    const currency = client?.currency ?? "usd";

    await persistSnapshot(clientId, { mrrCents, activeSubscribers, currency });

    await prisma.integration.update({
      where: { id: integration.id },
      data: { status: "connected", lastSyncedAt: new Date(), lastError: null },
    });

    return { ok: true, mrrCents, activeSubscribers };
  }

  if (!integration.credentials) {
    return { ok: false, error: "No Stripe integration connected" };
  }

  let creds: StripeCredentials;
  try {
    creds = decryptJSON<StripeCredentials>(integration.credentials);
  } catch {
    return { ok: false, error: "Failed to read stored credentials" };
  }

  // For Connect we'd use the platform key; for MVP we use the stored key.
  const secretKey = creds.apiKey ?? process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return { ok: false, error: "No Stripe API key available" };
  }

  // Pin to the SDK's bundled API version by omitting an explicit override.
  const stripe = new Stripe(secretKey);

  try {
    const subs = await fetchAllSubscriptions(stripe, creds.connectedAccountId);
    const mrrCents = computeMrrCents(subs);
    const activeSubscribers = countActiveSubscribers(subs);
    const currency = subs[0]?.currency ?? "usd";

    await persistSnapshot(clientId, { mrrCents, activeSubscribers, currency });

    await prisma.integration.update({
      where: { id: integration.id },
      data: { status: "connected", lastSyncedAt: new Date(), lastError: null },
    });

    return { ok: true, mrrCents, activeSubscribers };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Stripe error";
    await prisma.integration.update({
      where: { id: integration.id },
      data: { status: "error", lastError: message },
    });
    return { ok: false, error: message };
  }
}

// Write metric snapshots + refresh the client's denormalized headline values.
async function persistSnapshot(
  clientId: string,
  data: { mrrCents: number; activeSubscribers: number; currency: string },
) {
  const now = new Date();

  const prevMrr = await prisma.metricSnapshot.findFirst({
    where: { clientId, metric: "mrr" },
    orderBy: { capturedAt: "desc" },
  });

  const churnRatePct = prevMrr
    ? churnFromMrrDelta(prevMrr.value, data.mrrCents)
    : 0;

  await prisma.metricSnapshot.createMany({
    data: [
      { clientId, metric: "mrr", value: data.mrrCents, capturedAt: now, granularity: "daily" },
      { clientId, metric: "active_subs", value: data.activeSubscribers, capturedAt: now, granularity: "daily" },
      { clientId, metric: "churn", value: churnRatePct, capturedAt: now, granularity: "daily" },
    ],
  });

  await prisma.client.update({
    where: { id: clientId },
    data: {
      latestMrrCents: data.mrrCents,
      latestChurnRate: churnRatePct,
      currency: data.currency,
    },
  });

  await recomputeClientHealth(clientId);
}
