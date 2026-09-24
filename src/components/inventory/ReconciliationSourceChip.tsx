import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ReconciliationTaskItemSource } from "@/services/reconciliationTask.service";

const SOURCE_CONFIG: Record<
  ReconciliationTaskItemSource,
  { label: string; className: string }
> = {
  shopify: {
    label: "Shopify",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  yavendio: {
    label: "Yavendio",
    className: "border-violet-200 bg-violet-50 text-violet-700",
  },
  aliclik: {
    label: "Aliclik",
    className: "border-slate-200 bg-slate-100 text-slate-600",
  },
};

// `source: null` es una variante nativa de Powip (alta manual, sin canal
// externo) — mismo criterio que el resto de la bandeja de reconciliación.
const POWIP_SOURCE = {
  label: "Powip",
  className: "border-primary/25 bg-primary/10 text-primary",
};

/**
 * Etiqueta legible de un canal externo (usada en textos, no sólo en el
 * chip) — p.ej. la franja ámbar de `ReconciliationTab` cuando todas las
 * candidatas de un cluster vienen del mismo canal.
 */
export function getReconciliationSourceLabel(
  source: ReconciliationTaskItemSource,
): string {
  return SOURCE_CONFIG[source]?.label ?? source;
}

interface ReconciliationSourceChipProps {
  source: ReconciliationTaskItemSource | null;
  className?: string;
}

/**
 * FEAT-17 Anexo B — chip de origen por canal (colores tomados de
 * `recon.html` líneas 94-101: shopify verde, yavendio violeta, resto/otro
 * gris neutro, sin canal → Powip primario). Reutilizado por
 * `ReconciliationTab` y `ReconciliationMergeDialog`.
 */
export function ReconciliationSourceChip({
  source,
  className,
}: ReconciliationSourceChipProps) {
  const config = source
    ? (SOURCE_CONFIG[source] ?? {
        label: source,
        className: "border-slate-200 bg-slate-100 text-slate-600",
      })
    : POWIP_SOURCE;

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 font-semibold", config.className, className)}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {config.label}
    </Badge>
  );
}
