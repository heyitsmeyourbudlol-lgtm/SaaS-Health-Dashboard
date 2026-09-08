import Link from "next/link";

export default async function SignupPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const error = (await searchParams)?.error;
  const errorText =
    error === "agency"
      ? "Agency name is required."
      : error === "email"
        ? "Enter a valid email."
        : error === "email-in-use"
          ? "That email is already registered."
          : error === "password"
            ? "Password must be at least 8 characters."
            : error === "server"
              ? "Signup failed. Try again."
              : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-md px-6 py-12">
        <p className="text-sm font-semibold tracking-tight text-slate-800">
          SaaS Health Dashboard
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Start free — then $99/mo when you subscribe.
        </p>

        <h1 className="mt-8 text-3xl font-semibold tracking-tight text-slate-900">
          Create your agency account
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Start with a trial. Once you subscribe, your billing status updates
          automatically.
        </p>

        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {errorText && (
            <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorText}
            </div>
          )}
          <form action="/api/auth/signup" method="post" className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600">
                Agency name
              </label>
              <input
                name="agencyName"
                required
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">
                Owner email
              </label>
              <input
                name="email"
                type="email"
                required
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">
                Password
              </label>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
            >
              Create account
            </button>
          </form>

          <p className="mt-4 text-xs text-slate-500">
            Already have an account?{" "}
            <Link className="text-brand-600 hover:underline" href="/login">
              Log in
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
