import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EstadoComprobante, ESTADOS_COMPROBANTE } from "@/types/facturacion";

export function EstadoBadge({ estado, className }: { estado: EstadoComprobante; className?: string }) {
  const meta = ESTADOS_COMPROBANTE[estado];
  return (
    <Badge variant="outline" className={cn("border-transparent font-semibold", meta.badgeClassName, className)}>
      {meta.label}
    </Badge>
  );
}
