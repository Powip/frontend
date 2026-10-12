"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminReadAccess } from "@/features/partners/hooks/use-admin-read-session";
import { useAdminPartners } from "@/features/partners/hooks/use-admin-partners";
import { useAdminCapabilitySession } from "@/features/partners/hooks/use-admin-capability-session";
import type { PartnerApprovalStatus } from "@/features/partners/models/admin-partner";
import { adminPartnerStatusSchema } from "@/features/partners/schemas/admin-partners-response.schema";
import { AdminReadAccessDenied, AdminReadError } from "../../_components/admin-read-error";
import { AdminPartnersTable } from "./admin-partners-table";
import { InvitePartnerDialog } from "./invite-partner-dialog";

export function PartnersListPageContent() {
  const access = useAdminReadAccess();
  const [status, setStatus] = useState<PartnerApprovalStatus | null>(null);
  const partnersQuery = useAdminPartners(status);
  const invitations = useAdminCapabilitySession("PARTNERS_APPROVE", "invitations");
  const [inviteOpen, setInviteOpen] = useState(false);
  if (access.denied)
    return (
      <div className="p-6">
        <AdminReadError
          error={access.denied}
          message="No pudimos verificar tu acceso a Partners."
        />
      </div>
    );
  if (!access.canView)
    return (
      <div className="p-6">
        <AdminReadAccessDenied />
      </div>
    );
  const partners = partnersQuery.data?.pages.flatMap((page) => page.items);
  return (
    <div className="space-y-4 p-6">
      <Card className="rounded-2xl">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle>Partners</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/partners/admin/solicitudes">Revisar solicitudes</Link>
            </Button>
            <Button disabled={!invitations.enabled} title={!invitations.enabled ? "Requiere PARTNERS_APPROVE vigente." : undefined} onClick={() => setInviteOpen(true)}>
              + Invitar partner
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            Estado
            <select
              aria-label="Estado"
              value={status ?? ""}
              onChange={(event) =>
                setStatus(
                  event.target.value ? adminPartnerStatusSchema.parse(event.target.value) : null,
                )
              }
              className="rounded-md border bg-background px-3 py-2"
            >
              <option value="">Todos</option>
              <option value="ACTIVE">Activo</option>
              <option value="SUSPENDED">Suspendido</option>
              <option value="APPLIED">Por aprobar</option>
              <option value="REJECTED">Rechazado</option>
            </select>
          </label>
          <p className="text-xs text-muted-foreground">
            Los referidos manuales y las atribuciones LINK se cuentan por separado. Perfil, nivel y
            métricas financieras no disponibles.
          </p>
          {partnersQuery.isError ? (
            <AdminReadError
              message="No pudimos cargar los partners."
              onRetry={() => partnersQuery.refetch()}
              error={partnersQuery.error}
            />
          ) : (
            <>
              <AdminPartnersTable partners={partners} isLoading={partnersQuery.isLoading} />
              {partnersQuery.hasNextPage ? (
                <Button
                  variant="outline"
                  disabled={partnersQuery.isFetchingNextPage}
                  onClick={() => partnersQuery.fetchNextPage()}
                >
                  {partnersQuery.isFetchingNextPage ? "Cargando…" : "Cargar más partners"}
                </Button>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
      {inviteOpen ? <InvitePartnerDialog key={`${invitations.userId}:${invitations.epoch}`} isOpen={inviteOpen} onClose={() => setInviteOpen(false)} /> : null}
    </div>
  );
}
