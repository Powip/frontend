"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PartnerSectionError } from "@/components/partners/partner-section-error";
import { useCommissionOptions } from "@/features/partners/hooks/use-commission-options";
import { usePartnerLink } from "@/features/partners/hooks/use-partner-link";
import { usePartnerSummary } from "@/features/partners/hooks/use-partner-summary";
import { CommissionComparisonTable } from "./commission-comparison-table";
import { CommissionOptionCards } from "./commission-option-cards";
import { CommissionSimulator } from "./commission-simulator";

const DEFAULT_DISCOUNT_PCT = 10;

export function PlanPageContent() {
  const summaryQuery = usePartnerSummary();
  const linkQuery = usePartnerLink();
  const optionsQuery = useCommissionOptions();
  const [selectedCode, setSelectedCode] = useState("A");

  const discountPct = linkQuery.data?.discountPct ?? DEFAULT_DISCOUNT_PCT;

  return (
    <div className="space-y-5 p-6">
      <h2 className="sr-only">Mi plan</h2>

      <div>
        <h3 className="text-base font-semibold text-foreground">Tu opción de comisión</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada opción tiene una comisión de <b>primer mes</b> (one-time) y una{" "}
          <b>recurrente</b>. Aplica a tus nuevos referidos.
        </p>
      </div>

      {optionsQuery.isError ? (
        <PartnerSectionError
          message="No pudimos cargar las opciones de comisión."
          onRetry={() => optionsQuery.refetch()}
        />
      ) : (
        <CommissionOptionCards
          options={optionsQuery.data}
          isLoading={optionsQuery.isLoading}
          currentOptionCode={summaryQuery.data?.commissionOption.code}
          selectedCode={selectedCode}
          onSelectedCodeChange={setSelectedCode}
        />
      )}

      <CommissionSimulator
        options={optionsQuery.data}
        selectedCode={selectedCode}
        discountPct={discountPct}
      />

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Comisión por plan (1er mes / recurrente)</CardTitle>
        </CardHeader>
        <CardContent>
          <CommissionComparisonTable
            options={optionsQuery.data}
            isLoading={optionsQuery.isLoading}
            discountPct={discountPct}
          />
        </CardContent>
      </Card>
    </div>
  );
}
