import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
]);

/** True for private / link-local / metadata IPs (SSRF guard). Ported from Newdrop. */
export function isBlockedHostnameOrIp(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (host === "::1" || host === "0:0:0:0:0:0:0:1") return true;

  const mapped = host.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mapped) return isBlockedHostnameOrIp(mapped[1]);

  const ipVersion = isIP(host);
  if (ipVersion === 4) {
    const parts = host.split(".").map(Number);
    if (parts.some((n) => n > 255)) return true;
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }

  if (ipVersion === 6) {
    if (host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) {
      return true;
    }
    return false;
  }

  return false;
}

export type OutboundUrlPolicy = {
  /** Webhooks / signed delivery — https only. Uptime probes may allow http. */
  httpsOnly?: boolean;
  /** Resolve DNS and reject private answers (rebinding). Default true. */
  resolveDns?: boolean;
};

/**
 * Fail-closed outbound URL check before server-side fetch.
 * Blocks private/metadata hosts, credentials-in-URL, and (optionally) non-https.
 */
export async function assertSafeOutboundUrl(
  raw: string,
  policy: OutboundUrlPolicy = {},
): Promise<{ ok: true; url: string } | { ok: false; reason: string }> {
  const httpsOnly = policy.httpsOnly ?? false;
  const resolveDns = policy.resolveDns ?? true;
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return { ok: false, reason: "empty" };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, reason: "invalid" };
  }

  if (httpsOnly) {
    if (url.protocol !== "https:") return { ok: false, reason: "https_only" };
  } else if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, reason: "http_https_only" };
  }

  if (url.username || url.password) return { ok: false, reason: "no_creds" };
  if (isBlockedHostnameOrIp(url.hostname)) {
    return { ok: false, reason: "blocked_host" };
  }

  if (resolveDns) {
    try {
      const records = await lookup(url.hostname, { all: true });
      for (const rec of records) {
        if (isBlockedHostnameOrIp(rec.address)) {
          return { ok: false, reason: "blocked_dns" };
        }
      }
    } catch {
      return { ok: false, reason: "dns_failed" };
    }
  }

  return { ok: true, url: url.toString() };
}
