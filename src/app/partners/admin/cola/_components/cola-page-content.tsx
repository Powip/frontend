"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PartnerSectionError } from "@/components/partners/partner-section-error";
import { useConfirmPendingPayment } from "@/features/partners/hooks/use-confirm-pending-payment";
import { usePendingPaymentConfirmations } from "@/features/partners/hooks/use-pending-payment-confirmations";
import { useResolveReviewQueueItem } from "@/features/partners/hooks/use-resolve-review-queue-item";
import { useReviewQueue } from "@/features/partners/hooks/use-review-queue";
import { useUnopenedInvitations } from "@/features/partners/hooks/use-unopened-invitations";
import type { QueueItemResolution } from "@/features/partners/models/review-queue-item";
import { PendingPaymentsTable } from "./pending-payments-table";
import { ReviewQueueCard } from "./review-queue-card";
import { UnopenedInvitationsTable } from "./unopened-invitations-table";

export function ColaPageContent() {
  const queueQuery = useReviewQueue();
  const confirmationsQuery = usePendingPaymentConfirmations();
  const invitationsQuery = useUnopenedInvitations();
  const resolveItem = useResolveReviewQueueItem();
  const confirmPayment = useConfirmPendingPayment();

  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  function handleResolve(id: string, resolution: QueueItemResolution) {
    setResolvingId(id);
    resolveItem.mutate({ id, resolution }, { onSettled: () => setResolvingId(null) });
  }

  function handleConfirm(id: string) {
    setConfirmingId(id);
    confirmPayment.mutate(id, { onSettled: () => setConfirmingId(null) });
  }

  return (
    <div className="space-y-4 p-6">
      <h2 className="sr-only">Cola de referidos</h2>

      <Alert variant="destructive">
        <AlertTriangle aria-hidden="true" />
        <AlertDescription>
          Revisá cada referido antes de aprobar la comisión. El sistema marca conflictos de
          atribución y alertas anti-fraude (mismo email/teléfono, auto-referido).
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-3">
          {queueQuery.isError ? (
            <PartnerSectionError
              message="No pudimos cargar la cola de referidos."
              onRetry={() => queueQuery.refetch()}
            />
          ) : queueQuery.isLoading || !queueQuery.data ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-32 animate-pulse rounded-2xl border bg-muted/40" />
              ))}
            </div>
          ) : (
            queueQuery.data.map((item) => (
              <ReviewQueueCard
                key={item.id}
                item={item}
                isResolving={resolvingId === item.id}
                onResolve={handleResolve}
              />
            ))
          )}
        </div>

        <div className="space-y-4">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Confirmar pago del referido</CardTitle>
            </CardHeader>
            <CardContent>
              {confirmationsQuery.isError ? (
                <PartnerSectionError
                  message="No pudimos cargar los pagos pendientes."
                  onRetry={() => confirmationsQuery.refetch()}
                />
              ) : (
                <PendingPaymentsTable
                  confirmations={confirmationsQuery.data}
                  isLoading={confirmationsQuery.isLoading}
                  confirmingId={confirmingId}
                  onConfirm={handleConfirm}
                />
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Invitaciones sin abrir</CardTitle>
            </CardHeader>
            <CardContent>
              {invitationsQuery.isError ? (
                <PartnerSectionError
                  message="No pudimos cargar las invitaciones."
                  onRetry={() => invitationsQuery.refetch()}
                />
              ) : (
                <UnopenedInvitationsTable
                  invitations={invitationsQuery.data}
                  isLoading={invitationsQuery.isLoading}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
