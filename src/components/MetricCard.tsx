import { cn } from "@/lib/cn";

export function MetricCard({
  label,
  value,
  sub,
  trend,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: { value: number; suffix?: string } | null;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-5 shadow-sm",
        className,
      )}
    >
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight text-slate-900">
          {value}
        </span>
        {trend != null && (
          <span
            className={cn(
              "text-sm font-medium",
              trend.value >= 0 ? "text-emerald-600" : "text-red-600",
            )}
          >
            {trend.value >= 0 ? "▲" : "▼"} {Math.abs(trend.value).toFixed(1)}
            {trend.suffix ?? "%"}
          </span>
        )}
      </div>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}
