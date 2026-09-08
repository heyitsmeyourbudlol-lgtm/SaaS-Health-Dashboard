/**
 * Fail-closed Stripe webhook idempotency — claim event.id before mutate.
 * Portfolio twin of CaaS stripe_webhook_events claim (route.ts claim-before-mutate).
 */

export type WebhookLedgerRow = {
  status: "processing" | "done";
};

export type WebhookLedgerStore = {
  find: (id: string) => Promise<WebhookLedgerRow | null>;
  /** Insert processing row. conflict = unique race; error = DB unavailable. */
  insertProcessing: (
    id: string,
    type: string,
  ) => Promise<"ok" | "conflict" | "error">;
  markDone: (id: string) => Promise<void>;
  /** Release claim so Stripe retry can re-process after handler failure. */
  release: (id: string) => Promise<void>;
};

export type ClaimResult =
  | { action: "process" }
  | { action: "duplicate" }
  | { action: "fail"; error: string };

/** Claim event.id before Agency mutate. Fail-closed on store errors. */
export async function claimStripeWebhookEvent(
  eventId: string,
  eventType: string,
  store: WebhookLedgerStore,
): Promise<ClaimResult> {
  if (!eventId) {
    return { action: "fail", error: "missing_event_id" };
  }
  try {
    const existing = await store.find(eventId);
    if (existing?.status === "done" || existing?.status === "processing") {
      return { action: "duplicate" };
    }
    const inserted = await store.insertProcessing(eventId, eventType);
    if (inserted === "conflict") return { action: "duplicate" };
    if (inserted === "error") {
      return { action: "fail", error: "idempotency_failed" };
    }
    return { action: "process" };
  } catch (err) {
    return {
      action: "fail",
      error:
        err instanceof Error ? err.message : "idempotency_unavailable",
    };
  }
}

/** After handler: mark done on success; release claim on failure (Stripe retries). */
export async function finalizeStripeWebhookEvent(
  eventId: string,
  outcome: { ok: true } | { ok: false; error: string },
  store: WebhookLedgerStore,
): Promise<void> {
  if (outcome.ok) {
    await store.markDone(eventId);
    return;
  }
  await store.release(eventId);
}

/** In-memory store for unit tests. */
export function memoryWebhookLedgerStore(): WebhookLedgerStore {
  const rows = new Map<string, { status: "processing" | "done"; type: string }>();
  return {
    find: async (id) => {
      const row = rows.get(id);
      return row ? { status: row.status } : null;
    },
    insertProcessing: async (id, type) => {
      if (rows.has(id)) return "conflict";
      rows.set(id, { status: "processing", type });
      return "ok";
    },
    markDone: async (id) => {
      const row = rows.get(id);
      if (row) row.status = "done";
    },
    release: async (id) => {
      rows.delete(id);
    },
  };
}
