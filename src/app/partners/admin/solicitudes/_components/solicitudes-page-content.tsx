"use client";

import { Loader2, LogIn } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PartnersRequestErrorAlert } from "@/components/partners/partners-request-error-alert";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminApplications } from "@/features/partners/hooks/use-admin-applications";
import {
  useApproveAdminApplication,
  useRejectAdminApplication,
} from "@/features/partners/hooks/use-decide-admin-application";
import { useIdempotencyKey } from "@/features/partners/hooks/use-idempotency-key";
import { useRetryCooldown } from "@/features/partners/hooks/use-retry-cooldown";
import { toPartnersRequestError } from "@/features/partners/mappers/to-partners-request-error";
import type { ApplicationDecisionAction } from "@/features/partners/models/application-decision";
import type { PartnerApplication } from "@/features/partners/models/partner-application";
import { ApplicationDecisionDialog } from "./application-decision-dialog";
import { ApplicationsTable } from "./applications-table";

const ALL_STATUSES = "ALL";

const STATUS_FILTERS = [
  { value: "APPLIED", label: "Pendientes" },
  { value: "REJECTED", label: "Rechazadas" },
  { value: ALL_STATUSES, label: "Todas" },
];

interface PendingDecision {
  application: PartnerApplication;
  action: ApplicationDecisionAction;
}

export function SolicitudesPageContent() {
  const { auth } = useAuth();
  const canDecide = auth?.user.permissions?.includes("PARTNERS_APPROVE") ?? false;
  const [statusFilter, setStatusFilter] = useState("APPLIED");
  const status = statusFilter === ALL_STATUSES ? null : statusFilter;
  const applicationsQuery = useAdminApplications(status);
  const approveApplication = useApproveAdminApplication();
  const rejectApplication = useRejectAdminApplication();
  const idempotencyKey = useIdempotencyKey();
  const listCooldown = useRetryCooldown();
  const decisionCooldown = useRetryCooldown();
  const [decision, setDecision] = useState<PendingDecision | null>(null);

  const applications = useMemo(
    () => applicationsQuery.data?.pages.flatMap((page) => page.items),
    [applicationsQuery.data],
  );

  const listError = applicationsQuery.error
    ? toPartnersRequestError(applicationsQuery.error)
    : null;
  const activeMutation = decision?.action === "reject" ? rejectApplication : approveApplication;
  const decisionError = activeMutation.error ? toPartnersRequestError(activeMutation.error) : null;
  const isDecisionPending = approveApplication.isPending || rejectApplication.isPending;
  const startListCooldown = listCooldown.start;

  useEffect(() => {
    if (!applicationsQuery.error) return;
    const { retryAfterMs } = toPartnersRequestError(applicationsQuery.error);
    if (retryAfterMs !== null) startListCooldown(retryAfterMs);
  }, [applicationsQuery.error, startListCooldown]);

  function retryList() {
    if (listCooldown.isCoolingDown) return;
    if (applicationsQuery.isFetchNextPageError) {
      applicationsQuery.fetchNextPage();
      return;
    }
    applicationsQuery.refetch();
  }

  function openDecision(application: PartnerApplication, action: ApplicationDecisionAction) {
    if (isDecisionPending) return;
    approveApplication.reset();
    rejectApplication.reset();
    setDecision({ application, action });
  }

  function confirmDecision(reason: string) {
    if (!decision || isDecisionPending || decisionCooldown.isCoolingDown) return;

    const trimmedReason = reason.trim();
    const key = idempotencyKey.resolve({
      action: decision.action,
      applicationId: decision.application.id,
      reason: trimmedReason,
    });
    const mutation = decision.action === "approve" ? approveApplication : rejectApplication;

    mutation.mutate(
      { applicationId: decision.application.id, reason: trimmedReason, idempotencyKey: key },
      {
        onSuccess: () => {
          idempotencyKey.reset();
          setDecision(null);
        },
        onError: (error) => {
          const requestError = toPartnersRequestError(error);
          if (requestError.retryAfterMs !== null) {
            decisionCooldown.start(requestError.retryAfterMs);
          }
        },
      },
    );
  }

  return (
    <div className="space-y-4 p-6">
      <Card className="rounded-2xl">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Solicitudes de partners</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Personas que pidieron unirse al programa. Al aprobar, se vincula la cuenta Powip
              registrada con el correo de la solicitud.
            </p>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44" aria-label="Filtrar por estado">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((filter) => (
                <SelectItem key={filter.value} value={filter.value}>
                  {filter.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canDecide && (
            <Alert role="note">
              <LogIn aria-hidden="true" />
              <AlertDescription className="space-y-2">
                <p>
                  Para aprobar o rechazar solicitudes tu sesión necesita el permiso
                  PARTNERS_APPROVE. Si te lo asignaron hace poco, cerrá sesión y volvé a iniciarla
                  para recibirlo.
                </p>
                <Button asChild size="sm" variant="outline">
                  <Link href="/login">Volver a iniciar sesión</Link>
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {listError && !applications ? (
            <PartnersRequestErrorAlert
              error={listError}
              remainingMs={listCooldown.remainingMs}
              fallbackMessage="No pudimos cargar las solicitudes."
              onRetry={retryList}
            />
          ) : (
            <ApplicationsTable
              applications={applications}
              isLoading={applicationsQuery.isLoading}
              canDecide={canDecide}
              isDecisionPending={isDecisionPending}
              onDecide={openDecision}
            />
          )}

          {listError && applications && (
            <PartnersRequestErrorAlert
              error={listError}
              remainingMs={listCooldown.remainingMs}
              fallbackMessage={
                applicationsQuery.isFetchNextPageError
                  ? "No pudimos cargar más solicitudes."
                  : "No pudimos actualizar las solicitudes."
              }
              onRetry={retryList}
            />
          )}

          {applicationsQuery.hasNextPage && !applicationsQuery.isFetchNextPageError && (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => applicationsQuery.fetchNextPage()}
                disabled={applicationsQuery.isFetchingNextPage}
              >
                {applicationsQuery.isFetchingNextPage ? (
                  <>
                    <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
                    Cargando...
                  </>
                ) : (
                  "Cargar más"
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <ApplicationDecisionDialog
        application={decision?.application ?? null}
        action={decision?.action ?? "approve"}
        isPending={isDecisionPending}
        error={decisionError}
        remainingMs={decisionCooldown.remainingMs}
        onConfirm={confirmDecision}
        onClose={() => setDecision(null)}
      />
    </div>
  );
}
