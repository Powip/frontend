import { Badge } from "@/components/ui/badge";
import {
  TAX_DOCUMENT_STATUSES,
  type TaxDocumentStatus,
} from "@/features/sunat/shared/types/sunat.types";
import { cn } from "@/lib/utils";

export function EstadoBadge({
  estado,
  className,
}: {
  estado: TaxDocumentStatus;
  className?: string;
}) {
  const meta = TAX_DOCUMENT_STATUSES[estado];

  return (
    <Badge
      variant="outline"
      className={cn("border-transparent font-semibold", meta.badgeClassName, className)}
    >
      {meta.label}
    </Badge>
  );
}
