"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import type { UnopenedInvitation } from "@/features/partners/models/unopened-invitation";
import { useInviteAdminPartner } from "@/features/partners/hooks/use-invite-admin-partner";
import { invitationResendCommandSchema } from "@/features/partners/schemas/admin-invitations.schema";
import { AdminReadError } from "../../_components/admin-read-error";

const stateLabel = {
  QUEUED: "Encolada",
  TRANSPORT_ACCEPTED: "Aceptada por el servidor de correo",
  ACCEPTED: "Aceptada por el usuario",
  EXPIRED: "Vencida",
  FAILED: "Fallo de transporte",
} as const;

function InvitationRow({ invitation }: { invitation: UnopenedInvitation }) {
  const { session, mutation, mutationForSession, write } = useInviteAdminPartner();
  const [reason, setReason] = useState("");
  const pending = mutationForSession && mutation.isPending;
  const uncertain = mutationForSession && mutation.isError;
  const success = mutationForSession && mutation.isSuccess && session.enabled;
  const transportReady = invitation.transportAvailability === "AVAILABLE";
  return (
    <TableRow>
      <TableCell>
        <p className="font-medium text-foreground">{invitation.displayName}</p>
        <p className="text-xs text-muted-foreground">
          {invitation.maskedEmail} · {stateLabel[invitation.state]}
        </p>
        <p className="text-xs">
          Creada: {invitation.createdAt} · Vence: {invitation.expiresAt}
        </p>
        {invitation.sentAt ? (
          <p className="text-xs">
            Aceptación de transporte: {invitation.sentAt}. No confirma entrega.
          </p>
        ) : null}
        {!transportReady ? (
          <p role="status" className="text-xs">
            Correo pendiente de configuración o habilitación. El reenvío solo encola.
          </p>
        ) : null}
      </TableCell>
      <TableCell>
        {session.canAccess && invitation.state !== "ACCEPTED" ? (
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              const parsed = invitationResendCommandSchema.safeParse({ reason });
              if (session.enabled && !pending && !uncertain && !success && parsed.success)
                write({ operation: "resend", invitationId: invitation.id, command: parsed.data });
            }}
          >
            <label className="block text-xs" htmlFor={`resend-${invitation.id}`}>
              Motivo del reenvío
            </label>
            <Input
              id={`resend-${invitation.id}`}
              value={reason}
              maxLength={2000}
              disabled={!session.enabled || pending || uncertain || success}
              onChange={(event) => setReason(event.target.value)}
            />
            {uncertain ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!session.enabled || pending}
                onClick={() => {
                  if (mutationForSession && mutation.variables) mutation.mutate(mutation.variables);
                }}
              >
                Reintentar mismo reenvío
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={
                  !session.enabled ||
                  pending ||
                  success ||
                  !invitationResendCommandSchema.safeParse({ reason }).success
                }
              >
                {pending ? "Guardando…" : "Encolar reenvío"}
              </Button>
            )}
            {success ? <p role="status">Reenvío encolado, no entrega confirmada.</p> : null}
          </form>
        ) : (
          <p className="text-xs text-muted-foreground">
            El reenvío requiere PARTNERS_APPROVE vigente y una invitación no aceptada.
          </p>
        )}
        {session.denied ? (
          <AdminReadError
            error={session.denied}
            message="Tu autorización actual no permite reenviar."
          />
        ) : null}
        {uncertain && !session.denied ? (
          <AdminReadError
            error={mutation.error}
            message="No pudimos confirmar el reenvío. Conservamos la solicitud original."
          />
        ) : null}
      </TableCell>
    </TableRow>
  );
}

interface UnopenedInvitationsTableProps {
  invitations: UnopenedInvitation[] | undefined;
  isLoading: boolean;
}

export function UnopenedInvitationsTable({
  invitations,
  isLoading,
}: UnopenedInvitationsTableProps) {
  if (isLoading || !invitations) {
    return <Skeleton className="h-10 w-full" />;
  }

  if (invitations.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Sin invitaciones en este filtro.
      </p>
    );
  }

  return (
    <Table>
      <TableBody>
        {invitations.map((invitation) => (
          <InvitationRow key={invitation.id} invitation={invitation} />
        ))}
      </TableBody>
    </Table>
  );
}
