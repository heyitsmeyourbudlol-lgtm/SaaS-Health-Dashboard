import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  claimStripeWebhookEvent,
  finalizeStripeWebhookEvent,
  memoryWebhookLedgerStore,
} from "./stripe-webhook-ledger";

describe("claimStripeWebhookEvent", () => {
  it("first claim returns process", async () => {
    const store = memoryWebhookLedgerStore();
    const claim = await claimStripeWebhookEvent(
      "evt_1",
      "checkout.session.completed",
      store,
    );
    assert.deepEqual(claim, { action: "process" });
  });

  it("second claim of same id is duplicate (no re-process)", async () => {
    const store = memoryWebhookLedgerStore();
    await claimStripeWebhookEvent("evt_1", "customer.subscription.updated", store);
    await finalizeStripeWebhookEvent("evt_1", { ok: true }, store);
    const again = await claimStripeWebhookEvent(
      "evt_1",
      "customer.subscription.updated",
      store,
    );
    assert.deepEqual(again, { action: "duplicate" });
  });

  it("in-flight processing claim is duplicate", async () => {
    const store = memoryWebhookLedgerStore();
    await claimStripeWebhookEvent("evt_2", "customer.subscription.created", store);
    const racing = await claimStripeWebhookEvent(
      "evt_2",
      "customer.subscription.created",
      store,
    );
    assert.deepEqual(racing, { action: "duplicate" });
  });

  it("missing event id fails closed", async () => {
    const store = memoryWebhookLedgerStore();
    const claim = await claimStripeWebhookEvent("", "checkout.session.completed", store);
    assert.equal(claim.action, "fail");
  });

  it("insert error fails closed (Stripe must retry)", async () => {
    const store = memoryWebhookLedgerStore();
    store.insertProcessing = async () => "error";
    const claim = await claimStripeWebhookEvent(
      "evt_err",
      "checkout.session.completed",
      store,
    );
    assert.deepEqual(claim, { action: "fail", error: "idempotency_failed" });
  });

  it("handler failure releases claim so retry can process", async () => {
    const store = memoryWebhookLedgerStore();
    await claimStripeWebhookEvent("evt_retry", "customer.subscription.updated", store);
    await finalizeStripeWebhookEvent(
      "evt_retry",
      { ok: false, error: "db down" },
      store,
    );
    const retry = await claimStripeWebhookEvent(
      "evt_retry",
      "customer.subscription.updated",
      store,
    );
    assert.deepEqual(retry, { action: "process" });
  });
});
