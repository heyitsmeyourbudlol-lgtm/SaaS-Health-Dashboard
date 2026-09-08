import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyCheckoutSessionCompleted } from "./apply-checkout-session";

describe("applyCheckoutSessionCompleted", () => {
  it("skips unpaid session (no agency mutate)", async () => {
    let applied = false;
    const action = await applyCheckoutSessionCompleted(
      {
        metadata: { agencyId: "ag_1" },
        payment_status: "unpaid",
        subscription: "sub_1",
      },
      {
        retrieveSubscription: async () => ({ status: "active" }),
        applyAgency: async () => {
          applied = true;
        },
      },
    );
    assert.equal(action, "skip");
    assert.equal(applied, false);
  });

  it("grants growth on paid + active subscription (records status)", async () => {
    const calls: Array<{
      agencyId: string;
      data: { status: string; plan: string; stripeSubscriptionId: string };
    }> = [];
    const action = await applyCheckoutSessionCompleted(
      {
        metadata: { agencyId: "ag_1" },
        payment_status: "paid",
        subscription: "sub_1",
      },
      {
        retrieveSubscription: async (id) => {
          assert.equal(id, "sub_1");
          return { status: "active" };
        },
        applyAgency: async (agencyId, data) => {
          calls.push({ agencyId, data });
        },
      },
    );
    assert.equal(action, "growth");
    assert.deepEqual(calls, [
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

  it("grants growth on no_payment_required + trialing (keeps trialing)", async () => {
    const patches: Array<{ status: string; plan: string }> = [];
    const action = await applyCheckoutSessionCompleted(
      {
        metadata: { agencyId: "ag_2" },
        payment_status: "no_payment_required",
        subscription: "sub_2",
      },
      {
        retrieveSubscription: async () => ({ status: "trialing" }),
        applyAgency: async (_id, data) => {
          patches.push({ status: data.status, plan: data.plan });
        },
      },
    );
    assert.equal(action, "growth");
    assert.deepEqual(patches, [{ status: "trialing", plan: "growth" }]);
  });

  it("skips when retrieve fails", async () => {
    let applied = false;
    const action = await applyCheckoutSessionCompleted(
      {
        metadata: { agencyId: "ag_3" },
        payment_status: "paid",
        subscription: "sub_3",
      },
      {
        retrieveSubscription: async () => {
          throw new Error("stripe down");
        },
        applyAgency: async () => {
          applied = true;
        },
      },
    );
    assert.equal(action, "skip");
    assert.equal(applied, false);
  });

  it("demotes past_due subscription (never leave prior growth)", async () => {
    const patches: Array<{ status: string; plan: string }> = [];
    const action = await applyCheckoutSessionCompleted(
      {
        metadata: { agencyId: "ag_4" },
        payment_status: "paid",
        subscription: "sub_4",
      },
      {
        retrieveSubscription: async () => ({ status: "past_due" }),
        applyAgency: async (_id, data) => {
          patches.push({ status: data.status, plan: data.plan });
        },
      },
    );
    assert.equal(action, "downgrade");
    assert.deepEqual(patches, [{ status: "past_due", plan: "trial" }]);
  });

  it("demotes unknown status fail-closed to trial", async () => {
    const patches: Array<{ status: string; plan: string }> = [];
    const action = await applyCheckoutSessionCompleted(
      {
        metadata: { agencyId: "ag_6" },
        payment_status: "paid",
        subscription: "sub_6",
      },
      {
        retrieveSubscription: async () => ({ status: "something_new" }),
        applyAgency: async (_id, data) => {
          patches.push({ status: data.status, plan: data.plan });
        },
      },
    );
    assert.equal(action, "downgrade");
    assert.deepEqual(patches, [{ status: "something_new", plan: "trial" }]);
  });

  it("skips missing subscription id", async () => {
    let applied = false;
    const action = await applyCheckoutSessionCompleted(
      {
        metadata: { agencyId: "ag_5" },
        payment_status: "paid",
        subscription: null,
      },
      {
        retrieveSubscription: async () => ({ status: "active" }),
        applyAgency: async () => {
          applied = true;
        },
      },
    );
    assert.equal(action, "skip");
    assert.equal(applied, false);
  });
});
