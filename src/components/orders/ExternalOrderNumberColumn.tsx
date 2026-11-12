import { TableCell, TableHead } from "@/components/ui/table";
import { EXTERNAL_ORDER_NUMBER_LABEL } from "@/lib/externalOrderNumber";

/** Encabezado de la columna «N° Externo»; va justo después de «N° Orden». */
export function ExternalOrderNumberHead({ className }: { className?: string }) {
  return <TableHead className={className}>{EXTERNAL_ORDER_NUMBER_LABEL}</TableHead>;
}

/** Celda de «N° Externo»: el número, o un guion si este pedido no lo tiene. */
export function ExternalOrderNumberCell({
  value,
  className,
}: {
  value?: string | null;
  className?: string;
}) {
  const text = (value ?? "").trim();
  return (
    <TableCell className={className}>
      {text ? (
        <span className="font-mono text-xs" title={text}>
          {text}
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
    </TableCell>
  );
}
