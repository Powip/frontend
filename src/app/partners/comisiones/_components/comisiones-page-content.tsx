"use client";

import { PartnerSectionError } from "@/components/partners/partner-section-error";
import { usePartnerSummary } from "@/features/partners/hooks/use-partner-summary";
import { useCommissionLines } from "@/features/partners/hooks/use-commission-lines";
import { CommissionExplainerAlert } from "./commission-explainer-alert";
import { CommissionsKpiRow } from "./commissions-kpi-row";
import { CommissionsTable } from "./commissions-table";

export function ComisionesPageContent() {
  const summaryQuery = usePartnerSummary();
  const linesQuery = useCommissionLines();

  return (
    <div className="space-y-5 p-6">
      <h2 className="sr-only">Comisiones</h2>

      {summaryQuery.isError ? (
        <PartnerSectionError
          message="No pudimos cargar el resumen de comisiones."
          onRetry={() => summaryQuery.refetch()}
        />
      ) : (
        <CommissionsKpiRow summary={summaryQuery.data} isLoading={summaryQuery.isLoading} />
      )}

      {linesQuery.isError ? (
        <PartnerSectionError
          message="No pudimos cargar el detalle de comisiones."
          onRetry={() => linesQuery.refetch()}
        />
      ) : (
        <CommissionsTable
          lines={linesQuery.data}
          isLoading={linesQuery.isLoading}
          commissionOption={summaryQuery.data?.commissionOption}
        />
      )}

      <CommissionExplainerAlert />
    </div>
  );
}
