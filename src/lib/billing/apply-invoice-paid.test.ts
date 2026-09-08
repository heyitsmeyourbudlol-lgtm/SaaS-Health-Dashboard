import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyInvoicePaid,
  applyInvoicePaymentFailed,
} from "./apply-invoice-paid";

describe("applyInvoicePaid", () => {
  it("skips amount_paid <= 0", async () => {
    let updated = false;
    const action = await applyInvoicePaid(
      { amount_paid: 0, customer: "cus_1", subscription: "sub_1" },
      {
        findAgencyByStripeCustomer: async () => ({ id: "ag_1" }),
        retrieveSubscription: async () => ({ status: "active" }),
        updateAgency: async () => {
          updated = true;
        },
      },
    );
    assert.equal(action, "skip");
    assert.equal(updated, false);
  });

  it("skips when agency not found for customer", async () => {
    let updated = false;
    const action = await applyInvoicePaid(
      { amount_paid: 1999, customer: "cus_missing", subscription: "sub_1" },
      {
        findAgencyByStripeCustomer: async () => null,
        retrieveSubscription: async () => ({ status: "active" }),
        updateAgency: async () => {
          updated = true;
        },
      },
    );
    assert.equal(action, "skip");
    assert.equal(updated, false);
  });

  it("skips missing subscription id (never blind growth)", async () => {
    let updated = false;
    const action = await applyInvoicePaid(
      { amount_paid: 1999, customer: "cus_1", subscription: null },
      {
        findAgencyByStripeCustomer: async () => ({ id: "ag_1" }),
        retrieveSubscription: async () => ({ status: "active" }),
        updateAgency: async () => {
          updated = true;
        },
      },
    );
    assert.equal(action, "skip");
    assert.equal(updated, false);
  });

  it("skips when retrieve fails", async () => {
    let updated = false;
    const action = await applyInvoicePaid(
      { amount_paid: 1999, customer: "cus_1", subscription: "sub_1" },
      {
        findAgencyByStripeCustomer: async () => ({ id: "ag_1" }),
        retrieveSubscription: async () => {
          throw new Error("stripe down");
        },
        updateAgency: async () => {
          updated = true;
        },
      },
    );
    assert.equal(action, "skip");
    assert.equal(updated, false);
  });

  it("grants growth on active subscription", async () => {
    let patch: unknown;
    const action = await applyInvoicePaid(
      { amount_paid: 1999, customer: "cus_1", subscription: "sub_1" },
      {
        findAgencyByStripeCustomer: async (id) => {
          assert.equal(id, "cus_1");
          return { id: "ag_1" };
        },
        retrieveSubscription: async (id) => {
          assert.equal(id, "sub_1");
          return { status: "active" };
        },
        updateAgency: async (_id, data) => {
          patch = data;
        },
      },
    );
    assert.equal(action, "growth");
    assert.deepEqual(patch, {
      status: "active",
      plan: "growth",
      stripeSubscriptionId: "sub_1",
    });
  });

  it("past_due demotes plan (no active+growth)", async () => {
    let patch: unknown;
    const action = await applyInvoicePaid(
      { amount_paid: 1999, customer: "cus_2", subscription: "sub_pd" },
      {
        findAgencyByStripeCustomer: async () => ({ id: "ag_2" }),
        retrieveSubscription: async () => ({ status: "past_due" }),
        updateAgency: async (_id, data) => {
          patch = data;
        },
      },
    );
    assert.equal(action, "downgrade");
    assert.deepEqual(patch, {
      status: "past_due",
      plan: "trial",
      stripeSubscriptionId: "sub_pd",
    });
  });

  it("unknown status fail-closed to trial", async () => {
    let patch: unknown;
    const action = await applyInvoicePaid(
      { amount_paid: 500, customer: "cus_3", subscription: "sub_unk" },
      {
        findAgencyByStripeCustomer: async () => ({ id: "ag_3" }),
        retrieveSubscription: async () => ({ status: "something_new" }),
        updateAgency: async (_id, data) => {
          patch = data;
        },
      },
    );
    assert.equal(action, "downgrade");
    assert.deepEqual(patch, {
      status: "something_new",
      plan: "trial",
      stripeSubscriptionId: "sub_unk",
    });
  });
});

describe("applyInvoicePaymentFailed", () => {
  it("sets past_due + trial via stripeCustomerId", async () => {
    let patch: unknown;
    const action = await applyInvoicePaymentFailed(
      { customer: "cus_fail", subscription: "sub_fail" },
      {
        findAgencyByStripeCustomer: async (id) => {
          assert.equal(id, "cus_fail");
          return { id: "ag_fail" };
        },
        updateAgency: async (_id, data) => {
          patch = data;
        },
      },
    );
    assert.equal(action, "past_due");
    assert.deepEqual(patch, {
      status: "past_due",
      plan: "trial",
      stripeSubscriptionId: "sub_fail",
    });
  });

  it("skips when customer missing", async () => {
    let updated = false;
    const action = await applyInvoicePaymentFailed(
      { customer: null, subscription: "sub_x" },
      {
        findAgencyByStripeCustomer: async () => ({ id: "ag_x" }),
        updateAgency: async () => {
          updated = true;
        },
      },
    );
    assert.equal(action, "skip");
    assert.equal(updated, false);
  });
});
