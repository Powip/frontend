"use client";

import { PartnerSectionError } from "@/components/partners/partner-section-error";
import { useAdminDashboardSummary } from "@/features/partners/hooks/use-admin-dashboard-summary";
import { useAdminPartners } from "@/features/partners/hooks/use-admin-partners";
import { AdminDashboardKpiRow } from "./admin-dashboard-kpi-row";
import { MrrByMonthChart } from "./mrr-by-month-chart";
import { ProgramFunnel } from "./program-funnel";
import { ReferralsByOriginChart } from "./referrals-by-origin-chart";
import { TopPartnersTable } from "./top-partners-table";

export function DashboardPageContent() {
  const summaryQuery = useAdminDashboardSummary();
  const partnersQuery = useAdminPartners();

  return (
    <div className="space-y-5 p-6">
      <h2 className="sr-only">Dashboard</h2>

      {summaryQuery.isError ? (
        <PartnerSectionError
          message="No pudimos cargar el resumen del programa."
          onRetry={() => summaryQuery.refetch()}
        />
      ) : (
        <>
          <AdminDashboardKpiRow summary={summaryQuery.data} isLoading={summaryQuery.isLoading} />

          <div className="grid gap-4 lg:grid-cols-2">
            <MrrByMonthChart monthlyMrr={summaryQuery.data?.monthlyMrr} isLoading={summaryQuery.isLoading} />
            <ReferralsByOriginChart
              referralsByOrigin={summaryQuery.data?.referralsByOrigin}
              clickToPayConversionPct={summaryQuery.data?.clickToPayConversionPct}
              isLoading={summaryQuery.isLoading}
            />
          </div>
        </>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {partnersQuery.isError ? (
          <PartnerSectionError
            message="No pudimos cargar los partners."
            onRetry={() => partnersQuery.refetch()}
          />
        ) : (
          <TopPartnersTable partners={partnersQuery.data} isLoading={partnersQuery.isLoading} />
        )}

        {summaryQuery.isError ? (
          <PartnerSectionError
            message="No pudimos cargar el embudo del programa."
            onRetry={() => summaryQuery.refetch()}
          />
        ) : (
          <ProgramFunnel funnel={summaryQuery.data?.funnel} isLoading={summaryQuery.isLoading} />
        )}
      </div>
    </div>
  );
}
