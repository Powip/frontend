import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Receipt } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
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
import type { PayoutHistoryEntry } from "@/features/partners/models/payout-history-entry";
import { PayoutHistoryStatusBadge } from "./payout-history-status-badge";

interface PayoutHistoryTableProps {
  entries: PayoutHistoryEntry[] | undefined;
  isLoading: boolean;
}

export function PayoutHistoryTable({ entries, isLoading }: PayoutHistoryTableProps) {
  if (isLoading || !entries) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="Todavía no tenés liquidaciones"
        description="Cuando se programe tu primer pago, va a aparecer acá."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fecha</TableHead>
          <TableHead>Concepto</TableHead>
          <TableHead className="text-right">Monto</TableHead>
          <TableHead className="text-right">Estado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell className="text-muted-foreground">
              {format(new Date(entry.date), "dd MMM yyyy", { locale: es })}
            </TableCell>
            <TableCell className="font-medium text-foreground">{entry.concept}</TableCell>
            <TableCell className="text-right tabular-nums">{formatSoles(entry.amount)}</TableCell>
            <TableCell className="text-right">
              <PayoutHistoryStatusBadge status={entry.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
