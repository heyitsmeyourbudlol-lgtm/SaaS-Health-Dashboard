import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeAtRiskMrrCents,
  computeMrrCents,
  countActiveSubscribers,
  isActive,
  isAtRisk,
  type NormalizedSubscription,
} from "./metrics";

function sub(
  overrides: Partial<NormalizedSubscription> & Pick<NormalizedSubscription, "id" | "status">,
): NormalizedSubscription {
  return {
    amountCents: 10000,
    interval: "month",
    intervalCount: 1,
    currency: "usd",
    customerId: "cus_1",
    ...overrides,
  };
}

describe("computeMrrCents / past_due exclusion", () => {
  it("past_due-only portfolio reports zero active MRR", () => {
    const portfolio = [sub({ id: "sub_pd", status: "past_due", amountCents: 50000 })];
    assert.equal(computeMrrCents(portfolio), 0);
    assert.equal(countActiveSubscribers(portfolio), 0);
    assert.equal(isActive(portfolio[0]), false);
  });

  it("active + trialing still count toward healthy MRR", () => {
    const portfolio = [
      sub({ id: "sub_a", status: "active", amountCents: 10000, customerId: "cus_a" }),
      sub({ id: "sub_t", status: "trialing", amountCents: 20000, customerId: "cus_t" }),
      sub({ id: "sub_pd", status: "past_due", amountCents: 99999, customerId: "cus_pd" }),
    ];
    assert.equal(computeMrrCents(portfolio), 30000);
    assert.equal(countActiveSubscribers(portfolio), 2);
  });

  it("surfaces past_due as at-risk ARR separately", () => {
    const portfolio = [
      sub({ id: "sub_a", status: "active", amountCents: 10000 }),
      sub({ id: "sub_pd", status: "past_due", amountCents: 40000, customerId: "cus_pd" }),
    ];
    assert.equal(computeAtRiskMrrCents(portfolio), 40000);
    assert.equal(isAtRisk(portfolio[1]), true);
    assert.equal(isAtRisk(portfolio[0]), false);
  });
});
