import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="text-sm font-semibold text-slate-800">
            SaaS Health Dashboard
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link className="text-slate-600 hover:text-slate-900" href="/pricing">
              Pricing
            </Link>
            <Link className="text-slate-600 hover:text-slate-900" href="/login">
              Log in
            </Link>
            <Link
              className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
              href="/signup"
            >
              Create account
            </Link>
          </nav>
        </div>
      </header>

      {/* First viewport: brand · one line · one CTA · full-bleed proof — Newdrop MarketingHomeMain pattern */}
      <main>
        <section className="mx-auto max-w-3xl px-6 pb-12 pt-16 text-center sm:pb-16 sm:pt-24">
          <h1 className="text-5xl font-semibold tracking-tight text-slate-900 sm:text-6xl">
            SaaS Health Dashboard
          </h1>
          <p className="mt-4 text-lg text-slate-600 sm:text-xl">
            Who needs you today — across every client.
          </p>
          <div className="mt-8">
            <Link
              href="/signup"
              className="inline-block rounded-md bg-brand-600 px-5 py-3 text-sm font-medium text-white hover:bg-brand-700"
            >
              Start free, then $99/mo
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-500">
            <Link href="/pricing" className="font-medium text-brand-600 hover:underline">
              See pricing
            </Link>
          </p>
        </section>

        <section
          aria-label="Client portal preview"
          className="border-y border-slate-200 bg-slate-900 px-6 py-16 sm:py-20"
        >
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Live demo
            </p>
            <p className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
              What your client sees
            </p>
            <p className="mx-auto mt-4 max-w-xl text-sm text-slate-300">
              Share a read-only link: MRR, pipeline, uptime, and health at a
              glance — white-labeled to your agency.
            </p>
            <div className="mx-auto mt-10 grid max-w-2xl grid-cols-3 gap-3 text-left sm:gap-4">
              <ProofTile label="Health" value="84" />
              <ProofTile label="MRR" value="$42k" />
              <ProofTile label="At risk" value="2" />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-14">
          <p className="text-center text-sm text-slate-500">
            Also: Stripe · HubSpot · AWS · Datadog · Sentry · Slack
          </p>
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Feature label="6 integrations" value="Stripe → Sentry" />
            <Feature label="Health score" value="Blended 0–100" />
            <Feature label="Alerts" value="Slack webhooks" />
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <div>© {new Date().getFullYear()} SaaS Health Dashboard</div>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-slate-700">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-slate-700">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ProofTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-4">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function Feature({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
