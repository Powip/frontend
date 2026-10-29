"use client";

import { CancelledError } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminCommissionPolicies } from "@/features/partners/hooks/use-admin-commission-policies";
import { getHttpStatus } from "@/features/partners/mappers/to-partner-identity-from-error";
import { AdminReadError } from "../../_components/admin-read-error";
import { AdminWriteRecovery } from "../../_components/admin-write-recovery";
import { CommissionRulesEditor } from "./commission-rules-editor";

export function ReglasPageContent() {
  const { session, query, creation, createDraft, creationForSession } =
    useAdminCommissionPolicies();
  if (!session.canAccess)
    return (
      <p role="alert" className="p-6">
        Necesitás el permiso PARTNERS_CONFIGURE_POLICY para gestionar borradores de comisiones.
      </p>
    );
  if (session.denied)
    return (
      <div className="p-6">
        <AdminReadError error={session.denied} message="No tenés acceso actual a los borradores." />
      </div>
    );
  const drafts = query.data?.pages.flatMap((page) => page.items) ?? [];
  const currentError =
    creationForSession && creation.isError && !(creation.error instanceof CancelledError)
      ? creation.error
      : null;
  const status = getHttpStatus(currentError);
  const unknownResult = Boolean(currentError) && (status === null || status >= 500);
  const originalCommand =
    creationForSession && (creation.isPending || unknownResult)
      ? creation.variables?.command
      : undefined;
  return (
    <div className="space-y-4 p-6">
      <h2 className="text-xl font-semibold">Versiones de comisiones · DRAFT</h2>
      <Link href="/partners/admin/resources" className="text-sm underline">
        Gestionar recursos del programa
      </Link>
      <p role="status" className="rounded-xl border p-4 text-sm">
        Estos borradores no están activos financieramente. La activación, los descuentos, niveles y
        reglas de pago todavía no están implementados.
      </p>
      {originalCommand ? (
        <AdminWriteRecovery
          operationLabel="Crear versión DRAFT"
          reason={originalCommand.reason}
          isPending={creation.isPending}
          disabled={!session.enabled}
          onRetry={() => createDraft(originalCommand)}
        />
      ) : null}
      {query.isError ? (
        <AdminReadError
          error={query.error}
          message="No pudimos cargar las versiones DRAFT."
          onRetry={() => query.refetch()}
        />
      ) : query.isPending ? (
        <p role="status">Cargando borradores…</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Borradores guardados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {drafts.length === 0 ? (
                <p>No hay versiones DRAFT guardadas.</p>
              ) : (
                drafts.map((draft) => (
                  <article key={draft.id} className="rounded-lg border p-3 text-sm">
                    <h3 className="font-semibold">
                      {draft.code} · {draft.currency} · DRAFT
                    </h3>
                    <p>
                      Primer pago: {draft.firstPaymentRate} · Recurrente:{" "}
                      {draft.recurringPaymentRate}
                    </p>
                    <p>
                      Cantidad recurrente: {draft.recurringPaymentCount ?? "Sin cantidad declarada"}
                    </p>
                    <p>Fecha propuesta: {draft.effectiveFrom ?? "Sin fecha declarada"}</p>
                    <p className="text-muted-foreground">
                      Creado: {draft.createdAt} · ID: {draft.id}
                    </p>
                  </article>
                ))
              )}
              {query.hasNextPage && (
                <Button
                  variant="outline"
                  disabled={query.isFetchingNextPage}
                  onClick={() => query.fetchNextPage()}
                >
                  Cargar más borradores
                </Button>
              )}
            </CardContent>
          </Card>
          {query.isSuccess && !originalCommand && (
            <CommissionRulesEditor
              key={`${session.userId}:${session.epoch}`}
              onCreate={createDraft}
              isPending={creationForSession && creation.isPending}
            />
          )}
          {creationForSession && creation.isSuccess && !originalCommand && (
            <p role="status">
              Borrador DRAFT guardado: {creation.data.code}. No se activaron comisiones.
            </p>
          )}
          {creationForSession &&
            creation.isError &&
            !originalCommand &&
            !(creation.error instanceof CancelledError) && (
              <AdminReadError
                error={creation.error}
                message="No pudimos confirmar el borrador. Reintentá el mismo formulario para conservar la clave de idempotencia."
              />
            )}
        </>
      )}
    </div>
  );
}
