"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ReconciliationTask } from "@/services/reconciliationTask.service";
import { ReconciliationSourceChip } from "./ReconciliationSourceChip";

interface ReconciliationManualTableProps {
  tasks: ReconciliationTask[];
  actionLoadingId: string | null;
  onReject: (task: ReconciliationTask) => void;
}

// FEAT-17 Anexo D — tabla de la tab "Cola manual", extraída de
// `ReconciliationTab`; el origen ahora usa el chip de canal.
export function ReconciliationManualTable({
  tasks,
  actionLoadingId,
  onReject,
}: ReconciliationManualTableProps) {
  return (
    <div className="overflow-hidden rounded-md border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Línea de venta</TableHead>
            <TableHead>Pedido externo</TableHead>
            <TableHead>Referencia de línea</TableHead>
            <TableHead>Origen</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="h-24 text-center italic text-muted-foreground"
              >
                No hay líneas de venta sin resolver.
              </TableCell>
            </TableRow>
          ) : (
            tasks.map((task) => {
              const item = task.items[0];
              const isProcessing = actionLoadingId === task.id;
              return (
                <TableRow key={task.id}>
                  <TableCell
                    className="max-w-[220px] truncate text-sm font-medium"
                    title={item?.variant_name}
                  >
                    {item?.variant_name ?? "-"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {item?.external_order_id ?? "-"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {item?.external_line_ref ?? "-"}
                  </TableCell>
                  <TableCell>
                    {item?.source ? (
                      <ReconciliationSourceChip source={item.source} />
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 border-destructive/30 text-destructive hover:bg-destructive/10"
                      disabled={isProcessing}
                      onClick={() => onReject(task)}
                    >
                      <X className="mr-1 h-3.5 w-3.5" />
                      Rechazar
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
