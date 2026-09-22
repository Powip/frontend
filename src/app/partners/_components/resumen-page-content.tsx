"use client";

import { usePartnerSummary } from "@/features/partners/hooks/use-partner-summary";
import { useRecentReferrals } from "@/features/partners/hooks/use-recent-referrals";
import { PartnerSectionError } from "@/components/partners/partner-section-error";
import { NextPayoutCard } from "@/components/partners/next-payout-card";
import { PartnerHeroCard } from "./partner-hero-card";
import { PartnerKpiRow } from "./partner-kpi-row";
import { PartnerReferralFunnel } from "./partner-referral-funnel";
import { PartnerTierCard } from "./partner-tier-card";
import { RecentReferralsTable } from "./recent-referrals-table";

const RECENT_REFERRALS_LIMIT = 5;

export function ResumenPageContent() {
  const summaryQuery = usePartnerSummary();
  const referralsQuery = useRecentReferrals(RECENT_REFERRALS_LIMIT);

  return (
    <div className="space-y-5 p-6">
      <h2 className="sr-only">Resumen</h2>

      {summaryQuery.isError ? (
        <PartnerSectionError
          message="No pudimos cargar el resumen de tu programa de partners."
          onRetry={() => summaryQuery.refetch()}
        />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
            <PartnerHeroCard
              commissionOption={summaryQuery.data?.commissionOption}
              isLoading={summaryQuery.isLoading}
            />
            <PartnerTierCard tier={summaryQuery.data?.tier} isLoading={summaryQuery.isLoading} />
          </div>

          <PartnerKpiRow summary={summaryQuery.data} isLoading={summaryQuery.isLoading} />

          <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
            <PartnerReferralFunnel funnel={summaryQuery.data?.funnel} isLoading={summaryQuery.isLoading} />
            <NextPayoutCard nextPayout={summaryQuery.data?.nextPayout} isLoading={summaryQuery.isLoading} />
          </div>
        </>
      )}

      {referralsQuery.isError ? (
        <PartnerSectionError
          message="No pudimos cargar tus últimos referidos."
          onRetry={() => referralsQuery.refetch()}
        />
      ) : (
        <RecentReferralsTable referrals={referralsQuery.data} isLoading={referralsQuery.isLoading} />
      )}
    </div>
  );
}
