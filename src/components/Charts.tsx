"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Point {
  capturedAt: string;
  value: number;
}

function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
  });
}

const AXIS_STYLE = { fontSize: 12, fill: "#94a3b8" };

export function MrrChart({
  data,
  currency = "usd",
  color = "#4f46e5",
}: {
  data: Point[];
  currency?: string;
  /** Agency white-label; default brand indigo for unbranded surfaces. */
  color?: string;
}) {
  const chartData = data.map((d) => ({
    label: monthLabel(d.capturedAt),
    mrr: Math.round(d.value / 100),
  }));

  const fmt = (v: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(v);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="mrrFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
        <XAxis dataKey="label" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
        <YAxis
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
          width={64}
          tickFormatter={(v) => fmt(v)}
        />
        <Tooltip
          formatter={(v) => [fmt(Number(v)), "MRR"]}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            fontSize: 13,
          }}
        />
        <Area
          type="monotone"
          dataKey="mrr"
          stroke={color}
          strokeWidth={2.5}
          fill="url(#mrrFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function UptimeChart({
  data,
  color = "#0ea5e9",
}: {
  data: Point[];
  /** Agency white-label; default sky for unbranded surfaces. SLA line stays emerald. */
  color?: string;
}) {
  const chartData = data.map((d) => ({
    label: monthLabel(d.capturedAt),
    uptime: d.value,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
        <XAxis dataKey="label" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
        <YAxis
          domain={[95, 100]}
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          formatter={(v) => [`${Number(v).toFixed(2)}%`, "Uptime"]}
          contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }}
        />
        <ReferenceLine y={99.9} stroke="#10b981" strokeDasharray="4 4" />
        <Bar dataKey="uptime" fill={color} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function HealthChart({ data }: { data: Point[] }) {
  const chartData = data.map((d) => ({
    label: monthLabel(d.capturedAt),
    health: d.value,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="healthFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
        <XAxis dataKey="label" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
        <YAxis
          domain={[0, 100]}
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
          width={36}
        />
        <Tooltip
          formatter={(v) => [String(Math.round(Number(v))), "Health"]}
          contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }}
        />
        <ReferenceLine y={80} stroke="#10b981" strokeDasharray="4 4" />
        <ReferenceLine y={55} stroke="#f59e0b" strokeDasharray="4 4" />
        <Area
          type="monotone"
          dataKey="health"
          stroke="#10b981"
          strokeWidth={2.5}
          fill="url(#healthFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function Sparkline({
  data,
  color = "#4f46e5",
}: {
  data: Point[];
  color?: string;
}) {
  const chartData = data.map((d) => ({ value: d.value }));
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
