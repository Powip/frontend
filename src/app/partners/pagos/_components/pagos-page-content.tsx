"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NextPayoutCard } from "@/components/partners/next-payout-card";
import { PartnerSectionError } from "@/components/partners/partner-section-error";
import { usePartnerSummary } from "@/features/partners/hooks/use-partner-summary";
import { usePayoutHistory } from "@/features/partners/hooks/use-payout-history";
import { usePayoutSettings } from "@/features/partners/hooks/use-payout-settings";
import { EditPayoutSettingsDialog } from "./edit-payout-settings-dialog";
import { MinimumThresholdCard } from "./minimum-threshold-card";
import { PayoutHistoryTable } from "./payout-history-table";
import { PayoutSettingsCard } from "./payout-settings-card";

export function PagosPageContent() {
  const summaryQuery = usePartnerSummary();
  const historyQuery = usePayoutHistory();
  const settingsQuery = usePayoutSettings();
  const [isEditOpen, setIsEditOpen] = useState(false);

  return (
    <div className="grid gap-4 p-6 lg:grid-cols-[1.5fr_1fr]">
      <h2 className="sr-only">Pagos</h2>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Historial de liquidaciones</CardTitle>
        </CardHeader>
        <CardContent>
          {historyQuery.isError ? (
            <PartnerSectionError
              message="No pudimos cargar tu historial de liquidaciones."
              onRetry={() => historyQuery.refetch()}
            />
          ) : (
            <PayoutHistoryTable entries={historyQuery.data} isLoading={historyQuery.isLoading} />
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {summaryQuery.isError ? (
          <PartnerSectionError
            message="No pudimos cargar tu próxima liquidación."
            onRetry={() => summaryQuery.refetch()}
          />
        ) : (
          <NextPayoutCard nextPayout={summaryQuery.data?.nextPayout} isLoading={summaryQuery.isLoading} />
        )}

        {settingsQuery.isError ? (
          <PartnerSectionError
            message="No pudimos cargar tus datos de cobro."
            onRetry={() => settingsQuery.refetch()}
          />
        ) : (
          <>
            <PayoutSettingsCard
              settings={settingsQuery.data}
              isLoading={settingsQuery.isLoading}
              onEdit={() => setIsEditOpen(true)}
            />
            <MinimumThresholdCard settings={settingsQuery.data} isLoading={settingsQuery.isLoading} />
          </>
        )}
      </div>

      <EditPayoutSettingsDialog
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        currentSettings={settingsQuery.data}
      />
    </div>
  );
}
