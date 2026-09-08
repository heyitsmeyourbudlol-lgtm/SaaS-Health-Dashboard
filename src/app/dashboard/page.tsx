import Link from "next/link";
import { getCurrentAgencyId } from "@/lib/auth";
import { getPortfolio } from "@/lib/queries";
import { MetricCard } from "@/components/MetricCard";
import { HealthBadge } from "@/components/HealthBadge";
import { formatCompactMoney, formatMoney, formatPct } from "@/lib/format";
import { createClientAction } from "@/app/actions";

export const dynamic = "force-dynamic";

function AddClientForm() {
  return (
    <form
      action={createClientAction}
      className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3"
    >
      <div className="md:col-span-1">
        <label className="block text-xs font-medium text-slate-600">
          Client name
        </label>
        <input
          name="clientName"
          required
          className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </div>

      <div className="md:col-span-1">
        <label className="block text-xs font-medium text-slate-600">
          Website (optional)
        </label>
        <input
          name="website"
          placeholder="https://client.com"
          className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </div>

      <div className="md:col-span-1">
        <label className="block text-xs font-medium text-slate-600">
          Uptime targets
        </label>
        <textarea
          name="uptimeTargets"
          placeholder="https://client.com&#10;https://client.com/api/health"
          rows={3}
          className="mt-1 w-full resize-none rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </div>

      <div className="md:col-span-3">
        <button
          type="submit"
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Create client
        </button>
      </div>
    </form>
  );
}

export default async function DashboardPage() {
  const agencyId = await getCurrentAgencyId();
  const {
    clients,
    totalMrrCents,
    totalPipelineCents,
    avgUptime,
    avgChurn,
    avgInfraHealth,
    atRisk,
    integrationGaps,
    recentAlerts,
  } = await getPortfolio(agencyId);

  const hasClients = clients.length > 0;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            Who needs you today
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {clients.length} client{clients.length === 1 ? "" : "s"}
            {atRisk > 0
              ? ` · ${atRisk} at risk`
              : " · all clear on health"}
          </p>
        </div>
        {recentAlerts > 0 && (
          <Link
            href="/dashboard/settings"
            className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200"
          >
            {recentAlerts} alert{recentAlerts === 1 ? "" : "s"} this week
          </Link>
        )}
      </div>

      <div className="mt-6 max-w-xs">
        <MetricCard
          label="At risk"
          value={String(atRisk)}
          sub={
            integrationGaps > 0
              ? `${integrationGaps} missing core integrations`
              : "Health score below 55"
          }
          className={atRisk > 0 ? "ring-1 ring-red-100" : undefined}
        />
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-slate-500 hover:text-slate-700">
          Portfolio totals
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-5">
          <MetricCard
            label="Total portfolio MRR"
            value={formatCompactMoney(totalMrrCents)}
            sub="Across all clients"
          />
          <MetricCard
            label="Total pipeline"
            value={formatCompactMoney(totalPipelineCents)}
            sub="HubSpot open deals"
          />
          <MetricCard
            label="Avg. churn"
            value={formatPct(avgChurn)}
            sub="Revenue churn"
          />
          <MetricCard
            label="Avg. uptime"
            value={formatPct(avgUptime, 2)}
            sub="HTTP monitors"
          />
          <MetricCard
            label="Infra health"
            value={avgInfraHealth != null ? formatPct(avgInfraHealth, 1) : "—"}
            sub="CloudWatch alarms"
          />
        </div>
      </details>

      <div className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {!hasClients ? (
          <section className="border-b border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-700">Add a client</h3>
            <p className="mt-1 text-xs text-slate-400">
              Enter basic details and uptime targets. Connect Stripe, HubSpot, AWS,
              Datadog, and Sentry on the client page.
            </p>
            <AddClientForm />
          </section>
        ) : (
          <details className="border-b border-slate-200 bg-white p-5">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700 hover:text-slate-900">
              + Add client
            </summary>
            <p className="mt-1 text-xs text-slate-400">
              Enter basic details and uptime targets. Connect integrations on the
              client page.
            </p>
            <AddClientForm />
          </details>
        )}

        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Client</th>
              <th className="px-5 py-3 font-medium">Health</th>
              <th className="px-5 py-3 text-right font-medium">MRR</th>
              <th className="px-5 py-3 text-right font-medium">Pipeline</th>
              <th className="px-5 py-3 text-right font-medium">Churn</th>
              <th className="px-5 py-3 text-right font-medium">Uptime</th>
              <th className="px-5 py-3 text-right font-medium">Infra</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clients.map((c) => (
              <tr key={c.id} className="transition hover:bg-slate-50">
                <td className="px-5 py-4">
                  <Link
                    href={`/dashboard/clients/${c.id}`}
                    className="font-medium text-slate-900 hover:text-brand-600"
                  >
                    {c.name}
                  </Link>
                  {c.website && (
                    <p className="text-xs text-slate-400">
                      {c.website.replace(/^https?:\/\//, "")}
                    </p>
                  )}
                </td>
                <td className="px-5 py-4">
                  <HealthBadge score={c.healthScore} size="sm" />
                </td>
                <td className="px-5 py-4 text-right font-medium text-slate-900">
                  {formatMoney(c.latestMrrCents, c.currency)}
                </td>
                <td className="px-5 py-4 text-right text-slate-600">
                  {c.latestPipelineCents != null
                    ? formatCompactMoney(c.latestPipelineCents)
                    : "—"}
                </td>
                <td className="px-5 py-4 text-right text-slate-600">
                  {formatPct(c.latestChurnRate)}
                </td>
                <td className="px-5 py-4 text-right text-slate-600">
                  {formatPct(c.latestUptimePct, 2)}
                </td>
                <td className="px-5 py-4 text-right text-slate-600">
                  {formatPct(c.latestAwsAlarmPct, 1)}
                </td>
                <td className="px-5 py-4 text-right">
                  <Link
                    href={`/dashboard/clients/${c.id}`}
                    className="text-sm font-medium text-brand-600 hover:underline"
                  >
                    View →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
