import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentAgencyId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getClientDetail } from "@/lib/queries";
import { MetricCard } from "@/components/MetricCard";
import { HealthBadge } from "@/components/HealthBadge";
import { MrrChart, UptimeChart, HealthChart } from "@/components/Charts";
import { CopyButton } from "@/components/CopyButton";
import { IntegrationPanel } from "@/components/IntegrationPanel";
import { formatMoney, formatPct } from "@/lib/format";
import { INTEGRATION_CATALOG } from "@/lib/integrations/types";
import {
  connectIntegrationAction,
  createShareLinkAction,
  disconnectIntegrationAction,
  syncAllIntegrationsAction,
  syncIntegrationAction,
  toggleShareLinkAction,
} from "@/app/actions";

export const dynamic = "force-dynamic";

function trendFromSeries(series: { value: number }[]): number | null {
  if (series.length < 2) return null;
  const prev = series[series.length - 2].value;
  const curr = series[series.length - 1].value;
  if (prev <= 0) return null;
  return ((curr - prev) / prev) * 100;
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agencyId = await getCurrentAgencyId();
  const [detail, agencyBrand] = await Promise.all([
    getClientDetail(agencyId, id),
    prisma.agency.findUnique({
      where: { id: agencyId },
      select: { primaryColor: true },
    }),
  ]);
  if (!detail) notFound();

  const { client, series } = detail;
  const mrrColor = agencyBrand?.primaryColor;
  const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
  const integrationByProvider = Object.fromEntries(
    client.integrations.map((i) => [i.provider, i]),
  );
  const mrrTrend = trendFromSeries(series.mrr);
  const subsLatest = series.activeSubs.at(-1)?.value ?? null;
  const pipelineLatest = series.pipeline.at(-1)?.value ?? null;
  const openDealsLatest = series.openDeals.at(-1)?.value ?? null;

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/dashboard"
        className="text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        ← Portfolio
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            {client.name}
          </h2>
          <HealthBadge score={client.healthScore} size="md" />
        </div>
        {client.website && (
          <a
            href={client.website}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-brand-600 hover:underline"
          >
            {client.website.replace(/^https?:\/\//, "")} ↗
          </a>
        )}
      </div>

      {/* One job: how is this client — three primaries; rest behind disclosure */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label="MRR"
          value={formatMoney(client.latestMrrCents, client.currency)}
          trend={mrrTrend != null ? { value: mrrTrend } : null}
          sub="Financial"
        />
        <MetricCard
          label="Uptime"
          value={formatPct(client.latestUptimePct, 2)}
          sub="HTTP monitors"
        />
        <MetricCard
          label="Revenue churn"
          value={formatPct(client.latestChurnRate)}
          sub="At risk"
        />
      </div>

      <details className="mt-4 group">
        <summary className="cursor-pointer list-none text-sm font-medium text-slate-500 hover:text-slate-800 [&::-webkit-details-marker]:hidden">
          <span className="underline-offset-2 group-open:no-underline">
            More signals
          </span>
          <span className="ml-1 text-slate-400 group-open:hidden">· subscribers, pipeline, infra</span>
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-3">
          <MetricCard
            label="Active subscribers"
            value={subsLatest != null ? String(Math.round(subsLatest)) : "—"}
            sub="Stripe"
          />
          <MetricCard
            label="Open pipeline"
            value={
              pipelineLatest != null
                ? formatMoney(pipelineLatest, client.currency)
                : client.latestPipelineCents != null
                  ? formatMoney(client.latestPipelineCents, client.currency)
                  : "—"
            }
            sub="HubSpot"
          />
          <MetricCard
            label="Open deals"
            value={
              openDealsLatest != null
                ? String(Math.round(openDealsLatest))
                : client.latestOpenDeals != null
                  ? String(client.latestOpenDeals)
                  : "—"
            }
            sub="HubSpot"
          />
          <MetricCard
            label="AWS alarms"
            value={formatPct(client.latestAwsAlarmPct, 1)}
            sub="CloudWatch"
          />
          <MetricCard
            label="Synthetics"
            value={formatPct(client.latestSyntheticsPct, 1)}
            sub="Datadog"
          />
          {(client.latestErrorCount != null || series.errors.length > 0) && (
            <MetricCard
              label="Unresolved errors"
              value={String(client.latestErrorCount ?? "—")}
              sub="Sentry"
              className={
                client.latestErrorCount != null && client.latestErrorCount > 25
                  ? "ring-1 ring-red-100"
                  : undefined
              }
            />
          )}
        </div>
      </details>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700">MRR trend</h3>
          <p className="mb-3 text-xs text-slate-400">Last 12 months</p>
          <MrrChart
            data={series.mrr}
            currency={client.currency}
            color={mrrColor}
          />
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700">Uptime</h3>
          <p className="mb-3 text-xs text-slate-400">Monthly % · target 99.9%</p>
          <UptimeChart data={series.uptime} color={mrrColor} />
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700">Health score</h3>
          <p className="mb-3 text-xs text-slate-400">Blended financial + technical</p>
          <HealthChart data={series.health} />
        </section>
      </div>

      {/* Share first — white-label payoff above integration catalog */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">
              Shareable client link
            </h3>
            <form action={createShareLinkAction}>
              <input type="hidden" name="clientId" value={client.id} />
              <button
                type="submit"
                className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
              >
                + New link
              </button>
            </form>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Read-only, white-labeled view. Revoke anytime.
          </p>

          <div className="mt-4 space-y-3">
            {client.shareLinks.length === 0 && (
              <p className="text-sm text-slate-400">No share links yet.</p>
            )}
            {client.shareLinks.map((link) => {
              const url = `${baseUrl}/share/${link.token}`;
              return (
                <div
                  key={link.id}
                  className="rounded-lg border border-slate-100 bg-slate-50 p-3"
                >
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={url}
                      className="min-w-0 flex-1 truncate rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
                    />
                    <CopyButton value={url} />
                    <a
                      href={`/share/${link.token}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Open
                    </a>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                    <span>
                      {link.viewCount} view{link.viewCount === 1 ? "" : "s"}
                      {link.enabled ? "" : " · disabled"}
                    </span>
                    <form action={toggleShareLinkAction}>
                      <input type="hidden" name="clientId" value={client.id} />
                      <input type="hidden" name="shareLinkId" value={link.id} />
                      <input
                        type="hidden"
                        name="enabled"
                        value={(!link.enabled).toString()}
                      />
                      <button
                        type="submit"
                        className="font-medium text-slate-500 hover:text-slate-800"
                      >
                        {link.enabled ? "Disable" : "Enable"}
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Integrations */}
      <div className="mt-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">
              Connected services
            </h3>
            <p className="text-xs text-slate-500">
              Stripe, HubSpot, AWS CloudWatch, Datadog, Sentry, and HTTP uptime —
              per client.
            </p>
          </div>
          <form action={syncAllIntegrationsAction}>
            <input type="hidden" name="clientId" value={client.id} />
            <button
              type="submit"
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Sync all services
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {INTEGRATION_CATALOG.map((meta) => (
            <IntegrationPanel
              key={meta.id}
              meta={meta}
              clientId={client.id}
              integration={integrationByProvider[meta.id]}
              connectAction={connectIntegrationAction}
              syncAction={syncIntegrationAction}
              disconnectAction={disconnectIntegrationAction}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
