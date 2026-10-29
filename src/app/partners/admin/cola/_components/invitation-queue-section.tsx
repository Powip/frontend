"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  invitationStateFilterSchema,
  type InvitationStateFilter,
} from "@/features/partners/schemas/admin-invitations.schema";
import { useUnopenedInvitations } from "@/features/partners/hooks/use-unopened-invitations";
import { useAdminReadAccess } from "@/features/partners/hooks/use-admin-read-session";
import { AdminReadAccessDenied, AdminReadError } from "../../_components/admin-read-error";
import { UnopenedInvitationsTable } from "./unopened-invitations-table";

export function InvitationQueueSection() {
  const [state, setState] = useState<InvitationStateFilter>("ALL");
  const query = useUnopenedInvitations(20, state);
  const access = useAdminReadAccess();
  if (access.denied)
    return (
      <AdminReadError error={access.denied} message="Tu acceso a invitaciones fue rechazado." />
    );
  if (!access.canView) return <AdminReadAccessDenied />;
  return (
    <section aria-label="Invitaciones" className="space-y-3 rounded-lg border p-4">
      <h2 className="font-semibold">Invitaciones</h2>
      <p className="text-xs text-muted-foreground">
        No se mide la apertura del correo. Aceptar una invitación no aprueba ni activa
        automáticamente al partner.
      </p>
      <label className="block text-sm">
        Estado de invitaciones
        <select
          aria-label="Estado de invitaciones"
          className="ml-2 rounded border p-2"
          value={state}
          onChange={(event) => setState(invitationStateFilterSchema.parse(event.target.value))}
        >
          <option value="ALL">Todas</option>
          <option value="UNOPENED">Pendientes de aceptación</option>
          <option value="FAILED">Fallidas</option>
          <option value="EXPIRED">Vencidas</option>
          <option value="ACCEPTED">Aceptadas</option>
        </select>
      </label>
      {query.isError ? (
        <AdminReadError
          error={query.error}
          message="No pudimos cargar las invitaciones."
          onRetry={() => query.refetch()}
        />
      ) : (
        <UnopenedInvitationsTable
          invitations={query.data?.pages.flatMap((page) => page.items)}
          isLoading={query.isPending}
        />
      )}
      {!query.isError && query.hasNextPage ? (
        <Button
          variant="outline"
          disabled={query.isFetchingNextPage}
          onClick={() => query.fetchNextPage()}
        >
          Cargar más invitaciones
        </Button>
      ) : null}
    </section>
  );
}
