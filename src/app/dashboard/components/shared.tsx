"use client";

import { ReactNode } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Redondea un porcentaje que puede venir del backend con muchos decimales (ej. 29.411764705882355). */
export function roundPct(value: number | undefined | null, decimals = 0): number {
  if (value === undefined || value === null || Number.isNaN(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Filas de skeleton genéricas para secciones que todavía están cargando datos reales. */
export function SkeletonRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-5 w-full" />
      ))}
    </div>
  );
}

/** Encabezado estándar de sección: título, subtítulo opcional y slot a la derecha. */
export function SectionHeader({
  title,
  subtitle,
  right,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
      <div>
        <h3 className="text-sm font-bold text-foreground tracking-tight">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </CardHeader>
  );
}

/** Insignia que marca una sección con datos de ejemplo (sin conectar a la API real). */
export function MockBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-red-600 text-white text-[10px] font-bold px-2 py-0.5",
        className
      )}
    >
      Datos de ejemplo
    </span>
  );
}

/** Tarjeta contenedora reutilizable para las secciones del panel. */
export function SectionCard({
  title,
  subtitle,
  right,
  className,
  contentClassName,
  mock,
  children,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  className?: string;
  contentClassName?: string;
  /** Marca la tarjeta como sección con datos de ejemplo (sin conectar aún). */
  mock?: boolean;
  children: ReactNode;
}) {
  return (
    <Card
      className={cn(
        "gap-4 py-5",
        mock && "border-2 border-red-500 dark:border-red-500 bg-red-50 dark:bg-red-950/30",
        className
      )}
    >
      {title && (
        <SectionHeader
          title={
            mock ? (
              <span className="inline-flex items-center gap-2">
                {title}
                <MockBadge />
              </span>
            ) : (
              title
            )
          }
          subtitle={subtitle}
          right={right}
        />
      )}
      <CardContent className={cn("px-5", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

export type TrendDirection = "up" | "down" | "neutral";

export function TrendBadge({ label, direction }: { label: string; direction: TrendDirection }) {
  const styles: Record<TrendDirection, string> = {
    up: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
    down: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
    neutral: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  };
  const Icon = direction === "up" ? ArrowUp : direction === "down" ? ArrowDown : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
        styles[direction]
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

interface KpiCardProps {
  label: string;
  value: ReactNode;
  sub?: string;
  trend?: { label: string; direction: TrendDirection };
  primary?: boolean;
  valueClassName?: string;
  accentDanger?: boolean;
  loading?: boolean;
}

/** Tarjeta de indicador clave (KPI), con variante destacada "primary" en violeta. */
export function KpiCard({ label, value, sub, trend, primary, valueClassName, accentDanger, loading }: KpiCardProps) {
  if (primary) {
    return (
      <div className="rounded-xl p-4 bg-gradient-to-br from-violet-600 to-violet-500 text-white shadow-sm relative overflow-hidden">
        <p className="text-[10px] font-bold uppercase tracking-wide text-white/70 mb-2">{label}</p>
        {loading ? (
          <div className="h-7 w-20 bg-white/20 rounded animate-pulse" />
        ) : (
          <p className="text-2xl font-extrabold tracking-tight leading-none">{value}</p>
        )}
        {sub && <p className="text-xs text-white/75 mt-1.5">{sub}</p>}
        {trend && (
          <span className="inline-flex items-center gap-1 rounded-md bg-white/20 px-1.5 py-0.5 text-[11px] font-semibold mt-2">
            {trend.label}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4",
        accentDanger ? "border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/20" : "border-border"
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2">{label}</p>
      {loading ? (
        <div className="h-7 w-20 bg-muted animate-pulse rounded" />
      ) : (
        <p className={cn("text-2xl font-extrabold tracking-tight leading-none text-foreground", valueClassName)}>
          {value}
        </p>
      )}
      {sub && <p className="text-xs text-muted-foreground mt-1.5">{sub}</p>}
      {trend && <div className="mt-2">{trend && <TrendBadge {...trend} />}</div>}
    </div>
  );
}

export function KpiGrid({ children, cols = 5 }: { children: ReactNode; cols?: number }) {
  return (
    <div
      className="grid gap-3.5 mb-1"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  );
}

/** Fila con barra de progreso horizontal (usada en canal de origen, geografía, etc). */
export function ProgressRow({
  label,
  pct,
  color = "bg-violet-500",
  labelWidth = "min-w-[90px]",
  right,
}: {
  label: ReactNode;
  pct: number;
  color?: string;
  labelWidth?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={cn("text-xs text-muted-foreground", labelWidth)}>{label}</div>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      {right}
    </div>
  );
}

export function AvatarCircle({
  initials,
  color = "bg-violet-500",
  size = "md",
}: {
  initials: string;
  color?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = { sm: "w-6 h-6 text-[9px]", md: "w-8 h-8 text-[11px]", lg: "w-9 h-9 text-xs" };
  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-bold text-white shrink-0",
        color,
        sizes[size]
      )}
    >
      {initials}
    </div>
  );
}

const CHANNEL_PILL_STYLES: Record<string, string> = {
  WA: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  IG: "bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-400",
  TK: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  Web: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  FB: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
};

export function ChannelPill({ code }: { code: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold w-8",
        CHANNEL_PILL_STYLES[code] ?? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      )}
    >
      {code}
    </span>
  );
}

export function StatMini({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className="text-center">
      <div className={cn("text-base font-extrabold text-foreground", className)}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
