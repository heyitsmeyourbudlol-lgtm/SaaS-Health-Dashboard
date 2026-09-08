// Core financial + health metric computations.
//
// These are pure functions that operate on a provider-agnostic shape
// (`NormalizedSubscription`). The Stripe sync maps Stripe objects into these,
// so the same math would work for Paddle/Chargebee later.

export type BillingInterval = "day" | "week" | "month" | "year";

export interface NormalizedSubscription {
  id: string;
  status: string; // active | trialing | past_due | canceled | ...
  amountCents: number; // per-interval unit amount * quantity, after discounts
  interval: BillingInterval;
  intervalCount: number; // e.g. every 3 months -> interval=month, count=3
  currency: string;
  customerId: string;
}

// Paying / trial only — past_due is at-risk ARR, not healthy MRR (Parked billing exp 9).
const ACTIVE_STATUSES = new Set(["active", "trialing"]);
const AT_RISK_STATUSES = new Set(["past_due"]);

// Convert any billing cadence to a normalized monthly amount in cents.
export function normalizeToMonthlyCents(
  amountCents: number,
  interval: BillingInterval,
  intervalCount = 1,
): number {
  const perInterval = amountCents / Math.max(intervalCount, 1);
  switch (interval) {
    case "day":
      return perInterval * 30;
    case "week":
      return perInterval * (52 / 12);
    case "month":
      return perInterval;
    case "year":
      return perInterval / 12;
    default:
      return perInterval;
  }
}

export function isActive(sub: NormalizedSubscription): boolean {
  return ACTIVE_STATUSES.has(sub.status);
}

export function isAtRisk(sub: NormalizedSubscription): boolean {
  return AT_RISK_STATUSES.has(sub.status);
}

function sumMonthlyCents(
  subs: NormalizedSubscription[],
  predicate: (s: NormalizedSubscription) => boolean,
): number {
  return Math.round(
    subs
      .filter(predicate)
      .reduce(
        (sum, s) =>
          sum + normalizeToMonthlyCents(s.amountCents, s.interval, s.intervalCount),
        0,
      ),
  );
}

// MRR = sum of normalized monthly amounts across active subscriptions.
export function computeMrrCents(subs: NormalizedSubscription[]): number {
  return sumMonthlyCents(subs, isActive);
}

/** Unpaid (past_due) portfolio ARR — surface separately from healthy MRR. */
export function computeAtRiskMrrCents(subs: NormalizedSubscription[]): number {
  return sumMonthlyCents(subs, isAtRisk);
}

export function countActiveSubscribers(subs: NormalizedSubscription[]): number {
  const customers = new Set(subs.filter(isActive).map((s) => s.customerId));
  return customers.size;
}

export interface MrrMovement {
  newMrr: number;
  expansionMrr: number;
  contractionMrr: number;
  churnedMrr: number;
  reactivationMrr: number;
  netMrr: number;
}

// Classify MRR movement between two snapshots of subscriptions keyed by id.
export function computeMrrMovement(
  previous: NormalizedSubscription[],
  current: NormalizedSubscription[],
): MrrMovement {
  const prevById = new Map(previous.map((s) => [s.id, s]));
  const currById = new Map(current.map((s) => [s.id, s]));

  let newMrr = 0;
  let expansionMrr = 0;
  let contractionMrr = 0;
  let churnedMrr = 0;
  const reactivationMrr = 0;

  const monthly = (s: NormalizedSubscription) =>
    normalizeToMonthlyCents(s.amountCents, s.interval, s.intervalCount);

  for (const curr of current) {
    if (!isActive(curr)) continue;
    const prev = prevById.get(curr.id);
    if (!prev || !isActive(prev)) {
      newMrr += monthly(curr);
    } else {
      const delta = monthly(curr) - monthly(prev);
      if (delta > 0) expansionMrr += delta;
      else if (delta < 0) contractionMrr += -delta;
    }
  }

  for (const prev of previous) {
    if (!isActive(prev)) continue;
    const curr = currById.get(prev.id);
    if (!curr || !isActive(curr)) {
      churnedMrr += monthly(prev);
    }
  }

  const round = (n: number) => Math.round(n);
  const netMrr = round(newMrr + expansionMrr + reactivationMrr - contractionMrr - churnedMrr);

  return {
    newMrr: round(newMrr),
    expansionMrr: round(expansionMrr),
    contractionMrr: round(contractionMrr),
    churnedMrr: round(churnedMrr),
    reactivationMrr: round(reactivationMrr),
    netMrr,
  };
}

// Revenue churn %: churned MRR / MRR at start of period.
export function revenueChurnRate(churnedMrr: number, startMrr: number): number {
  if (startMrr <= 0) return 0;
  return (churnedMrr / startMrr) * 100;
}

// Logo churn %: customers lost / customers at start of period.
export function logoChurnRate(customersLost: number, customersAtStart: number): number {
  if (customersAtStart <= 0) return 0;
  return (customersLost / customersAtStart) * 100;
}

// Month-over-month revenue churn from two MRR snapshots.
export function churnFromMrrDelta(previousMrr: number, currentMrr: number): number {
  if (previousMrr <= 0 || currentMrr >= previousMrr) return 0;
  return ((previousMrr - currentMrr) / previousMrr) * 100;
}

export interface HealthInputs {
  churnRatePct: number | null;
  uptimePct: number | null;
  mrrTrendPct: number | null;
  awsAlarmPct: number | null;
  syntheticsPct: number | null;
  pipelineTrendPct: number | null;
  errorCount: number | null;
}

// A single 0-100 headline score blending financial + technical + commercial signals.
export function computeHealthScore(inputs: HealthInputs): number {
  const churn = inputs.churnRatePct ?? 0;
  const financial = clamp(100 - churn * 10, 0, 100);

  const technicalScores: number[] = [];
  if (inputs.uptimePct != null) {
    technicalScores.push(clamp((inputs.uptimePct - 90) * 10, 0, 100));
  }
  if (inputs.awsAlarmPct != null) {
    technicalScores.push(clamp((inputs.awsAlarmPct - 90) * 10, 0, 100));
  }
  if (inputs.syntheticsPct != null) {
    technicalScores.push(clamp((inputs.syntheticsPct - 90) * 10, 0, 100));
  }
  const technical =
    technicalScores.length > 0
      ? technicalScores.reduce((a, b) => a + b, 0) / technicalScores.length
      : 100;

  const trend = inputs.mrrTrendPct ?? 0;
  const trendScore = clamp(50 + trend * 2.5, 0, 100);

  const pipelineTrend = inputs.pipelineTrendPct ?? 0;
  const commercial = clamp(50 + pipelineTrend * 2, 0, 100);

  const errors = inputs.errorCount ?? 0;
  const stability = clamp(100 - errors * 1.5, 0, 100);

  const score =
    0.3 * financial +
    0.3 * technical +
    0.15 * commercial +
    0.1 * trendScore +
    0.15 * stability;

  return Math.round(clamp(score, 0, 100));
}

export type HealthBand = "healthy" | "watch" | "at_risk";

export function healthBand(score: number | null | undefined): HealthBand {
  if (score == null) return "watch";
  if (score >= 80) return "healthy";
  if (score >= 55) return "watch";
  return "at_risk";
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}
