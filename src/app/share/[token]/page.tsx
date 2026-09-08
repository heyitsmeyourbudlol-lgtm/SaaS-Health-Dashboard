import { notFound } from "next/navigation";
import { getClientByShareToken } from "@/lib/queries";
import { MetricCard } from "@/components/MetricCard";
import { HealthBadge } from "@/components/HealthBadge";
import { MrrChart, UptimeChart, HealthChart } from "@/components/Charts";
import { formatMoney, formatPct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getClientByShareToken(token);
  if (!data) notFound();

  const { client, agency, series } = data;
  const lastUptime = series.uptime.at(-1);
  const pipelineLatest = series.pipeline.at(-1)?.value ?? client.latestPipelineCents;

  return (
    <div className="min-h-screen bg-slate-50">
      <header
        className="border-b border-slate-200 px-6 py-5"
        style={{ backgroundColor: agency.primaryColor }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20 text-sm font-bold text-white">
              {agency.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{agency.name}</p>
              <p className="text-xs text-white/70">Client health report</p>
            </div>
          </div>
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white">
            Read-only
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {client.name}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Financial, commercial &amp; technical health overview
            </p>
          </div>
          <HealthBadge score={client.healthScore} size="lg" />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
          <MetricCard
            label="MRR"
            value={formatMoney(client.latestMrrCents, client.currency)}
          />
          <MetricCard
            label="Uptime"
            value={formatPct(client.latestUptimePct, 2)}
          />
          <MetricCard
            label="Pipeline"
            value={
              pipelineLatest != null
                ? formatMoney(pipelineLatest, client.currency)
                : "—"
            }
          />
        </div>

        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-500 hover:text-slate-700">
            Details
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-5">
            <MetricCard label="Churn" value={formatPct(client.latestChurnRate)} />
            <MetricCard
              label="Open deals"
              value={
                client.latestOpenDeals != null
                  ? String(client.latestOpenDeals)
                  : "—"
              }
            />
            <MetricCard
              label="AWS alarms"
              value={formatPct(client.latestAwsAlarmPct, 1)}
            />
            <MetricCard
              label="Synthetics"
              value={formatPct(client.latestSyntheticsPct, 1)}
            />
            <MetricCard
              label="Unresolved errors"
              value={
                client.latestErrorCount != null
                  ? String(client.latestErrorCount)
                  : "—"
              }
            />
          </div>
        </details>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700">MRR trend</h3>
            <p className="mb-3 text-xs text-slate-400">Last 12 months</p>
            <MrrChart
              data={series.mrr}
              currency={client.currency}
              color={agency.primaryColor}
            />
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700">Uptime</h3>
            <p className="mb-3 text-xs text-slate-400">
              Monthly % ·{" "}
              {lastUptime
                ? `Last check ${new Date(lastUptime.capturedAt).toLocaleString()}`
                : "No checks run yet"}
            </p>
            <UptimeChart data={series.uptime} color={agency.primaryColor} />
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700">Health score</h3>
            <p className="mb-3 text-xs text-slate-400">Blended score over time</p>
            <HealthChart data={series.health} />
          </section>
        </div>

        <p className="mt-10 text-center text-xs text-slate-400">
          Powered by {agency.name}
        </p>
      </main>
    </div>
  );
}
