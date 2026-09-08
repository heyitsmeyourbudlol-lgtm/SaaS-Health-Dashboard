import Link from "next/link";
import { getCurrentAgency } from "@/lib/auth";

function statusChrome(status: string): {
  label: string;
  className: string;
  href?: string;
} {
  switch (status) {
    case "active":
      return { label: "Subscribed", className: "text-xs text-slate-400" };
    case "trialing":
      return { label: "Trial", className: "text-xs text-slate-400" };
    case "past_due":
      return {
        label: "Payment past due",
        className: "text-xs font-medium text-amber-700",
        href: "/dashboard/settings",
      };
    case "canceled":
      return {
        label: "Canceled",
        className: "text-xs font-medium text-slate-500",
        href: "/dashboard/settings",
      };
    default:
      return { label: "Setup", className: "text-xs text-slate-400" };
  }
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const agency = await getCurrentAgency();
  const chrome = statusChrome(agency.status);

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-6 md:flex">
        <div className="flex items-center gap-2 px-2">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{ backgroundColor: agency.primaryColor }}
          >
            {agency.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{agency.name}</p>
            <p className="text-xs capitalize text-slate-400">{agency.plan} plan</p>
          </div>
        </div>

        <nav className="mt-8 flex flex-col gap-1">
          <NavLink href="/dashboard" label="Portfolio" />
          <NavLink href="/dashboard/settings" label="Branding & settings" />
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-end border-b border-slate-200 bg-white px-6">
          {chrome.href ? (
            <Link href={chrome.href} className={chrome.className}>
              {chrome.label}
            </Link>
          ) : (
            <span className={chrome.className}>{chrome.label}</span>
          )}
        </header>
        <main className="flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
    >
      {label}
    </Link>
  );
}
