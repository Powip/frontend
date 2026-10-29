"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAdminReadAccess } from "@/features/partners/hooks/use-admin-read-session";
import { useAdminReviewQueue } from "@/features/partners/hooks/use-admin-review-queue";
import type { AdminReviewQueueOrigin } from "@/features/partners/models/admin-review-queue";
import { AdminReadAccessDenied, AdminReadError } from "../../_components/admin-read-error";
import { ReferralRejectionControls } from "./referral-rejection-controls";
import { InvitationQueueSection } from "./invitation-queue-section";

export function ColaPageContent() {
  const [origin, setOrigin] = useState<AdminReviewQueueOrigin | null>(null);
  const access = useAdminReadAccess();
  const query = useAdminReviewQueue(origin);
  if (!access.canView) return <AdminReadAccessDenied />;
  if (access.denied)
    return (
      <div className="p-6">
        <AdminReadError error={access.denied} message="No tenés acceso actual a la cola." />
      </div>
    );
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <div className="space-y-4 p-6">
      <h2 className="text-xl font-semibold">Cola de referidos pendientes</h2>
      <p role="status" className="rounded-lg border p-4 text-sm">
        Estos estados son operativos. No confirman empresas, pagos ni comisiones. Solo el permiso
        PARTNERS_RESOLVE_REFERRAL permite registrar un rechazo explícito; no hay aprobación ni
        atribución manual.
      </p>
      <label className="block text-sm">
        Origen
        <select
          aria-label="Origen"
          className="ml-2 rounded border p-2"
          value={origin ?? ""}
          onChange={(event) =>
            setOrigin(
              event.target.value === "" ? null : (event.target.value as AdminReviewQueueOrigin),
            )
          }
        >
          <option value="">Todos</option>
          <option value="MANUAL">MANUAL</option>
          <option value="CODE">CODE</option>
        </select>
      </label>
      {query.isError ? (
        <AdminReadError
          error={query.error}
          message="No pudimos cargar la cola."
          onRetry={() => query.refetch()}
        />
      ) : query.isPending ? (
        <p role="status">Cargando cola…</p>
      ) : items.length === 0 ? (
        <p>No hay referidos pendientes en esta cola.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-lg border p-4 text-sm">
              <h3 className="font-semibold">{item.businessName}</h3>
              <p>
                {item.partnerDisplayName} · Partner {item.partnerStatus}
              </p>
              <p>
                {item.origin} · {item.state} · Versión {item.version}
              </p>
              <p>Capturado: {item.capturedAt}</p>
              <p>Vencimiento: {item.expiresAt ?? "No declarado"}</p>
              <p className="text-muted-foreground">
                Referido: {item.id} · Partner: {item.partnerId}
              </p>
            </article>
          ))}
        </div>
      )}
      <ReferralRejectionControls
        items={items}
        reload={async () => {
          const actual = await query.refetch();
          if (actual.isError || !actual.data)
            throw actual.error ?? new Error("La cola actual no está disponible.");
          return actual.data.pages.flatMap((page) => page.items);
        }}
      />
      {!query.isError && query.hasNextPage && (
        <Button
          variant="outline"
          disabled={query.isFetchingNextPage}
          onClick={() => query.fetchNextPage()}
        >
          Cargar más referidos
        </Button>
      )}
      <InvitationQueueSection />
    </div>
  );
}
