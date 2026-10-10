import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatSoles } from "@/features/partners/utils/format-currency";
import type { AdminLiquidationRow } from "@/features/partners/models/admin-liquidation-row";

interface AdminLiquidationsTableProps {
  rows: AdminLiquidationRow[] | undefined;
  isLoading: boolean;
  payingId: string | null;
  onPay: (id: string) => void;
}

export function AdminLiquidationsTable({ rows, isLoading, payingId, onPay }: AdminLiquidationsTableProps) {
  if (isLoading || !rows) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Sin liquidaciones en este ciclo.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Partner</TableHead>
          <TableHead>1er mes</TableHead>
          <TableHead>Recurrente</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Acción</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-medium text-foreground">{row.partnerName}</TableCell>
            <TableCell className="tabular-nums">{formatSoles(row.firstMonthAmount)}</TableCell>
            <TableCell className="tabular-nums">{formatSoles(row.recurringAmount)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatSoles(row.totalAmount)}</TableCell>
            <TableCell className="text-right">
              {row.paid ? (
                <Badge variant="secondary">Pagado ✓</Badge>
              ) : (
                <Button size="sm" disabled={payingId === row.id} onClick={() => onPay(row.id)}>
                  {payingId === row.id ? "Pagando..." : "Pagar"}
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
