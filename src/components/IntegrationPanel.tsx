"use client";

import type { IntegrationMeta } from "@/lib/integrations/types";

interface IntegrationRecord {
  provider: string;
  status: string;
  lastSyncedAt: Date | null;
  lastError: string | null;
  config: string | null;
}

export function IntegrationPanel({
  meta,
  clientId,
  integration,
  connectAction,
  syncAction,
  disconnectAction,
}: {
  meta: IntegrationMeta;
  clientId: string;
  integration?: IntegrationRecord;
  connectAction: (formData: FormData) => Promise<void>;
  syncAction: (formData: FormData) => Promise<void>;
  disconnectAction?: (formData: FormData) => Promise<void>;
}) {
  const status = integration?.status;
  const lastSyncedLabel = integration?.lastSyncedAt
    ? `Last synced ${new Date(integration.lastSyncedAt).toLocaleString()}`
    : "Not yet synced";

  // Connected: one-line row — credentials stay collapsed so share payoff isn't buried.
  if (status === "connected") {
    return (
      <section className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-slate-700">
                {meta.label}
              </h3>
              <p className="truncate text-xs text-slate-400">{lastSyncedLabel}</p>
            </div>
            <StatusPill status={status} />
          </div>
          <div className="flex shrink-0 gap-2">
            <form action={syncAction}>
              <input type="hidden" name="clientId" value={clientId} />
              <input type="hidden" name="provider" value={meta.id} />
              <button
                type="submit"
                className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Re-sync
              </button>
            </form>
            {disconnectAction && (
              <form action={disconnectAction}>
                <input type="hidden" name="clientId" value={clientId} />
                <input type="hidden" name="provider" value={meta.id} />
                <button
                  type="submit"
                  className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                >
                  Disconnect
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">{meta.label}</h3>
          <p className="text-xs capitalize text-slate-400">{meta.category}</p>
        </div>
        <StatusPill status={status} />
      </div>
      <p className="mt-2 text-xs text-slate-500">{meta.description}</p>
      <p className="mt-1 text-xs text-slate-400">{lastSyncedLabel}</p>
      {integration?.lastError && (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {integration.lastError}
        </p>
      )}

      <form action={connectAction} className="mt-4 space-y-2">
        <input type="hidden" name="clientId" value={clientId} />
        <input type="hidden" name="provider" value={meta.id} />
        {meta.credentialFields.map((field) => (
          <div key={field.name}>
            <label className="block text-xs font-medium text-slate-600">
              {field.label}
            </label>
            <input
              type={field.type}
              name={field.name}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
        ))}
        {meta.configFields?.map((field) => (
          <div key={field.name}>
            <label className="block text-xs font-medium text-slate-600">
              {field.label}
            </label>
            {field.name === "targets" ? (
              <textarea
                name={field.name}
                rows={3}
                placeholder={field.placeholder}
                defaultValue={parseConfigList(integration?.config, field.name)}
                className="mt-1 w-full resize-none rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            ) : (
              <input
                name={field.name}
                placeholder={field.placeholder}
                defaultValue={parseConfigValue(integration?.config, field.name)}
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            )}
          </div>
        ))}
        <button
          type="submit"
          className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          Connect &amp; sync
        </button>
      </form>

      {integration && (
        <div className="mt-2 flex gap-2">
          <form action={syncAction} className="flex-1">
            <input type="hidden" name="clientId" value={clientId} />
            <input type="hidden" name="provider" value={meta.id} />
            <button
              type="submit"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Re-sync now
            </button>
          </form>
          {disconnectAction && (
            <form action={disconnectAction}>
              <input type="hidden" name="clientId" value={clientId} />
              <input type="hidden" name="provider" value={meta.id} />
              <button
                type="submit"
                className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
              >
                Disconnect
              </button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}

function parseConfigValue(config: string | null | undefined, key: string): string {
  if (!config) return "";
  try {
    const obj = JSON.parse(config) as Record<string, unknown>;
    const v = obj[key];
    return typeof v === "string" ? v : "";
  } catch {
    return "";
  }
}

function parseConfigList(config: string | null | undefined, key: string): string {
  if (!config) return "";
  try {
    const obj = JSON.parse(config) as Record<string, unknown>;
    const v = obj[key];
    if (Array.isArray(v)) return v.join("\n");
    return typeof v === "string" ? v : "";
  } catch {
    return "";
  }
}

function StatusPill({ status }: { status?: string }) {
  const map: Record<string, string> = {
    connected: "bg-emerald-50 text-emerald-700 border-emerald-200",
    error: "bg-red-50 text-red-700 border-red-200",
    revoked: "bg-slate-100 text-slate-500 border-slate-200",
  };
  const cls = map[status ?? ""] ?? "bg-slate-100 text-slate-500 border-slate-200";
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status ?? "not connected"}
    </span>
  );
}
