import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAgencyPlanActive } from "@/lib/billing/plan-gate";
import type { IntegrationProvider } from "@/lib/integrations/types";
import { syncAllIntegrationsForClient } from "@/lib/integrations/sync-all";
import { bearerMatches } from "@/lib/security/secrets";

// Scheduled sync for all clients (Vercel Cron, etc.).
// Protect with CRON_SECRET header: Authorization: Bearer <secret>
// Paid sync is fail-closed on agency.status (active|trialing only).
// Bearer compare is constant-time (Newdrop bearerMatches) — never `!==` on secrets.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }
  if (!bearerMatches(request, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clients = await prisma.client.findMany({
    where: { archived: false },
    select: {
      id: true,
      name: true,
      agency: { select: { status: true } },
    },
  });

  const summary: { clientId: string; name: string; results: unknown[] }[] = [];
  let skippedInactive = 0;

  for (const client of clients) {
    if (!isAgencyPlanActive(client.agency.status)) {
      skippedInactive += 1;
      continue;
    }

    const integrations = await prisma.integration.findMany({
      where: { clientId: client.id },
      select: { provider: true },
    });
    const providers = integrations.map(
      (i) => i.provider,
    ) as IntegrationProvider[];

    if (!providers?.length) continue;

    const results = await syncAllIntegrationsForClient(client.id, providers);
    summary.push({ clientId: client.id, name: client.name, results });
  }

  return NextResponse.json({
    ok: true,
    syncedClients: summary.length,
    skippedInactive,
    summary,
  });
}
