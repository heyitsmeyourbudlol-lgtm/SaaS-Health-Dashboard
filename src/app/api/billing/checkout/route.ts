import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

export async function POST(request: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const stripePriceId = process.env.STRIPE_PRICE_ID;
  const successUrl = process.env.STRIPE_SUCCESS_URL;
  const cancelUrl = process.env.STRIPE_CANCEL_URL;

  if (!stripeSecretKey || !stripePriceId || !successUrl || !cancelUrl) {
    return NextResponse.json(
      { error: "Missing Stripe env (STRIPE_SECRET_KEY/PRICE_ID/SUCCESS_URL/CANCEL_URL)" },
      { status: 500 },
    );
  }

  const agency = await prisma.agency.findUnique({
    where: { id: sessionUser.agencyId },
  });
  if (!agency) return NextResponse.json({ error: "Agency not found" }, { status: 404 });

  const stripe = new Stripe(stripeSecretKey);

  // Ensure we have a Stripe Customer for the agency.
  let stripeCustomerId = agency.stripeCustomerId;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      metadata: { agencyId: agency.id },
    });
    stripeCustomerId = customer.id;
    await prisma.agency.update({
      where: { id: agency.id },
      data: { stripeCustomerId },
    });
  }

  // Create a Checkout Session that starts/extends the subscription.
  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId,
    line_items: [{ price: stripePriceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    metadata: { agencyId: agency.id },
    subscription_data: { metadata: { agencyId: agency.id } },
  });

  return NextResponse.redirect(checkout.url!);
}

