"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentAgencyId } from "@/lib/auth";
import { isAgencyPlanActive } from "@/lib/billing/plan-gate";
import { encryptJSON } from "@/lib/crypto";
import {
  INTEGRATION_CATALOG,
  type IntegrationProvider,
} from "@/lib/integrations/types";
import {
  syncAllIntegrationsForClient,
  syncIntegration,
} from "@/lib/integrations/sync-all";
import { applyToggleShareLink } from "@/lib/share/toggle-share-link";
import { assertSafeOutboundUrl } from "@/lib/security/outbound-url";

// Verify the client belongs to the current agency before any mutation.
async function assertClientInAgency(clientId: string): Promise<void> {
  const agencyId = await getCurrentAgencyId();
  const client = await prisma.client.findFirst({
    where: { id: clientId, agencyId },
    select: { id: true },
  });
  if (!client) throw new Error("Client not found for this agency");
}

/** Fail-closed entitlement — paid sync/connect requires active|trialing. */
async function assertAgencyPlanActive(): Promise<void> {
  const agencyId = await getCurrentAgencyId();
  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: { status: true },
  });
  if (!isAgencyPlanActive(agency?.status)) {
    throw new Error(
      "Plan inactive — paid sync requires active or trialing subscription",
    );
  }
}

export async function connectStripeAction(formData: FormData) {
  return connectIntegrationAction(formData);
}

export async function syncStripeAction(formData: FormData) {
  return syncIntegrationAction(formData);
}

export async function syncUptimeAction(formData: FormData) {
  return syncIntegrationAction(formData);
}

export async function connectIntegrationAction(formData: FormData) {
  const clientId = String(formData.get("clientId"));
  const provider = String(formData.get("provider")) as IntegrationProvider;
  await assertClientInAgency(clientId);
  await assertAgencyPlanActive();

  const meta = INTEGRATION_CATALOG.find((m) => m.id === provider);
  if (!meta) throw new Error("Unknown integration provider");

  const credentials: Record<string, string> = {};
  for (const field of meta.credentialFields) {
    const value = String(formData.get(field.name) ?? "").trim();
    if (value) credentials[field.name] = value;
  }

  const config: Record<string, unknown> = {};
  for (const field of meta.configFields ?? []) {
    const raw = String(formData.get(field.name) ?? "").trim();
    if (!raw) continue;
    if (field.name === "targets") {
      config.targets = raw
        .split(/[\n,]+/g)
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      config[field.name] = raw;
    }
  }

  if (provider === "stripe") {
    const apiKey = credentials.apiKey ?? "";
    if (!apiKey.startsWith("sk_") && !apiKey.startsWith("rk_")) {
      throw new Error("Enter a Stripe secret or restricted key (sk_… / rk_…)");
    }
  }

  if (provider === "uptime") {
    const targets = (config.targets as string[] | undefined) ?? [];
    if (targets.length === 0) {
      throw new Error("Add at least one uptime target URL");
    }
    for (const target of targets) {
      const safe = await assertSafeOutboundUrl(target, { httpsOnly: false });
      if (!safe.ok) {
        throw new Error(
          "Uptime target URL is not allowed (public http/https only)",
        );
      }
    }
  }

  const hasCredentials = Object.keys(credentials).length > 0;

  await prisma.integration.upsert({
    where: { clientId_provider: { clientId, provider } },
    update: {
      ...(hasCredentials ? { credentials: encryptJSON(credentials) } : {}),
      config: JSON.stringify(config),
      status: "connected",
      lastError: null,
    },
    create: {
      clientId,
      provider,
      credentials: hasCredentials ? encryptJSON(credentials) : null,
      config: JSON.stringify(config),
      status: "connected",
    },
  });

  await syncIntegration(clientId, provider);
  revalidatePath(`/dashboard/clients/${clientId}`);
  revalidatePath("/dashboard");
}

export async function syncIntegrationAction(formData: FormData) {
  const clientId = String(formData.get("clientId"));
  const provider = String(formData.get("provider")) as IntegrationProvider;
  await assertClientInAgency(clientId);
  await assertAgencyPlanActive();
  await syncIntegration(clientId, provider);
  revalidatePath(`/dashboard/clients/${clientId}`);
  revalidatePath("/dashboard");
}

