"use client";

import Link from "next/link";
import { PartnerSectionError } from "@/components/partners/partner-section-error";
import { Button } from "@/components/ui/button";
import {
  useOwnFinancialBalance,
  useOwnFinancialLedger,
} from "@/features/partners/hooks/use-own-financial-ledger";
import { getHttpStatus } from "@/features/partners/mappers/to-partner-identity-from-error";

const entryLabel = {
  GROSS_COMMISSION: "Comisión bruta",
  PARTNER_FUNDED_DISCOUNT: "Descuento financiado",
};
export function FinancialLedgerPageContent() {
  const ledger = useOwnFinancialLedger();
  const balance = useOwnFinancialBalance();
  const denied = ledger.session.denied ?? balance.session.denied;
  return (
    <div className="space-y-5 p-6">
      <h2 className="text-base font-semibold">Libro de comisiones</h2>
      <Link className="text-sm underline" href="/partners/comisiones">
        Volver a los cálculos registrados
      </Link>
      <p role="status" className="rounded-xl border p-4 text-sm">
        Estos son movimientos contabilizados, no dinero disponible para retirar. La elegibilidad de
        liquidación, retenciones, transferencias y pagos no se ha evaluado.
      </p>
      {denied || !ledger.session.enabled || !balance.session.enabled ? (
        <PartnerSectionError
          message={
            getHttpStatus(denied) === 401
              ? "Tu sesión ya no está vigente. Iniciá sesión para consultar el libro."
              : "No tenés permiso vigente para consultar el libro financiero."
          }
        />
      ) : (
        <>
          <section aria-label="Saldo contable" className="space-y-3 rounded-xl border p-4">
            <h3 className="font-semibold">Saldo contable</h3>
            {balance.isError ? (
              <PartnerSectionError
                message="No pudimos consultar el saldo contabilizado."
                onRetry={() => balance.refetch()}
              />
            ) : !balance.data ? (
              <p role="status">Consultando saldo contable…</p>
            ) : (
              <>
                <p className="font-mono text-xl">PEN {balance.data.postedLedgerBalance}</p>
                <p>Movimientos contabilizados: {balance.data.postedEntryCount}</p>
                {balance.data.availability === "NO_POSTED_ENTRIES" ? (
                  <p>No hay movimientos contabilizados. Esto no confirma elegibilidad de cobro.</p>
                ) : null}
                <p className="text-xs">Liquidación: pendiente de evaluación.</p>
                <time className="block text-xs" dateTime={balance.data.asOf}>
                  Corte UTC: {balance.data.asOf}
                </time>
              </>
            )}
          </section>
          <section aria-label="Movimientos contables" className="space-y-3">
            <h3 className="font-semibold">Movimientos contables</h3>
            {ledger.isError ? (
              <PartnerSectionError
                message="No pudimos consultar los movimientos contabilizados."
                onRetry={() => ledger.refetch()}
              />
            ) : !ledger.data ? (
              <p role="status">Consultando movimientos…</p>
            ) : ledger.data.pages.every((page) => page.items.length === 0) ? (
              <p>No hay asientos registrados para tu cuenta.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <table
                  className="w-full text-left text-sm"
                  aria-label="Libro financiero registrado"
                >
                  <thead>
                    <tr>
                      {[
                        "Concepto",
                        "Importe exacto (PEN)",
                        "Empresa",
                        "Origen auditable",
                        "Registro UTC",
                      ].map((label) => (
                        <th key={label} scope="col" className="p-3">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.data.pages
                      .flatMap((page) => page.items)
                      .map((item) => (
                        <tr key={item.id} className="border-t align-top">
                          <td className="p-3">{entryLabel[item.kind]}</td>
                          <td className="p-3 font-mono">{item.signedAmount}</td>
                          <td className="p-3">
                            <code>{item.companyId}</code>
                          </td>
                          <td className="space-y-1 p-3 text-xs">
                            <p>
                              Asiento: <code>{item.id}</code>
                            </p>
                            <p>
                              Cálculo: <code>{item.calculationItemId}</code>
                            </p>
                            <p>
                              Pago observado: <code>{item.paymentId}</code>
                            </p>
                          </td>
                          <td className="p-3 text-xs">
                            <time dateTime={item.postedAt}>{item.postedAt}</time>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
            {ledger.hasNextPage ? (
              <Button
                type="button"
                variant="outline"
                disabled={ledger.isFetchingNextPage}
                onClick={() => ledger.fetchNextPage()}
              >
                Ver más movimientos
              </Button>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
