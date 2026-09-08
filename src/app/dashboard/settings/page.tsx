import { getCurrentAgencyId } from "@/lib/auth";
import { getAgencySettings } from "@/lib/queries";
import { MetricCard } from "@/components/MetricCard";
import { updateAgencySettingsAction } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const agencyId = await getCurrentAgencyId();
  const { agency, recentAlerts } = await getAgencySettings(agencyId);
  if (!agency) return null;

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
        Branding &amp; settings
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        White-label the client portal and configure alert notifications.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <MetricCard label="Agency" value={agency.name} sub={`/${agency.slug}`} />
        <MetricCard label="Plan" value={agency.plan} sub={agency.status} />
      </div>

      <form action={updateAgencySettingsAction}>
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700">Brand colors</h3>
          <p className="mt-1 text-xs text-slate-400">
            Applied to share links and client reports.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600">
                Primary color
              </label>
              <input
                name="primaryColor"
                type="color"
                defaultValue={agency.primaryColor}
                className="mt-1 h-10 w-full cursor-pointer rounded-md border border-slate-200"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">
                Accent color
              </label>
              <input
                name="accentColor"
                type="color"
                defaultValue={agency.accentColor}
                className="mt-1 h-10 w-full cursor-pointer rounded-md border border-slate-200"
              />
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700">
            Alert notifications
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            Slack-compatible webhook URL. Alerts fire when health, uptime, churn,
            or error thresholds are breached (max once per 6 hours per alert type).
          </p>
          <div className="mt-4">
            <label className="block text-xs font-medium text-slate-600">
              Webhook URL
            </label>
            <input
              name="alertWebhookUrl"
              type="url"
              placeholder="https://hooks.slack.com/services/..."
              defaultValue={agency.alertWebhookUrl ?? ""}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
        </section>

        <div className="mt-4">
          <button
            type="submit"
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Save settings
          </button>
        </div>
      </form>

      {recentAlerts.length > 0 && (
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700">Recent alerts</h3>
          <ul className="mt-4 space-y-2">
            {recentAlerts.map((alert) => (
              <li
                key={alert.id}
                className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={
                      alert.severity === "critical"
                        ? "font-medium text-red-700"
                        : "font-medium text-amber-700"
                    }
                  >
                    {alert.severity}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(alert.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 text-slate-600">{alert.message}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {alert.sent ? "Delivered to webhook" : "Logged (no webhook configured)"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700">Billing</h3>
        <p className="mt-1 text-sm text-slate-600">
          Subscription status:{" "}
          <span className="font-medium text-slate-900">{agency.status}</span>
        </p>

        <div className="mt-4">
          {agency.status === "active" ? (
            <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Your agency is subscribed.
            </div>
          ) : agency.status === "trialing" ? (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              Trial active — subscribe anytime to keep white-label reports live.
            </div>
          ) : agency.status === "past_due" ? (
            <div>
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Payment past due — update billing to restore a clean subscribed
                state. Share links should not be treated as fully active.
              </div>
              <form action="/api/billing/checkout" method="post" className="mt-3">
                <button
                  type="submit"
                  className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  Fix billing
                </button>
              </form>
            </div>
          ) : (
            <div>
              <p className="text-sm text-slate-600">
                {agency.status === "canceled"
                  ? "Subscription canceled — resubscribe to activate billing ($99/month per agency)."
                  : "Subscribe to activate billing ($99/month per agency)."}
              </p>
              <form action="/api/billing/checkout" method="post" className="mt-3">
                <button
                  type="submit"
                  className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  Subscribe $99/mo
                </button>
              </form>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
