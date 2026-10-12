"use client";

import Link from "next/link";
import {
  AdminReadAccessDenied,
  AdminReadError,
} from "@/app/partners/admin/_components/admin-read-error";
import { Button } from "@/components/ui/button";
import {
  useAdminFinancialBalance,
  useAdminFinancialLedger,
} from "@/features/partners/hooks/use-admin-financial-ledger";
import { getHttpStatus } from "@/features/partners/mappers/to-partner-identity-from-error";
import { financialLedgerPartnerIdSchema } from "@/features/partners/schemas/financial-ledger.schema";

const entryLabel = {
  GROSS_COMMISSION: "Comisión bruta",
  PARTNER_FUNDED_DISCOUNT: "Descuento financiado",
};

export function AdminFinancialLedgerPageContent({ partnerId }: { partnerId: string }) {
  const ledger = useAdminFinancialLedger(partnerId);
  const balance = useAdminFinancialBalance(partnerId);
  const denied = ledger.session.denied ?? balance.session.denied;
  const validPartner = financialLedgerPartnerIdSchema.safeParse(partnerId).success;
  if (denied)
    return (
      <div className="p-6">
        <AdminReadError
          error={denied}
          message="No pudimos verificar tu acceso al libro del partner."
        />
      </div>
    );
  if (!ledger.session.canView || !balance.session.canView)
    return (
      <div className="p-6">
        <AdminReadAccessDenied />
      </div>
    );
  if (!validPartner)
    return (
      <p role="alert" className="p-6">
        El identificador del partner no es válido.
      </p>
    );
  const missing = getHttpStatus(ledger.error) === 404 || getHttpStatus(balance.error) === 404;
  return (
    <div className="space-y-5 p-6">
      <h2 className="text-base font-semibold">Libro financiero del partner</h2>
      <Link
        className="text-sm underline"
        href={`/partners/admin/partners/${encodeURIComponent(partnerId)}`}
      >
        Volver a la ficha del partner
      </Link>
      <p className="text-sm">
        Partner consultado: <code>{partnerId}</code>
      </p>
      <p role="status" className="rounded-xl border p-4 text-sm">
        Lectura administrativa de movimientos contabilizados, no dinero disponible para retirar. El
        saldo proviene del libro completo, no de la suma de estas páginas. La elegibilidad de
        liquidación, retenciones, transferencias y pagos no se ha evaluado.
      </p>
      {missing ? (
        <p role="alert">No encontramos este partner.</p>
      ) : (
        <>
          <section
            aria-label="Saldo contable del partner"
            className="space-y-3 rounded-xl border p-4"
          >
            <h3 className="font-semibold">Saldo contable del partner</h3>
            {balance.isError ? (
              <AdminReadError
                error={balance.error}
                message="No pudimos consultar el saldo contable del partner."
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
          <section aria-label="Movimientos contables del partner" className="space-y-3">
            <h3 className="font-semibold">Movimientos contables del partner</h3>
            {ledger.isError ? (
              <AdminReadError
                error={ledger.error}
                message="No pudimos consultar los movimientos contables del partner."
                onRetry={() => ledger.refetch()}
              />
            ) : !ledger.data ? (
              <p role="status">Consultando movimientos…</p>
            ) : ledger.data.pages.every((page) => page.items.length === 0) ? (
              <p>No hay asientos registrados para este partner.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <table
                  className="w-full text-left text-sm"
                  aria-label="Libro financiero del partner registrado"
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
            {ledger.hasNextPage && !ledger.isError ? (
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
