import Link from "next/link";

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-lg px-6 py-16 text-center sm:py-24">
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
          $99/mo
        </h1>
        <p className="mt-3 text-slate-600">
          One plan. Flat. Cancel anytime.
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Per agency — white-labeled client health dashboards included.
        </p>

        <ul className="mx-auto mt-10 max-w-sm space-y-3 text-left text-sm text-slate-600">
          <li>
            <span className="font-medium text-slate-900">MRR + churn</span>
            {" — "}Stripe signals for every client.
          </li>
          <li>
            <span className="font-medium text-slate-900">Uptime</span>
            {" — "}who is down before they email you.
          </li>
          <li>
            <span className="font-medium text-slate-900">White-label portal</span>
            {" — "}shareable client reports under your brand.
          </li>
        </ul>

        <p className="mt-6 text-xs text-slate-500">7-day free trial</p>

        <Link
          href="/signup"
          className="mt-8 inline-block rounded-md bg-brand-600 px-5 py-3 text-sm font-medium text-white hover:bg-brand-700"
        >
          Start free
        </Link>

        <p className="mt-4 text-sm text-slate-500">
          Already subscribed?{" "}
          <Link href="/login" className="text-brand-600 hover:underline">
            Log in
          </Link>
        </p>

        <div className="mt-10 text-xs text-slate-500">
          By subscribing, you agree to our{" "}
          <Link href="/terms" className="text-brand-600 hover:underline">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-brand-600 hover:underline">
            Privacy Policy
          </Link>
          .
        </div>
      </div>
    </div>
  );
}
