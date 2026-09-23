"use client";

import { Card, CardContent } from "@/components/ui/card";
import { PartnerSectionError } from "@/components/partners/partner-section-error";
import { useProgramCases } from "@/features/partners/hooks/use-program-cases";
import { ProgramCasesTable } from "./program-cases-table";

export function CasuisticaPageContent() {
  const casesQuery = useProgramCases();

  return (
    <div className="space-y-4 p-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">Casuística del programa</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Todos los casos que pueden pasar con un referido y cómo los resuelve el sistema.
        </p>
      </div>

      <Card className="rounded-2xl">
        <CardContent>
          {casesQuery.isError ? (
            <PartnerSectionError
              message="No pudimos cargar la casuística."
              onRetry={() => casesQuery.refetch()}
            />
          ) : (
            <ProgramCasesTable cases={casesQuery.data} isLoading={casesQuery.isLoading} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
