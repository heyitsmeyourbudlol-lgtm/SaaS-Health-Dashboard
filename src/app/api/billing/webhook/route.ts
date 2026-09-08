import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/db";
import { applyCheckoutSessionCompleted } from "@/lib/billing/apply-checkout-session";
import {
  applyInvoicePaid,
  applyInvoicePaymentFailed,
} from "@/lib/billing/apply-invoice-paid";
import {
  applySubscriptionLifecycle,
  billingWebhookHttpResult,
  runBillingWebhookHandler,
} from "@/lib/billing/apply-subscription-lifecycle";
import { prismaWebhookLedgerStore } from "@/lib/billing/prisma-webhook-ledger";
import {
  claimStripeWebhookEvent,
  finalizeStripeWebhookEvent,
} from "@/lib/billing/stripe-webhook-ledger";

async function findAgencyByStripeCustomer(customerId: string) {
  return prisma.agency.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
}

export async function POST(request: Request) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeSecretKey || !webhookSecret) {
    return NextResponse.json({ error: "Missing Stripe webhook env" }, { status: 500 });
  }

  const stripe = new Stripe(stripeSecretKey);

  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    if (!signature) throw new Error("Missing stripe-signature header");
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook signature verification failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const ledger = prismaWebhookLedgerStore();
  const claim = await claimStripeWebhookEvent(event.id, event.type, ledger);
  if (claim.action === "duplicate") {
    return NextResponse.json({ received: true, duplicate: true });
  }
  if (claim.action === "fail") {
    return NextResponse.json({ error: claim.error }, { status: 500 });
  }

  const outcome = await runBillingWebhookHandler(() => handleEvent(event, stripe));
  await finalizeStripeWebhookEvent(event.id, outcome, ledger);
  const http = billingWebhookHttpResult(outcome);
  return NextResponse.json(http.body, { status: http.status });
}

async function handleEvent(event: Stripe.Event, stripe: Stripe) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await applyCheckoutSessionCompleted(session, {
        retrieveSubscription: async (id) => {
          const sub = await stripe.subscriptions.retrieve(id);
          return { status: sub.status };
        },
        applyAgency: async (agencyId, data) => {
          await prisma.agency.update({
            where: { id: agencyId },
            data,
          });
        },
      });
      return;
    }

    case "customer.subscription.updated":
    case "customer.subscription.created": {
      const sub = event.data.object as Stripe.Subscription;
      await applySubscriptionLifecycle(sub, {
        findAgencyByStripeCustomer,
        updateAgency: async (agencyId, data) => {
          await prisma.agency.update({
            where: { id: agencyId },
            data,
          });
        },
      });
      return;
    }

    case "customer.subscription.deleted": {
      // Same fail-closed ledger as updated — clear growth (exp 6 cancel leak).
      const sub = event.data.object as Stripe.Subscription;
      await applySubscriptionLifecycle(
        {
          id: sub.id,
          status: "canceled",
          customer: sub.customer,
          metadata: sub.metadata,
        },
        {
          findAgencyByStripeCustomer,
          updateAgency: async (agencyId, data) => {
            await prisma.agency.update({
              where: { id: agencyId },
              data,
            });
          },
        },
      );
      return;
    }

    case "invoice.paid": {
      // No checkout metadata — resolve Agency via stripeCustomerId (Doc2Api twin).
      const invoice = event.data.object as Stripe.Invoice;
      await applyInvoicePaid(invoice, {
        findAgencyByStripeCustomer,
        retrieveSubscription: async (id) => {
          const sub = await stripe.subscriptions.retrieve(id);
          return { status: sub.status };
        },
        updateAgency: async (agencyId, data) => {
          await prisma.agency.update({
            where: { id: agencyId },
            data,
          });
        },
      });
      return;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      await applyInvoicePaymentFailed(invoice, {
        findAgencyByStripeCustomer,
        updateAgency: async (agencyId, data) => {
          await prisma.agency.update({
            where: { id: agencyId },
            data,
          });
        },
      });
      return;
    }

    default:
      return;
  }
}
