"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  id: string;
  title: string;
  /** Cómo se comporta de verdad en el servidor. */
  description: ReactNode;
  /** El botón solo se activa si hay cambios válidos. */
  canSave: boolean;
  saving: boolean;
  onSave: () => void;
  error?: string | null;
  /** Aviso que explica por qué no se puede guardar (opcional). */
  hint?: string | null;
  saveLabel?: string;
  children: ReactNode;
}

/** Tarjeta de ajustes con su propio botón «Guardar». */
export default function AjustesCard({
  id,
  title,
  description,
  canSave,
  saving,
  onSave,
  error,
  hint,
  saveLabel = "Guardar",
  children,
}: Props) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="space-y-3 rounded-md border bg-card p-4"
      data-testid={`card-${id}`}
    >
      <div className="space-y-1">
        <h2 id={`${id}-title`} className="text-sm font-semibold">
          {title}
        </h2>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      {children}
      {hint && <p className="text-xs text-amber-700">{hint}</p>}
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="button" size="sm" disabled={!canSave || saving} onClick={onSave}>
          {saving && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
          {saveLabel}
        </Button>
      </div>
    </section>
  );
}

/**
 * Borrador editable de un valor del servidor. `dirty` es true si difiere; cuando
 * el valor del servidor cambia (tras guardar) el borrador se alinea con él.
 */
export function useDraft<T>(server: T) {
  const key = JSON.stringify(server);
  const [draft, setDraft] = useState<T>(server);
  useEffect(() => {
    setDraft(JSON.parse(key) as T);
  }, [key]);
  return { draft, setDraft, dirty: JSON.stringify(draft) !== key };
}
