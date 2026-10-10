import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import type { PendingPaymentConfirmation } from "@/features/partners/models/pending-payment-confirmation";

interface PendingPaymentsTableProps {
  confirmations: PendingPaymentConfirmation[] | undefined;
  isLoading: boolean;
  confirmingId: string | null;
  onConfirm: (id: string) => void;
}

export function PendingPaymentsTable({
  confirmations,
  isLoading,
  confirmingId,
  onConfirm,
}: PendingPaymentsTableProps) {
  if (isLoading || !confirmations) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (confirmations.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Sin pagos pendientes de confirmar.</p>;
  }

  return (
    <Table>
      <TableBody>
        {confirmations.map((item) => (
          <TableRow key={item.id}>
            <TableCell>
              <p className="font-medium text-foreground">{item.businessName}</p>
              <p className="text-xs text-muted-foreground">
                {item.partnerName} · {item.statusNote}
              </p>
            </TableCell>
            <TableCell>
              {item.confirmed ? (
                <Badge variant="secondary">Pagó ✓</Badge>
              ) : (
                <Badge variant="outline">Sin pago</Badge>
              )}
            </TableCell>
            <TableCell className="text-right">
              {!item.confirmed && (
                <Button size="sm" disabled={confirmingId === item.id} onClick={() => onConfirm(item.id)}>
                  {confirmingId === item.id ? "Confirmando..." : "Confirmar"}
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
