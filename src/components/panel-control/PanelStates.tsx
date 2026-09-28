"use client";

import { AlertTriangle, Lock, PlugZap, SearchX } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { DataOrigin } from "@/features/panel-control/shared/models/data-origin.model";
import { cn } from "@/lib/utils";

export type SkeletonVariant = "kpis" | "tabla" | "grafico" | "linea";

export function PanelSkeleton({
  variant = "kpis",
  label,
}: {
  variant?: SkeletonVariant;
  label: string;
}) {
  return (
    <div role="status" aria-busy="true" aria-label={`Cargando ${label}`} className="w-full">
      {variant === "kpis" && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {["a", "b", "c", "d"].map((key) => (
            <div key={key} className="rounded-2xl border border-pc-border bg-pc-card p-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-3 h-7 w-28" />
              <Skeleton className="mt-2 h-3 w-36" />
            </div>
          ))}
        </div>
      )}
      {variant === "tabla" && (
        <div className="space-y-2 rounded-xl border border-pc-border bg-pc-card p-4">
          {["a", "b", "c", "d", "e"].map((key) => (
            <Skeleton key={key} className="h-6 w-full" />
          ))}
        </div>
      )}
      {variant === "grafico" && <Skeleton className="h-56 w-full rounded-xl" />}
      {variant === "linea" && <Skeleton className="h-4 w-72" />}
    </div>
  );
}

interface StateBoxProps {
  icon: ReactNode;
  titulo: string;
  children?: ReactNode;
  className?: string;
  tono?: "neutro" | "error" | "pendiente";
}

function StateBox({ icon, titulo, children, className, tono = "neutro" }: StateBoxProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center",
        tono === "error"
          ? "border-pc-bad/40 bg-pc-bad-soft/40"
          : "border-pc-border bg-pc-surface-muted",
        className,
      )}
    >
      <span aria-hidden className={cn(tono === "error" ? "text-pc-bad" : "text-pc-text-soft")}>
        {icon}
      </span>
      <p className="text-sm font-semibold text-pc-text">{titulo}</p>
      {children && (
        <div className="max-w-md text-xs leading-relaxed text-pc-text-muted">{children}</div>
      )}
    </div>
  );
}

export function PanelEmpty({ mensaje = "Sin datos para estos filtros" }: { mensaje?: string }) {
  return <StateBox icon={<SearchX className="size-6" />} titulo={mensaje} />;
}

export function PanelError({ error, onRetry }: { error: Error | null; onRetry?: () => void }) {
  return (
    <StateBox
      tono="error"
      icon={<AlertTriangle className="size-6" />}
      titulo="No se pudieron cargar los datos"
    >
      <p role="alert">{error?.message ?? "Error desconocido"}</p>
      {onRetry && (
        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </StateBox>
  );
}

export function PendingIntegration({ origin, titulo }: { origin: DataOrigin; titulo?: string }) {
  return (
    <StateBox
      tono="pendiente"
      icon={<PlugZap className="size-6" />}
      titulo={titulo ?? "Pendiente de integración"}
    >
      <p>{origin.detalle}.</p>
      <p className="mt-1 font-mono text-[11px] text-pc-text-soft">{origin.endpoint}</p>
    </StateBox>
  );
}

export function RestrictedNotice({ motivo }: { motivo: string }) {
  return (
    <StateBox icon={<Lock className="size-6" />} titulo="Sin permiso para ver esta información">
      <p>{motivo}</p>
    </StateBox>
  );
}
