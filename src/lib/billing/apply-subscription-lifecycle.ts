/**
 * Fail-closed customer.subscription.created|updated → Agency ledger.
 * Portfolio twin of Doc2Api billing.py subscription lifecycle — past_due never
 * collapses to active+growth; resolve via metadata or stripeCustomerId (Newdrop twin).
 */

const GRANT = new Set(["active", "trialing"]);
const DOWNGRADE = new Set([
  "past_due",
  "unpaid",
  "canceled",
  "incomplete_expired",
  "paused",
]);

export type SubscriptionLike = {
  id: string;
  status: string;
  customer?: string | { id?: string | null } | null;
  metadata?: { agencyId?: string | null } | null;
};

export type AgencySubscriptionPatch = {
  status: string;
  plan: string;
  stripeSubscriptionId: string;
};

export type SubscriptionApplyResult = "grant" | "downgrade" | "skip";

function customerIdOf(sub: SubscriptionLike): string | null {
  if (typeof sub.customer === "string" && sub.customer) return sub.customer;
  if (sub.customer && typeof sub.customer === "object" && sub.customer.id) {
    return sub.customer.id;
  }
  return null;
}

export async function applySubscriptionLifecycle(
  sub: SubscriptionLike,
  opts: {
    updateAgency: (
      agencyId: string,
      data: AgencySubscriptionPatch,
    ) => Promise<void>;
    /** Newdrop/Doc2Api twin — portal events often omit agency metadata. */
    findAgencyByStripeCustomer?: (
      customerId: string,
    ) => Promise<{ id: string } | null>;
  },
): Promise<SubscriptionApplyResult> {
  let agencyId = sub.metadata?.agencyId ?? null;
  if (!agencyId && opts.findAgencyByStripeCustomer) {
    const customerId = customerIdOf(sub);
    if (customerId) {
      const agency = await opts.findAgencyByStripeCustomer(customerId);
      agencyId = agency?.id ?? null;
    }
  }
  if (!agencyId) return "skip";

  if (GRANT.has(sub.status)) {
    await opts.updateAgency(agencyId, {
      status: sub.status,
      plan: "growth",
      stripeSubscriptionId: sub.id,
    });
    return "grant";
  }

  if (DOWNGRADE.has(sub.status)) {
    await opts.updateAgency(agencyId, {
      status: sub.status,
      plan: "trial",
      stripeSubscriptionId: sub.id,
    });
    return "downgrade";
  }

  // Unknown Stripe status — fail-closed: record status, never mint growth.
  await opts.updateAgency(agencyId, {
    status: sub.status,
    plan: "trial",
    stripeSubscriptionId: sub.id,
  });
  return "downgrade";
}

/** Map handler outcome to HTTP — never 200 after mutate failure (Stripe must retry). */
export function billingWebhookHttpResult(
  outcome: { ok: true } | { ok: false; error: string },
): { status: number; body: Record<string, unknown> } {
  if (outcome.ok) return { status: 200, body: { received: true } };
  return { status: 500, body: { error: outcome.error } };
}

export async function runBillingWebhookHandler(
  handle: () => Promise<void>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await handle();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Webhook handler failed",
    };
  }
}
