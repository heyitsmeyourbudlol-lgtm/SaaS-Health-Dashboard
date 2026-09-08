import { healthBand } from "@/lib/metrics";
import { cn } from "@/lib/cn";

const LABELS: Record<string, string> = {
  healthy: "Healthy",
  watch: "Watch",
  at_risk: "At risk",
};

export function HealthBadge({
  score,
  size = "md",
}: {
  score: number | null | undefined;
  size?: "sm" | "md" | "lg";
}) {
  const band = healthBand(score);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        `band-${band}`,
        size === "sm" && "px-2 py-0.5 text-xs",
        size === "md" && "px-2.5 py-1 text-sm",
        size === "lg" && "px-3 py-1.5 text-base",
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {score ?? "—"} · {LABELS[band]}
    </span>
  );
}
