"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PartnerSectionError } from "@/components/partners/partner-section-error";
import { useAcceptPartnerInvitation } from "@/features/partners/hooks/use-accept-partner-invitation";
import { invitationTokenSchema } from "@/features/partners/schemas/admin-invitations.schema";

export function InvitationAcceptanceContent() {
  const { mutation, mutationForSession, enabled, epoch, accept } = useAcceptPartnerInvitation();
  const [claim, setClaim] = useState<{ token: string | null; epoch: number } | null>(null);
  const examinedEpoch = useRef<number | null>(null);
  useEffect(() => {
    // StrictMode may invoke the effect twice; do not erase a valid in-memory claim on the second pass.
    if (examinedEpoch.current === epoch) return;
    examinedEpoch.current = epoch;
    const hash = window.location.hash;
    const parsed = hash.startsWith("#token=")
      ? invitationTokenSchema.safeParse(hash.slice(7))
      : null;
    setClaim({ token: parsed?.success ? parsed.data : null, epoch });
    // Keep the secret only in component memory; never query, storage, toast or analytics payload.
    if (hash)
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + window.location.search,
      );
  }, [epoch]);
  const currentToken = claim?.epoch === epoch ? claim.token : null;
  const pending = mutationForSession && mutation.isPending;
  const failed = mutationForSession && mutation.isError;
  const accepted = mutationForSession && mutation.isSuccess && enabled;
  return (
    <section className="space-y-4 p-6">
      <h2 className="text-xl font-semibold">Aceptar invitación a Partners</h2>
      <p>
        Usá la cuenta correspondiente al correo invitado. El servidor verifica tu identidad; no se
        puede elegir otro usuario.
      </p>
      {!claim ? (
        <p role="status">Leyendo invitación…</p>
      ) : !currentToken ? (
        <p role="alert">
          Abrí nuevamente el enlace original del correo después de iniciar sesión. La clave no se
          guarda en este navegador.
        </p>
      ) : null}
      {failed ? (
        <PartnerSectionError
          error={mutation.error}
          message="No pudimos confirmar la aceptación. Reintentá la misma solicitud si tu sesión sigue vigente."
        />
      ) : null}
      {accepted ? (
        <>
          <p role="status">
            Invitación aceptada por tu cuenta. Esto no activa al partner ni aprueba condiciones
            financieras.
          </p>
          <Link href="/partners/solicitud">Continuar con la solicitud y revisión de Partners</Link>
        </>
      ) : (
        <Button
          disabled={!enabled || !currentToken || pending}
          onClick={() => {
            if (currentToken && enabled) accept(currentToken);
          }}
        >
          {pending ? "Confirmando…" : failed ? "Reintentar misma aceptación" : "Aceptar invitación"}
        </Button>
      )}
    </section>
  );
}
