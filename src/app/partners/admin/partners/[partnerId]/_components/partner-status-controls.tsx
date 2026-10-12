"use client";

import { CancelledError } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import {
  type AdminPartnerStatusInput,
  useAdminPartnerStatus,
} from "@/features/partners/hooks/use-admin-partner-status";
import { getHttpStatus } from "@/features/partners/mappers/to-partner-identity-from-error";
import type { AdminPartner } from "@/features/partners/models/admin-partner";
import { adminPartnerStatusCommandSchema } from "@/features/partners/schemas/admin-partner-status.schema";
import { AdminReadError } from "../../../_components/admin-read-error";

export function PartnerStatusControls({ partner }: { partner: AdminPartner }) {
  const { auth } = useAuth();
  if (!auth?.user.permissions?.includes("PARTNERS_MANAGE_PARTNERS")) return null;
  return <AuthorizedPartnerStatusControls partner={partner} />;
}

function AuthorizedPartnerStatusControls({ partner }: { partner: AdminPartner }) {
  const { session, mutation, mutationForSession, write } = useAdminPartnerStatus();
  if (!session.canAccess) return null;
  if (session.denied)
    return (
      <AdminReadError
        error={session.denied}
        message="No pudimos verificar tu permiso para cambiar el estado."
      />
    );
  if (partner.status !== "ACTIVE" && partner.status !== "SUSPENDED")
    return (
      <p className="text-sm text-muted-foreground">
        La suspensión y reactivación están disponibles para partners ya aprobados.
      </p>
    );

  const currentMutation = mutationForSession && mutation.variables?.input.partnerId === partner.id;
  const currentError =
    currentMutation && mutation.isError && !(mutation.error instanceof CancelledError)
      ? mutation.error
      : null;
  const errorStatus = getHttpStatus(currentError);
  const unknownResult = Boolean(currentError) && (errorStatus === null || errorStatus >= 500);
  const originalProposal = currentMutation ? mutation.variables?.input : undefined;
  if (originalProposal && (mutation.isPending || unknownResult))
    return (
      <section aria-label="Acceso del partner" className="space-y-3 rounded-xl border p-4">
        <h3 className="font-semibold">
          {originalProposal.operation === "suspend"
            ? "Solicitud de suspensión"
            : "Solicitud de reactivación"}
        </h3>
        <p role="status" className="text-sm text-muted-foreground">
          {mutation.isPending
            ? "La solicitud original está en curso. La ficha puede actualizarse mientras esperamos su confirmación."
            : "El resultado de la solicitud original es desconocido. El reintento conserva su operación, versión y motivo, aunque la ficha haya cambiado."}
        </p>
        <label
          htmlFor={`partner-status-retry-reason-${partner.id}`}
          className="block text-sm font-medium"
        >
          Motivo de la solicitud original
        </label>
        <Textarea
          id={`partner-status-retry-reason-${partner.id}`}
          value={originalProposal.command.reason}
          readOnly
          disabled
        />
        <Button
          type="button"
          disabled={!session.enabled || mutation.isPending}
          onClick={() => write(originalProposal)}
        >
          {mutation.isPending ? "Guardando…" : "Reintentar misma solicitud"}
        </Button>
      </section>
    );
  const conflict =
    errorStatus === 409 && mutation.variables?.input.command.expectedVersion === partner.version;
  const versionExhausted = partner.version >= Number.MAX_SAFE_INTEGER;
  return (
    <section aria-label="Acceso del partner" className="space-y-3 rounded-xl border p-4">
      <PartnerStatusForm
        key={`${session.userId}:${session.epoch}:${partner.id}:${partner.version}`}
        partner={partner}
        disabled={
          !session.enabled ||
          (currentMutation && mutation.isPending) ||
          conflict ||
          versionExhausted
        }
        pending={currentMutation && mutation.isPending}
        write={write}
      />
      {versionExhausted ? (
        <p role="status" className="text-sm text-muted-foreground">
          La versión alcanzó el límite soportado. No se pueden registrar más cambios de estado;
          recargar no restablece ese límite.
        </p>
      ) : null}
      {currentMutation && mutation.isSuccess ? (
        <p role="status" className="text-sm">
          Cambio confirmado. La ficha muestra el estado actual guardado.
        </p>
      ) : null}
      {currentError ? (
        <AdminReadError
          error={currentError}
          message={
            conflict
              ? "El estado cambió o la clave ya corresponde a otra operación. Revisá la ficha actual antes de guardar de nuevo."
              : "No pudimos guardar el cambio. Revisá la ficha y el motivo antes de volver a intentarlo."
          }
        />
      ) : null}
    </section>
  );
}

function PartnerStatusForm({
  partner,
  disabled,
  pending,
  write,
}: {
  partner: AdminPartner;
  disabled: boolean;
  pending: boolean;
  write: (input: AdminPartnerStatusInput) => void;
}) {
  const [reason, setReason] = useState("");
  const [invalid, setInvalid] = useState(false);
  const operation = partner.status === "ACTIVE" ? "suspend" : "resume";
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    const parsed = adminPartnerStatusCommandSchema.safeParse({
      expectedVersion: partner.version,
      reason,
    });
    if (!parsed.success) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    write({ partnerId: partner.id, operation, command: parsed.data });
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <h3 className="font-semibold">
        {operation === "suspend" ? "Suspender acceso" : "Reactivar acceso"}
      </h3>
      <p className="text-sm text-muted-foreground">
        {operation === "suspend"
          ? "Suspender impide que este partner acceda a su portal."
          : "Reactivar restablece el acceso de este partner ya aprobado."}
      </p>
      <label htmlFor={`partner-status-reason-${partner.id}`} className="block text-sm font-medium">
        Motivo del cambio
      </label>
      <Textarea
        id={`partner-status-reason-${partner.id}`}
        value={reason}
        onChange={(event) => {
          setReason(event.target.value);
          setInvalid(false);
        }}
        maxLength={2000}
        disabled={disabled}
        required
        aria-invalid={invalid}
        aria-describedby={invalid ? `partner-status-error-${partner.id}` : undefined}
      />
      {invalid ? (
        <p
          id={`partner-status-error-${partner.id}`}
          role="alert"
          className="text-sm text-destructive"
        >
          Ingresá un motivo válido de hasta 2000 caracteres.
        </p>
      ) : null}
      <Button
        type="submit"
        variant={operation === "suspend" ? "destructive" : "default"}
        disabled={disabled}
      >
        {pending
          ? "Guardando…"
          : operation === "suspend"
            ? "Suspender partner"
            : "Reactivar partner"}
      </Button>
    </form>
  );
}
