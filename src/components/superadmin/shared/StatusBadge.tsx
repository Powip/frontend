import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type BadgeTone = "green" | "amber" | "red" | "blue" | "gray" | "violet";

const TONE_CLASS: Record<BadgeTone, string> = {
  green: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  amber: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  red: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
  blue: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  gray: "bg-muted text-muted-foreground border-border",
  violet: "bg-primary/10 text-primary border-primary/20",
};

interface StatusBadgeProps {
  label: string;
  tone: BadgeTone;
  dot?: boolean;
  className?: string;
}

export function StatusBadge({ label, tone, dot, className }: StatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn("font-semibold border", TONE_CLASS[tone], className)}>
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            tone === "green" && "bg-emerald-500",
            tone === "amber" && "bg-amber-500",
            tone === "red" && "bg-red-500",
            tone === "blue" && "bg-blue-500",
            tone === "gray" && "bg-muted-foreground",
            tone === "violet" && "bg-primary"
          )}
        />
      )}
      {label}
    </Badge>
  );
}

/* Mapas de estado -> tono, reusados en varios módulos para no repetir el
   switch/case en cada tabla (spec 6: "Badge — verde/ámbar/rojo/azul/gris
   /violeta según estado"). */
export const ESTADO_EMPRESA_TONE: Record<string, BadgeTone> = {
  activo: "green",
  riesgo: "amber",
  trial: "blue",
  suspendido: "red",
  inactivo: "gray",
};

/** = pipeline_stage real (12 valores, ver docs/superadmin/adquisicion-endpoints.md). */
export const ESTADO_LEAD_TONE: Record<string, BadgeTone> = {
  nuevo: "blue",
  contactado: "violet",
  respondio: "violet",
  demo_pendiente: "amber",
  demo_agendada: "amber",
  demo_realizada: "amber",
  pendiente_decision: "amber",
  pendiente_pago: "amber",
  pago_recibido: "green",
  cerrado: "green",
  perdido: "red",
  cancelado: "gray",
};

export const ESTADO_LEAD_LABEL: Record<string, string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  respondio: "Respondió",
  demo_pendiente: "Demo pendiente",
  demo_agendada: "Demo agendada",
  demo_realizada: "Demo realizada",
  pendiente_decision: "Pendiente decisión",
  pendiente_pago: "Pendiente pago",
  pago_recibido: "Pago recibido",
  cerrado: "Cerrado",
  perdido: "Perdido",
  cancelado: "Cancelado",
};

export const ESTADO_FACTURA_TONE: Record<string, BadgeTone> = {
  pagado: "green",
  pendiente: "amber",
  vencido: "red",
  proyectado: "gray",
};

export const ESTADO_TICKET_TONE: Record<string, BadgeTone> = {
  Abierto: "red",
  "En proceso": "amber",
  Resuelto: "green",
};

export const NIVEL_LOG_TONE: Record<string, BadgeTone> = {
  info: "gray",
  warn: "amber",
  error: "red",
};
