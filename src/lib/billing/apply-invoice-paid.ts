/**
 * Fail-closed invoice.paid / invoice.payment_failed → Agency ledger.
 * Portfolio twin of Newdrop resolveInvoicePaidBilling + Doc2Api apply_invoice_paid:
 * amount≤0 / missing customer / missing sub / retrieve failure never mint growth.
 * invoice.paid has no checkout metadata — resolve Agency via stripeCustomerId.
 */

const GRANT = new Set(["active", "trialing"]);
const DOWNGRADE = new Set([
  "past_due",
  "unpaid",
  "canceled",
  "incomplete_expired",
  "paused",
]);

export type InvoicePaidLike = {
  amount_paid?: number | null;
  customer?: string | { id?: string | null } | null;
  subscription?: string | { id?: string | null } | null;
};

export type InvoicePaymentFailedLike = {
  customer?: string | { id?: string | null } | null;
  subscription?: string | { id?: string | null } | null;
};

export type AgencyInvoicePatch = {
  status: string;
  plan: string;
  stripeSubscriptionId: string | null;
};

export type InvoicePaidApplyResult = "growth" | "downgrade" | "skip";
export type InvoicePaymentFailedResult = "past_due" | "skip";

function customerIdOf(
  customer: string | { id?: string | null } | null | undefined,
): string | null {
  if (typeof customer === "string") return customer;
  return customer?.id ?? null;
}

function subscriptionIdOf(
  subscription: string | { id?: string | null } | null | undefined,
): string | null {
  if (typeof subscription === "string") return subscription;
  return subscription?.id ?? null;
}

export async function applyInvoicePaid(
  invoice: InvoicePaidLike,
  opts: {
    findAgencyByStripeCustomer: (
      customerId: string,
    ) => Promise<{ id: string } | null>;
    retrieveSubscription: (id: string) => Promise<{ status: string }>;
    updateAgency: (agencyId: string, data: AgencyInvoicePatch) => Promise<void>;
  },
): Promise<InvoicePaidApplyResult> {
  const amount = invoice.amount_paid ?? 0;
  if (typeof amount !== "number" || amount <= 0) return "skip";

  const customerId = customerIdOf(invoice.customer);
  if (!customerId) return "skip";

  const agency = await opts.findAgencyByStripeCustomer(customerId);
  if (!agency) return "skip";

  const subId = subscriptionIdOf(invoice.subscription);
  // Never default growth when Invoice omitted the subscription id.
  if (!subId) return "skip";

  let sub: { status: string };
  try {
    sub = await opts.retrieveSubscription(subId);
  } catch {
    return "skip";
  }

  if (GRANT.has(sub.status)) {
    await opts.updateAgency(agency.id, {
      status: sub.status,
      plan: "growth",
      stripeSubscriptionId: subId,
    });
    return "growth";
  }

  if (DOWNGRADE.has(sub.status)) {
    await opts.updateAgency(agency.id, {
      status: sub.status,
      plan: "trial",
      stripeSubscriptionId: subId,
    });
    return "downgrade";
  }

  // Unknown Stripe status — fail-closed: never mint growth.
  await opts.updateAgency(agency.id, {
    status: sub.status,
    plan: "trial",
    stripeSubscriptionId: subId,
  });
  return "downgrade";
}

/** Twin Newdrop/Doc2Api invoice.payment_failed → past_due + demote plan. */
export async function applyInvoicePaymentFailed(
  invoice: InvoicePaymentFailedLike,
  opts: {
    findAgencyByStripeCustomer: (
      customerId: string,
    ) => Promise<{ id: string } | null>;
    updateAgency: (agencyId: string, data: AgencyInvoicePatch) => Promise<void>;
  },
): Promise<InvoicePaymentFailedResult> {
  const customerId = customerIdOf(invoice.customer);
  if (!customerId) return "skip";

  const agency = await opts.findAgencyByStripeCustomer(customerId);
  if (!agency) return "skip";

  const subId = subscriptionIdOf(invoice.subscription);
  await opts.updateAgency(agency.id, {
    status: "past_due",
    plan: "trial",
    stripeSubscriptionId: subId,
  });
  return "past_due";
}
