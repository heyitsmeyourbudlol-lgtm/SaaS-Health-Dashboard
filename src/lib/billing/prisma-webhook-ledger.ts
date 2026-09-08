/**
 * Prisma adapter for Stripe webhook event ledger (SQLite/Postgres portable).
 */
import { prisma } from "@/lib/db";
import type { WebhookLedgerStore } from "./stripe-webhook-ledger";

export function prismaWebhookLedgerStore(): WebhookLedgerStore {
  return {
    find: async (id) => {
      const row = await prisma.stripeWebhookEvent.findUnique({ where: { id } });
      if (!row) return null;
      if (row.status !== "processing" && row.status !== "done") return null;
      return { status: row.status };
    },
    insertProcessing: async (id, type) => {
      try {
        await prisma.stripeWebhookEvent.create({
          data: { id, type, status: "processing" },
        });
        return "ok";
      } catch (err) {
        const code =
          err && typeof err === "object" && "code" in err
            ? String((err as { code?: string }).code)
            : "";
        // Prisma unique violation
        if (code === "P2002") return "conflict";
        console.error("stripe webhook ledger insert failed", err);
        return "error";
      }
    },
    markDone: async (id) => {
      await prisma.stripeWebhookEvent.update({
        where: { id },
        data: { status: "done", processedAt: new Date() },
      });
    },
    release: async (id) => {
      await prisma.stripeWebhookEvent.deleteMany({ where: { id } });
    },
  };
}
