export function estimateFirstMonthCommission(
  monthlyPlanPrice: number,
  firstMonthPct: number,
  discountPct: number,
): number {
  const netFirstMonthPrice = monthlyPlanPrice * (1 - discountPct / 100);
  return netFirstMonthPrice * (firstMonthPct / 100);
}

export function estimateRecurringCommission(monthlyPlanPrice: number, recurringPct: number): number {
  return monthlyPlanPrice * (recurringPct / 100);
}

export interface CommissionEstimateInput {
  referralsCount: number;
  monthlyPlanPrice: number;
  retentionMonths: number;
  firstMonthPct: number;
  recurringPct: number;
  discountPct: number;
}

export interface CommissionEstimate {
  perReferralFirstMonth: number;
  perReferralMonthly: number;
  firstMonthTotal: number;
  monthlyRecurringTotal: number;
  projectedTotal: number;
}

export function estimateCommissionEarnings({
  referralsCount,
  monthlyPlanPrice,
  retentionMonths,
  firstMonthPct,
  recurringPct,
  discountPct,
}: CommissionEstimateInput): CommissionEstimate {
  const perReferralFirstMonth = estimateFirstMonthCommission(monthlyPlanPrice, firstMonthPct, discountPct);
  const perReferralMonthly = estimateRecurringCommission(monthlyPlanPrice, recurringPct);
  const extraMonths = Math.max(0, retentionMonths - 1);

  return {
    perReferralFirstMonth,
    perReferralMonthly,
    firstMonthTotal: perReferralFirstMonth * referralsCount,
    monthlyRecurringTotal: perReferralMonthly * referralsCount,
    projectedTotal: (perReferralFirstMonth + perReferralMonthly * extraMonths) * referralsCount,
  };
}
