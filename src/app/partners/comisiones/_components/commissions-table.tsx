import { Landmark } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";
import { formatSoles } from "@/features/partners/utils/format-currency";
import type { CommissionLine } from "@/features/partners/models/commission-line";
import type { PartnerCommissionOption } from "@/features/partners/models/partner-summary";
import { CommissionStatusBadge } from "./commission-status-badge";

interface CommissionsTableProps {
  lines: CommissionLine[] | undefined;
  isLoading: boolean;
  commissionOption: PartnerCommissionOption | undefined;
}

export function CommissionsTable({ lines, isLoading, commissionOption }: CommissionsTableProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Detalle por referido</h2>
        {commissionOption && (
          <Badge variant="secondary">
            Opción {commissionOption.code} · {commissionOption.firstMonthPct}% 1er mes + {commissionOption.recurringPct}% rec
          </Badge>
        )}
      </div>

      {isLoading || !lines ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : lines.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="Todavía no hay comisiones"
          description="Cuando un referido pague, va a aparecer acá con el detalle de su comisión."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Negocio</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Neto 1er mes</TableHead>
              <TableHead className="text-right">Comisión 1er mes</TableHead>
              <TableHead className="text-right">Recurrente/mes</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell className="font-medium text-foreground">{line.businessName}</TableCell>
                <TableCell>{line.planName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="tabular-nums">
                  {line.netFirstMonthAmount !== null ? formatSoles(line.netFirstMonthAmount) : "—"}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums",
                    line.firstMonthCommission !== null && line.firstMonthCommission < 0 && "text-destructive",
                  )}
                >
                  {line.firstMonthCommission !== null ? formatSoles(line.firstMonthCommission) : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {line.recurringCommission !== null ? formatSoles(line.recurringCommission) : "—"}
                </TableCell>
                <TableCell>
                  <CommissionStatusBadge status={line.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
