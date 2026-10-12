"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  useAdminBillingEvidence,
  useAdminBillingEvidenceDetail,
} from "@/features/partners/hooks/use-admin-billing-evidence";
import { useAdminReadAccess } from "@/features/partners/hooks/use-admin-read-session";
import {
  type AdminBillingEvidence,
  type BillingEvidenceState,
  billingEvidenceStateSchema,
} from "@/features/partners/schemas/admin-billing-evidence.schema";
import { AdminReadAccessDenied, AdminReadError } from "../../_components/admin-read-error";

function EvidenceDetail({ item }: { item: AdminBillingEvidence }) {
  return (
    <section aria-label="Detalle de evidencia" className="space-y-2 rounded-lg border p-4 text-sm">
      <h3 className="font-semibold">Detalle del evento {item.eventId}</h3>
      <p>Pago interno: {item.paymentId}</p>
      <p>Suscripción: {item.subscriptionId}</p>
      <p>Hecho: {item.factType}</p>
      <p>Moneda: {item.currency ?? "No demostrada"}</p>
      <p>Importe real: {item.amount ?? "No demostrado"}</p>
      <p>Fecha de pago: {item.paidAt ?? "No demostrada"}</p>
      <p>Procesado: {item.processedAt ?? "Todavía no procesado"}</p>
      <p>Intentos de procesamiento: {item.attempts}</p>
      <p>Último error: {item.lastErrorCode ?? "Ninguno registrado"}</p>
      <p>Observación: {item.observationId ?? "Todavía no disponible"}</p>
      <p>Vinculación: {item.binding?.state ?? "Todavía no disponible"}</p>
      <p>Empresa: {item.binding?.companyId ?? "Sin empresa vinculada"}</p>
      <p>Atribución: {item.binding?.attributionId ?? "Sin atribución vinculada"}</p>
      <p>Estado financiero: {item.binding?.financeState ?? "Todavía no disponible"}</p>
      <p>
        Campos financieros pendientes:{" "}
        {item.missingFields.length
          ? item.missingFields.join(", ")
          : "Sin campos informados; no implica elegibilidad"}
      </p>
      <p>
        Motivos operativos:{" "}
        {item.reconciliationReasons.length
          ? item.reconciliationReasons.join(", ")
          : "Sin motivos adicionales registrados"}
      </p>
      <p>
        Conflictos: {item.conflictCount}
        {item.conflictReasons.length ? ` · ${item.conflictReasons.join(", ")}` : ""}
      </p>
    </section>
  );
}

export function BillingEvidencePageContent() {
  const [state, setState] = useState<BillingEvidenceState | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const access = useAdminReadAccess();
  const query = useAdminBillingEvidence(state);
  const detail = useAdminBillingEvidenceDetail(selected);
  if (!access.canView) return <AdminReadAccessDenied />;
  if (access.denied)
    return (
      <div className="p-6">
        <AdminReadError
          error={access.denied}
          message="No tenés acceso actual a la evidencia de Billing."
        />
      </div>
    );
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <div className="space-y-4 p-6">
      <h2 className="text-xl font-semibold">Evidencia de Billing · solo lectura</h2>
      <p role="status" className="rounded-lg border p-4 text-sm">
        Datos persistidos del proveedor y de la vinculación. Una factura observada o una atribución
        LINK no aprueba un cobro, una comisión ni una liquidación. Los importes desconocidos no se
        reemplazan por cero.
      </p>
      <label className="block text-sm">
        Estado del evento
        <select
          aria-label="Estado del evento"
          className="ml-2 rounded border p-2"
          value={state ?? ""}
          onChange={(event) => {
            setState(
              event.target.value === "" ? null : (event.target.value as BillingEvidenceState),
            );
            setSelected(null);
          }}
        >
          <option value="">Todos</option>
          {billingEvidenceStateSchema.options.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      {query.isError ? (
        <AdminReadError
          error={query.error}
          message="No pudimos cargar la evidencia de Billing."
          onRetry={() => query.refetch()}
        />
      ) : query.isPending ? (
        <p role="status">Cargando evidencia…</p>
      ) : items.length === 0 ? (
        <p>No hay eventos de Billing para este filtro.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <article key={item.id} className="space-y-2 rounded-lg border p-4 text-sm">
              <h3 className="font-semibold">Factura {item.invoiceId}</h3>
              <p>
                {item.provider} · {item.factType} · {item.state}
              </p>
              <p>Recibido: {item.receivedAt}</p>
              <p>
                Importe real:{" "}
                {item.amount === null
                  ? "No demostrado"
                  : `${item.amount}${item.currency ? ` ${item.currency}` : " · moneda no demostrada"}`}
              </p>
              <p>Vinculación: {item.binding?.state ?? "Todavía no disponible"}</p>
              <Button
                variant="outline"
                size="sm"
                aria-label={`Ver evidencia ${item.invoiceId}`}
                onClick={() => setSelected(item.id)}
              >
                Ver evidencia
              </Button>
            </article>
          ))}
        </div>
      )}
      {!query.isError && query.hasNextPage ? (
        <Button
          variant="outline"
          disabled={query.isFetchingNextPage}
          onClick={() => query.fetchNextPage()}
        >
          Cargar más eventos
        </Button>
      ) : null}
      {selected && !query.isError ? (
        detail.isError ? (
          <AdminReadError
            error={detail.error}
            message="No pudimos cargar el detalle de Billing."
            onRetry={() => detail.refetch()}
          />
        ) : detail.isPending ? (
          <p role="status">Cargando detalle…</p>
        ) : detail.data ? (
          <EvidenceDetail item={detail.data} />
        ) : null
      ) : null}
    </div>
  );
}
