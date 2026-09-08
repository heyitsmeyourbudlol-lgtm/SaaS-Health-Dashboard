import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  agencyPlanGateResult,
  isAgencyPlanActive,
} from "./plan-gate";

describe("isAgencyPlanActive", () => {
  it("allows active and trialing only", () => {
    assert.equal(isAgencyPlanActive("active"), true);
    assert.equal(isAgencyPlanActive("trialing"), true);
  });

  it("fails closed for past_due, canceled, unpaid, product trial, empty", () => {
    assert.equal(isAgencyPlanActive("past_due"), false);
    assert.equal(isAgencyPlanActive("canceled"), false);
    assert.equal(isAgencyPlanActive("unpaid"), false);
    assert.equal(isAgencyPlanActive("trial"), false);
    assert.equal(isAgencyPlanActive(""), false);
    assert.equal(isAgencyPlanActive(null), false);
    assert.equal(isAgencyPlanActive(undefined), false);
  });
});

describe("agencyPlanGateResult", () => {
  it("returns ok for active", () => {
    assert.deepEqual(agencyPlanGateResult("active"), { ok: true });
  });

  it("returns 403 (not 200) for past_due", () => {
    const r = agencyPlanGateResult("past_due");
    assert.equal(r.ok, false);
    if (r.ok) throw new Error("unreachable");
    assert.equal(r.status, 403);
    assert.equal(typeof r.body.error, "string");
  });
});
