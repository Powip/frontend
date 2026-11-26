"use client";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { crmError } from "@/services/crmService";
import { CRM_UNREACHABLE } from "./ConversationList";

export function ContentLoading({ label = "Cargando…" }: { label?: string }) {
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </p>
  );
}

export function ContentError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const e = crmError(error);
  return (
    <div role="alert" className="space-y-2 text-sm">
      <p className="font-medium text-destructive">{e.unreachable ? CRM_UNREACHABLE : e.message}</p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Lima",
  });
}
