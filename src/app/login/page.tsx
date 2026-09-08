import Link from "next/link";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const error = (await searchParams)?.error;
  const errorText =
    error === "invalid"
      ? "Invalid email or password."
      : error === "missing"
        ? "Email and password are required."
        : error === "server"
          ? "Login failed. Try again."
          : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-md px-6 py-12">
        <p className="text-sm font-semibold tracking-tight text-slate-800">
          SaaS Health Dashboard
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Sign in to see who needs you today.
        </p>

        <h1 className="mt-8 text-3xl font-semibold tracking-tight text-slate-900">
          Log in
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter your agency owner email and password.
        </p>

        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {errorText && (
            <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorText}
            </div>
          )}
          <form action="/api/auth/login" method="post" className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600">
                Email
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
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
            >
              Log in
            </button>
          </form>

          <p className="mt-4 text-xs text-slate-500">
            New to SaaS Health Dashboard?{" "}
            <Link className="text-brand-600 hover:underline" href="/signup">
              Create an account
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