export async function syncAllIntegrationsAction(formData: FormData) {
  const clientId = String(formData.get("clientId"));
  await assertClientInAgency(clientId);
  await assertAgencyPlanActive();

  const integrations = await prisma.integration.findMany({
    where: { clientId },
    select: { provider: true },
  });
  const providers = integrations.map(
    (i) => i.provider,
  ) as IntegrationProvider[];

  await syncAllIntegrationsForClient(clientId, providers);
  revalidatePath(`/dashboard/clients/${clientId}`);
  revalidatePath("/dashboard");
}

export async function createShareLinkAction(formData: FormData) {
  const clientId = String(formData.get("clientId"));
  await assertClientInAgency(clientId);
  await prisma.shareLink.create({
    data: { clientId, token: randomBytes(16).toString("hex"), enabled: true },
  });
  revalidatePath(`/dashboard/clients/${clientId}`);
}

export async function toggleShareLinkAction(formData: FormData) {
  const clientId = String(formData.get("clientId"));
  const shareLinkId = String(formData.get("shareLinkId"));
  const enabled = formData.get("enabled") === "true";
  await assertClientInAgency(clientId);
  const result = await applyToggleShareLink(
    { shareLinkId, clientId, enabled },
    {
      updateBound: (where, data) =>
        prisma.shareLink.updateMany({ where, data }),
    },
  );
  if (result === "not_found") {
    throw new Error("Share link not found for this client");
  }
  revalidatePath(`/dashboard/clients/${clientId}`);
}

export async function disconnectIntegrationAction(formData: FormData) {
  const clientId = String(formData.get("clientId"));
  const provider = String(formData.get("provider")) as IntegrationProvider;
  await assertClientInAgency(clientId);

  await prisma.integration.deleteMany({
    where: { clientId, provider },
  });

  revalidatePath(`/dashboard/clients/${clientId}`);
  revalidatePath("/dashboard");
}

export async function updateAgencySettingsAction(formData: FormData) {
  const agencyId = await getCurrentAgencyId();

  const primaryColor = String(formData.get("primaryColor") ?? "").trim();
  const accentColor = String(formData.get("accentColor") ?? "").trim();
  const alertWebhookRaw = String(formData.get("alertWebhookUrl") ?? "").trim();
  let alertWebhookUrl: string | null = null;
  if (alertWebhookRaw) {
    // Fail-closed SSRF at write time — https-only Slack-compatible webhooks.
    const safe = await assertSafeOutboundUrl(alertWebhookRaw, {
      httpsOnly: true,
    });
    if (!safe.ok) {
      throw new Error(
        safe.reason === "https_only"
          ? "Alert webhook URL must use https."
          : "Alert webhook URL is not allowed.",
      );
    }
    alertWebhookUrl = safe.url;
  }

  await prisma.agency.update({
    where: { id: agencyId },
    data: {
      ...(primaryColor ? { primaryColor } : {}),
      ...(accentColor ? { accentColor } : {}),
      alertWebhookUrl,
    },
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
}

export async function createClientAction(formData: FormData) {
  const clientName = String(formData.get("clientName") ?? "").trim();
  const website = String(formData.get("website") ?? "").trim() || null;
  const uptimeTargetsRaw = String(formData.get("uptimeTargets") ?? "");

  if (clientName.length < 2) throw new Error("Client name is required");

  const agencyId = await getCurrentAgencyId();

  const targets = uptimeTargetsRaw
    .split(/[\n,]+/g)
    .map((s) => s.trim())
    .filter(Boolean);

  const client = await prisma.client.create({
    data: {
      agencyId,
      name: clientName,
      website,
      latestUptimePct: null,
      latestChurnRate: null,
      latestMrrCents: null,
      healthScore: null,
      currency: "usd",
      integrations: {
        create: {
          provider: "uptime",
          status: "connected",
          config: JSON.stringify({ targets }),
          lastSyncedAt: null,
          credentials: null,
        },
      },
    },
  });

  revalidatePath(`/dashboard/clients/${client.id}`);
  revalidatePath("/dashboard");
  redirect(`/dashboard/clients/${client.id}`);
}
