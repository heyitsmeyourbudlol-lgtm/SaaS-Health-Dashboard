import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applySubscriptionLifecycle,
  billingWebhookHttpResult,
  runBillingWebhookHandler,
} from "./apply-subscription-lifecycle";

describe("applySubscriptionLifecycle", () => {
  it("grants growth on active", async () => {
    const patches: Array<{ agencyId: string; data: unknown }> = [];
    const action = await applySubscriptionLifecycle(
      { id: "sub_1", status: "active", metadata: { agencyId: "ag_1" } },
      {
        updateAgency: async (agencyId, data) => {
          patches.push({ agencyId, data });
        },
      },
    );
    assert.equal(action, "grant");
    assert.deepEqual(patches, [
      {
        agencyId: "ag_1",
        data: {
          status: "active",
          plan: "growth",
          stripeSubscriptionId: "sub_1",
        },
      },
    ]);
  });

  it("grants growth on trialing (status stays trialing)", async () => {
    let patch: unknown;
    const action = await applySubscriptionLifecycle(
      { id: "sub_2", status: "trialing", metadata: { agencyId: "ag_2" } },
      {
        updateAgency: async (_id, data) => {
          patch = data;
        },
      },
    );
    assert.equal(action, "grant");
    assert.deepEqual(patch, {
      status: "trialing",
      plan: "growth",
      stripeSubscriptionId: "sub_2",
    });
  });

  it("past_due stays past_due and demotes plan (no active+growth)", async () => {
    let patch: unknown;
    const action = await applySubscriptionLifecycle(
      { id: "sub_3", status: "past_due", metadata: { agencyId: "ag_3" } },
      {
        updateAgency: async (_id, data) => {
          patch = data;
        },
      },
    );
    assert.equal(action, "downgrade");
    assert.deepEqual(patch, {
      status: "past_due",
      plan: "trial",
      stripeSubscriptionId: "sub_3",
    });
  });

  it("unpaid demotes without growth", async () => {
    let patch: unknown;
    const action = await applySubscriptionLifecycle(
      { id: "sub_4", status: "unpaid", metadata: { agencyId: "ag_4" } },
      {
        updateAgency: async (_id, data) => {
          patch = data;
        },
      },
    );
    assert.equal(action, "downgrade");
    assert.equal((patch as { status: string; plan: string }).status, "unpaid");
    assert.equal((patch as { plan: string }).plan, "trial");
  });

  it("canceled demotes plan to trial (subscription.deleted path)", async () => {
    let patch: unknown;
    const action = await applySubscriptionLifecycle(
      { id: "sub_6", status: "canceled", metadata: { agencyId: "ag_6" } },
      {
        updateAgency: async (_id, data) => {
          patch = data;
        },
      },
    );
    assert.equal(action, "downgrade");
    assert.deepEqual(patch, {
      status: "canceled",
      plan: "trial",
      stripeSubscriptionId: "sub_6",
    });
  });

  it("skips when agencyId metadata missing and no customer resolver", async () => {
    let called = false;
    const action = await applySubscriptionLifecycle(
      { id: "sub_5", status: "active", metadata: {} },
      {
        updateAgency: async () => {
          called = true;
        },
      },
    );
    assert.equal(action, "skip");
    assert.equal(called, false);
  });

  it("past_due demotes via stripeCustomerId when metadata missing (Doc2Api twin)", async () => {
    let patch: unknown;
    let agencySeen = "";
    const action = await applySubscriptionLifecycle(
      {
        id: "sub_cus",
        status: "past_due",
        customer: "cus_1",
        metadata: {},
      },
      {
        findAgencyByStripeCustomer: async (customerId) => {
          assert.equal(customerId, "cus_1");
          return { id: "ag_from_cus" };
        },
        updateAgency: async (agencyId, data) => {
          agencySeen = agencyId;
          patch = data;
        },
      },
    );
    assert.equal(action, "downgrade");
    assert.equal(agencySeen, "ag_from_cus");
    assert.deepEqual(patch, {
      status: "past_due",
      plan: "trial",
      stripeSubscriptionId: "sub_cus",
    });
  });

  it("skips when customer lookup returns null", async () => {
    let called = false;
    const action = await applySubscriptionLifecycle(
      {
        id: "sub_orphan",
        status: "past_due",
        customer: "cus_unknown",
        metadata: {},
      },
      {
        findAgencyByStripeCustomer: async () => null,
        updateAgency: async () => {
          called = true;
        },
      },
    );
    assert.equal(action, "skip");
    assert.equal(called, false);
  });
});

describe("billingWebhookHttpResult / runBillingWebhookHandler", () => {
  it("returns 200 only when handler succeeds", async () => {
    const outcome = await runBillingWebhookHandler(async () => {});
    const http = billingWebhookHttpResult(outcome);
    assert.equal(http.status, 200);
    assert.deepEqual(http.body, { received: true });
  });

  it("returns 500 (not 200) when handler throws — fail-closed for Stripe retry", async () => {
    const outcome = await runBillingWebhookHandler(async () => {
      throw new Error("prisma down");
    });
    const http = billingWebhookHttpResult(outcome);
    assert.equal(http.status, 500);
    assert.equal(http.body.error, "prisma down");
    assert.equal("received" in http.body, false);
  });
});
