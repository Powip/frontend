import { TableCell, TableHead } from "@/components/ui/table";
import { EXTERNAL_ORDER_NUMBER_LABEL } from "@/lib/externalOrderNumber";

/** Encabezado de la columna «N° Externo»; va justo después de «N° Orden». */
export function ExternalOrderNumberHead({ className }: { className?: string }) {
  return <TableHead className={className}>{EXTERNAL_ORDER_NUMBER_LABEL}</TableHead>;
}

/** El número, o un guion si este pedido no lo tiene. Para tablas con `<td>` planos. */
export function ExternalOrderNumberValue({ value }: { value?: string | null }) {
  const text = (value ?? "").trim();
  return text ? (
    <span className="font-mono text-xs" title={text}>
      {text}
    </span>
  ) : (
    <span className="text-muted-foreground">—</span>
  );
}

/** Celda de «N° Externo» (tablas shadcn): el número, o un guion si este pedido no lo tiene. */
export function ExternalOrderNumberCell({
  value,
  className,
}: {
  value?: string | null;
  className?: string;
}) {
  return (
    <TableCell className={className}>
      <ExternalOrderNumberValue value={value} />
    </TableCell>
  );
}
