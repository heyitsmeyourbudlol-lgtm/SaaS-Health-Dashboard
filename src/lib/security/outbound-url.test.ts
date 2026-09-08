import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertSafeOutboundUrl,
  isBlockedHostnameOrIp,
} from "./outbound-url";

describe("isBlockedHostnameOrIp", () => {
  it("blocks private IPv4, localhost, and metadata", () => {
    assert.equal(isBlockedHostnameOrIp("127.0.0.1"), true);
    assert.equal(isBlockedHostnameOrIp("10.0.0.5"), true);
    assert.equal(isBlockedHostnameOrIp("192.168.1.1"), true);
    assert.equal(isBlockedHostnameOrIp("169.254.169.254"), true);
    assert.equal(isBlockedHostnameOrIp("localhost"), true);
  });

  it("allows public hostnames", () => {
    assert.equal(isBlockedHostnameOrIp("example.com"), false);
    assert.equal(isBlockedHostnameOrIp("hooks.slack.com"), false);
  });
});

describe("assertSafeOutboundUrl", () => {
  it("rejects private literal IPs without DNS (webhook https-only)", async () => {
    const meta = await assertSafeOutboundUrl(
      "https://169.254.169.254/latest/meta-data/",
      { httpsOnly: true, resolveDns: false },
    );
    assert.equal(meta.ok, false);
    if (!meta.ok) assert.equal(meta.reason, "blocked_host");

    const local = await assertSafeOutboundUrl("http://127.0.0.1/", {
      httpsOnly: true,
      resolveDns: false,
    });
    assert.equal(local.ok, false);
    if (!local.ok) assert.equal(local.reason, "https_only");
  });

  it("allows https public host for webhooks when DNS skipped", async () => {
    const ok = await assertSafeOutboundUrl("https://hooks.slack.com/services/T/B/X", {
      httpsOnly: true,
      resolveDns: false,
    });
    assert.equal(ok.ok, true);
    if (ok.ok) assert.match(ok.url, /^https:\/\/hooks\.slack\.com\//);
  });

  it("allows http public host for uptime probes when DNS skipped", async () => {
    const ok = await assertSafeOutboundUrl("http://example.com/healthz", {
      httpsOnly: false,
      resolveDns: false,
    });
    assert.equal(ok.ok, true);
  });
});
