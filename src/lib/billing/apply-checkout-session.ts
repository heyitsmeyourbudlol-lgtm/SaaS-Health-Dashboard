/**
 * Fail-closed checkout.session.completed → Agency plan grant/demote.
 * Portfolio twin of Doc2Api apply_checkout_session_completed + Newdrop
 * resolveCheckoutSessionBilling: unpaid / missing sub / retrieve failure never
 * mint growth; past_due/unpaid/unknown demote trial (never leave prior growth).
 */

const CHECKOUT_PAID = new Set(["paid", "no_payment_required"]);
const SUB_ACTIVE = new Set(["active", "trialing"]);
const SUB_DOWNGRADE = new Set([
  "past_due",
  "unpaid",
  "canceled",
  "incomplete_expired",
  "paused",
]);

export type CheckoutSessionLike = {
  metadata?: { agencyId?: string | null } | null;
  payment_status?: string | null;
  subscription?: string | { id?: string | null } | null;
};

export type AgencyCheckoutPatch = {
  status: string;
  plan: string;
  stripeSubscriptionId: string;
};

export type CheckoutApplyResult = "growth" | "downgrade" | "skip";

export async function applyCheckoutSessionCompleted(
  session: CheckoutSessionLike,
  opts: {
    retrieveSubscription: (id: string) => Promise<{ status: string }>;
    applyAgency: (
      agencyId: string,
      data: AgencyCheckoutPatch,
    ) => Promise<void>;
  },
): Promise<CheckoutApplyResult> {
  const agencyId = session.metadata?.agencyId;
  if (!agencyId) return "skip";

  if (!session.payment_status || !CHECKOUT_PAID.has(session.payment_status)) {
    return "skip";
  }

  const subId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;
  if (!subId) return "skip";

  let sub: { status: string };
  try {
    sub = await opts.retrieveSubscription(subId);
  } catch {
    return "skip";
  }

  if (SUB_ACTIVE.has(sub.status)) {
    await opts.applyAgency(agencyId, {
      status: sub.status,
      plan: "growth",
      stripeSubscriptionId: subId,
    });
    return "growth";
  }

  if (SUB_DOWNGRADE.has(sub.status)) {
    await opts.applyAgency(agencyId, {
      status: sub.status,
      plan: "trial",
      stripeSubscriptionId: subId,
    });
    return "downgrade";
  }

  // Unknown Stripe status — fail-closed: never mint growth / leave prior growth.
  await opts.applyAgency(agencyId, {
    status: sub.status,
    plan: "trial",
    stripeSubscriptionId: subId,
  });
  return "downgrade";
}
