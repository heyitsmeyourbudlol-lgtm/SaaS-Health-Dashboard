import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bearerMatches, secretsEqual } from "./secrets";

describe("secretsEqual", () => {
  it("matches equal secrets", () => {
    assert.equal(secretsEqual("cron-secret", "cron-secret"), true);
  });

  it("rejects wrong, null, or undefined", () => {
    assert.equal(secretsEqual("cron-secret", "cron-secreX"), false);
    assert.equal(secretsEqual(null, "cron-secret"), false);
    assert.equal(secretsEqual("cron-secret", undefined), false);
  });
});

describe("bearerMatches", () => {
  it("accepts matching Bearer token", () => {
    const req = new Request("http://localhost/api/cron/sync", {
      headers: { authorization: "Bearer cron-secret" },
    });
    assert.equal(bearerMatches(req, "cron-secret"), true);
  });

  it("rejects missing, wrong, or non-Bearer auth (cron fail-closed)", () => {
    const noAuth = new Request("http://localhost/api/cron/sync");
    const wrong = new Request("http://localhost/api/cron/sync", {
      headers: { authorization: "Bearer other" },
    });
    const basic = new Request("http://localhost/api/cron/sync", {
      headers: { authorization: "Basic cron-secret" },
    });
    assert.equal(bearerMatches(noAuth, "cron-secret"), false);
    assert.equal(bearerMatches(wrong, "cron-secret"), false);
    assert.equal(bearerMatches(basic, "cron-secret"), false);
    assert.equal(bearerMatches(wrong, undefined), false);
  });
});
