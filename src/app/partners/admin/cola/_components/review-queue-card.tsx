"use client";

import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { QueueItemResolution, ReviewQueueItem } from "@/features/partners/models/review-queue-item";

interface ReviewQueueCardProps {
  item: ReviewQueueItem;
  isResolving: boolean;
  onResolve: (id: string, resolution: QueueItemResolution) => void;
}

const KIND_MAP: Record<
  ReviewQueueItem["kind"],
  { badgeLabel: string; badgeClassName: string; cardClassName: string; calloutClassName: string }
> = {
  conflicto: {
    badgeLabel: "Conflicto",
    badgeClassName: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900",
    cardClassName: "border-red-200 dark:border-red-900",
    calloutClassName: "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300",
  },
  fraude: {
    badgeLabel: "Alerta anti-fraude",
    badgeClassName: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
    cardClassName: "border-amber-200 dark:border-amber-900",
    calloutClassName: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  },
  revision: {
    badgeLabel: "En revisión",
    badgeClassName: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
    cardClassName: "border-border",
    calloutClassName: "bg-muted text-foreground",
  },
  sin_conflicto: {
    badgeLabel: "Sin conflicto",
    badgeClassName: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900",
    cardClassName: "border-border",
    calloutClassName: "bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300",
  },
};

const RESOLUTION_LABELS: Record<Exclude<QueueItemResolution, "pendiente">, string> = {
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  bloqueado: "Bloqueado",
  asignado: "Asignado",
  verificado: "Verificado",
};

export function ReviewQueueCard({ item, isResolving, onResolve }: ReviewQueueCardProps) {
  const kind = KIND_MAP[item.kind];

  if (item.resolution !== "pendiente") {
    return (
      <Card className="rounded-2xl">
        <CardContent className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-foreground">{item.businessName}</p>
            <p className="text-xs text-muted-foreground">{item.partnerName}</p>
          </div>
          <Badge variant="secondary">
            {RESOLUTION_LABELS[item.resolution as Exclude<QueueItemResolution, "pendiente">]} ✓
          </Badge>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("rounded-2xl", kind.cardClassName)}>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-foreground">{item.businessName}</p>
            <p className="text-xs text-muted-foreground">
              {item.partnerName} · {item.contact}
            </p>
          </div>
          <Badge variant="outline" className={kind.badgeClassName}>
            {kind.badgeLabel}
          </Badge>
        </div>

        <div className={cn("flex items-start gap-2 rounded-lg px-3 py-2 text-xs", kind.calloutClassName)}>
          {item.kind === "conflicto" && <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 flex-shrink-0" />}
          {item.kind === "fraude" && <ShieldAlert aria-hidden="true" className="mt-0.5 h-4 w-4 flex-shrink-0" />}
          {item.kind === "sin_conflicto" && <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 flex-shrink-0" />}
          <span>{item.explanation}</span>
        </div>

        {item.note && (
          <p className="rounded-lg bg-muted px-3 py-2 text-xs text-foreground">Nota: &quot;{item.note}&quot;</p>
        )}

        <div className="flex flex-wrap gap-2">
          {item.kind === "conflicto" && (
            <>
              <Button size="sm" variant="destructive" disabled={isResolving} onClick={() => onResolve(item.id, "rechazado")}>
                Rechazar
              </Button>
              <Button size="sm" variant="outline" disabled={isResolving} onClick={() => onResolve(item.id, "asignado")}>
                Asignar igual
              </Button>
            </>
          )}
          {item.kind === "fraude" && (
            <>
              <Button size="sm" variant="destructive" disabled={isResolving} onClick={() => onResolve(item.id, "bloqueado")}>
                Bloquear
              </Button>
              <Button size="sm" variant="outline" disabled={isResolving} onClick={() => onResolve(item.id, "verificado")}>
                Es legítimo
              </Button>
            </>
          )}
          {item.kind === "revision" && (
            <>
              <Button size="sm" disabled={isResolving} onClick={() => onResolve(item.id, "aprobado")}>
                Aprobar
              </Button>
              <Button size="sm" variant="destructive" disabled={isResolving} onClick={() => onResolve(item.id, "rechazado")}>
                Rechazar
              </Button>
            </>
          )}
          {item.kind === "sin_conflicto" && (
            <Button size="sm" disabled={isResolving} onClick={() => onResolve(item.id, "aprobado")}>
              Aprobar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
