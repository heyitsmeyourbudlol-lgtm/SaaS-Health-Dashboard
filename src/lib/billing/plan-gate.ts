/**
 * Fail-closed agency entitlement for paid sync / growth features.
 * Mirror of CaaS isPlanActive — only Stripe-healthy statuses pass.
 * Product signup status "trial" is not Stripe "trialing"; it fails closed.
 */
const PLAN_ACTIVE_STATUSES = new Set(["active", "trialing"]);

/** True only for active | trialing. past_due, canceled, trial, unknown → false. */
export function isAgencyPlanActive(status: string | null | undefined): boolean {
  if (!status) return false;
  return PLAN_ACTIVE_STATUSES.has(status);
}

export type AgencyPlanGateDeny = {
  ok: false;
  status: 403;
  body: { error: string };
};

export type AgencyPlanGateAllow = { ok: true };

/** HTTP-shaped result for API routes — never 200 when entitlement fails. */
export function agencyPlanGateResult(
  status: string | null | undefined,
): AgencyPlanGateAllow | AgencyPlanGateDeny {
  if (isAgencyPlanActive(status)) return { ok: true };
  return {
    ok: false,
    status: 403,
    body: { error: "Plan inactive — paid sync requires active or trialing" },
  };
}
