"use client";

import { Info } from "lucide-react";
import { useId, useState } from "react";
import { FormDraftActions } from "../programacion/FormDraftActions";

interface SettingsDraftFooterProps {
  isDirty: boolean;
  blockedReason: string | null;
  saveLabel: string;
  discardTitle: string;
  onDiscard: () => void;
  onSave?: () => Promise<void>;
}

export function SettingsDraftFooter({
  isDirty,
  blockedReason,
  saveLabel,
  discardTitle,
  onDiscard,
  onSave,
}: SettingsDraftFooterProps) {
  const reasonId = useId();
  const [status, setStatus] = useState<
    { kind: "idle" } | { kind: "pending" } | { kind: "error"; message: string }
  >({ kind: "idle" });
  if (!isDirty) return null;
  const blocked = !!blockedReason || !onSave || status.kind === "pending";

  const save = async () => {
    if (blocked || !onSave) return;
    setStatus({ kind: "pending" });
    try {
      await onSave();
      setStatus({ kind: "idle" });
    } catch (caught) {
      setStatus({
        kind: "error",
        message: caught instanceof Error && caught.message ? caught.message : "No se pudo guardar.",
      });
    }
  };

  return (
    <div className="space-y-2 border-t pt-3">
      <FormDraftActions
        isDirty
        blocked={blocked}
        blockedReasonId={reasonId}
        saveLabel={saveLabel}
        discardTitle={discardTitle}
        onConfirmDiscard={onDiscard}
        onSave={save}
      />
      {blockedReason && (
        <p
          id={reasonId}
          className="flex items-start gap-1.5 text-xs text-muted-foreground sm:justify-end"
        >
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {blockedReason}
        </p>
      )}
      {status.kind === "pending" && (
        <p role="status" className="text-xs text-muted-foreground sm:text-right">
          Guardando…
        </p>
      )}
      {status.kind === "error" && (
        <p role="alert" className="text-xs text-red-700 dark:text-red-300 sm:text-right">
          {status.message} Tus cambios se conservan.
        </p>
      )}
    </div>
  );
}

export function SuggestedValuesNote({ reason }: { reason: "pending" | "not-configured" }) {
  return (
    <p className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      {reason === "pending"
        ? "Valores sugeridos del documento para una configuración nueva. No son la configuración guardada: todavía no se puede leer ni guardar."
        : "Todavía no hay una configuración guardada. Estos son valores sugeridos para empezar."}
    </p>
  );
}
