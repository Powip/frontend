"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function AdminWriteRecovery({
  operationLabel,
  reason,
  isPending,
  disabled,
  onRetry,
}: {
  operationLabel: string;
  reason: string;
  isPending: boolean;
  disabled: boolean;
  onRetry: () => void;
}) {
  const reasonId = useId();
  return (
    <section aria-label="Solicitud original" className="space-y-3 rounded-xl border p-4">
      <h3 className="font-semibold">Solicitud original: {operationLabel}</h3>
      <p role="status" className="text-sm text-muted-foreground">
        {isPending
          ? "La solicitud original está en curso. Las lecturas pueden actualizarse mientras esperamos su confirmación."
          : "El resultado es desconocido. El reintento conserva exactamente la operación y todos los datos originales, aunque la lista haya cambiado o no pueda cargarse."}
      </p>
      <label htmlFor={reasonId} className="block text-sm font-medium">
        Motivo de la solicitud original
      </label>
      <Textarea id={reasonId} value={reason} readOnly disabled />
      <Button type="button" disabled={disabled || isPending} onClick={onRetry}>
        {isPending ? "Guardando…" : "Reintentar misma solicitud"}
      </Button>
    </section>
  );
}
