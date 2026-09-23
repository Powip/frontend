"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PartnerSectionError } from "@/components/partners/partner-section-error";
import { useAdminClawbacks } from "@/features/partners/hooks/use-admin-clawbacks";
import { useAdminLiquidations } from "@/features/partners/hooks/use-admin-liquidations";
import { useAdminThresholdQueue } from "@/features/partners/hooks/use-admin-threshold-queue";
import { usePayAdminLiquidation } from "@/features/partners/hooks/use-pay-admin-liquidation";
import { usePayAllAdminLiquidations } from "@/features/partners/hooks/use-pay-all-admin-liquidations";
import { formatSoles } from "@/features/partners/utils/format-currency";
import { AdminLiquidationsTable } from "./admin-liquidations-table";
import { ClawbacksList } from "./clawbacks-list";
import { ThresholdQueueList } from "./threshold-queue-list";

export function LiquidacionesPageContent() {
  const liquidationsQuery = useAdminLiquidations();
  const clawbacksQuery = useAdminClawbacks();
  const thresholdQueueQuery = useAdminThresholdQueue();
  const payLiquidation = usePayAdminLiquidation();
  const payAll = usePayAllAdminLiquidations();
  const [payingId, setPayingId] = useState<string | null>(null);

  function handlePay(id: string) {
    setPayingId(id);
    payLiquidation.mutate(id, { onSettled: () => setPayingId(null) });
  }

  const pendingTotal =
    liquidationsQuery.data?.filter((row) => !row.paid).reduce((sum, row) => sum + row.totalAmount, 0) ?? 0;

  return (
    <div className="grid gap-4 p-6 lg:grid-cols-[1.5fr_1fr]">
      <h2 className="sr-only">Liquidaciones</h2>

      <Card className="rounded-2xl">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle>Ciclo · agosto 2026</CardTitle>
          <Button
            onClick={() => payAll.mutate()}
            disabled={payAll.isPending || pendingTotal === 0}
          >
            {payAll.isPending ? "Liquidando..." : `Pagar todo · ${formatSoles(pendingTotal)}`}
          </Button>
        </CardHeader>
        <CardContent>
          {liquidationsQuery.isError ? (
            <PartnerSectionError
              message="No pudimos cargar las liquidaciones."
              onRetry={() => liquidationsQuery.refetch()}
            />
          ) : (
            <AdminLiquidationsTable
              rows={liquidationsQuery.data}
              isLoading={liquidationsQuery.isLoading}
              payingId={payingId}
              onPay={handlePay}
            />
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Reversos / clawback</CardTitle>
          </CardHeader>
          <CardContent>
            {clawbacksQuery.isError ? (
              <PartnerSectionError
                message="No pudimos cargar los reversos."
                onRetry={() => clawbacksQuery.refetch()}
              />
            ) : (
              <ClawbacksList clawbacks={clawbacksQuery.data} isLoading={clawbacksQuery.isLoading} />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>En cola por umbral</CardTitle>
          </CardHeader>
          <CardContent>
            {thresholdQueueQuery.isError ? (
              <PartnerSectionError
                message="No pudimos cargar la cola por umbral."
                onRetry={() => thresholdQueueQuery.refetch()}
              />
            ) : (
              <ThresholdQueueList items={thresholdQueueQuery.data} isLoading={thresholdQueueQuery.isLoading} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
