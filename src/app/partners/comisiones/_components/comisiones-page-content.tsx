"use client";

import Link from "next/link";
import { PartnerSectionError } from "@/components/partners/partner-section-error";
import { Button } from "@/components/ui/button";
import {
  useOwnCommissionEvaluations,
  useOwnCommissionItems,
} from "@/features/partners/hooks/use-own-commission-read";
import { getHttpStatus } from "@/features/partners/mappers/to-partner-identity-from-error";
import {
  CommissionEvaluationsTable,
  CommissionItemsEvidenceTable,
} from "./commission-evidence-tables";

export function ComisionesPageContent() {
  const items = useOwnCommissionItems();
  const evaluations = useOwnCommissionEvaluations();
  const denied = items.session.denied ?? evaluations.session.denied;

  return (
    <div className="space-y-5 p-6">
      <h2 className="text-base font-semibold">Comisiones: evidencia registrada</h2>
      <PartnerSectionError message="Resumen financiero no disponible. Esta vista no informa saldos, liquidaciones, retenciones, transferencias ni pagos ejecutados." />
      <p className="text-sm text-muted-foreground">
        Un cálculo registrado no es un saldo disponible ni una confirmación de pago. No se suman ni
        se estiman totales a partir de estas páginas.
      </p>
      <Link className="text-sm underline" href="/partners/comisiones/libro">
        Ver libro y saldo contable
      </Link>
      {denied || !items.session.enabled || !evaluations.session.enabled ? (
        <PartnerSectionError
          message={
            getHttpStatus(denied) === 401
              ? "Tu sesión ya no está vigente. Iniciá sesión para consultar la evidencia."
              : "No tenés permiso vigente para leer comisiones."
          }
        />
      ) : (
        <>
          <section className="space-y-3" aria-label="Cálculos registrados">
            <h3 className="font-semibold">Cálculos registrados</h3>
            {items.isError ? (
              <PartnerSectionError
                message="No pudimos leer los cálculos registrados."
                onRetry={() => items.refetch()}
              />
            ) : !items.data ? (
              <p role="status">Cargando cálculos registrados…</p>
            ) : (
              <>
                <CommissionItemsEvidenceTable
                  items={items.data.pages.flatMap((page) => page.items)}
                />
                {items.hasNextPage ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={items.isFetchingNextPage}
                    onClick={() => items.fetchNextPage()}
                  >
                    Ver más cálculos
                  </Button>
                ) : null}
              </>
            )}
          </section>
          <section className="space-y-3" aria-label="Evaluaciones registradas">
            <h3 className="font-semibold">Evaluaciones registradas</h3>
            {evaluations.isError ? (
              <PartnerSectionError
                message="No pudimos leer las evaluaciones registradas."
                onRetry={() => evaluations.refetch()}
              />
            ) : !evaluations.data ? (
              <p role="status">Cargando evaluaciones registradas…</p>
            ) : (
              <>
                <CommissionEvaluationsTable
                  evaluations={evaluations.data.pages.flatMap((page) => page.items)}
                />
                {evaluations.hasNextPage ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={evaluations.isFetchingNextPage}
                    onClick={() => evaluations.fetchNextPage()}
                  >
                    Ver más evaluaciones
                  </Button>
                ) : null}
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
