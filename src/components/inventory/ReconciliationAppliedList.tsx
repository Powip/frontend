"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  ReconciliationTask,
  ReconciliationTaskItemSource,
  ReconciliationTaskType,
} from "@/services/reconciliationTask.service";
import { ReconciliationSourceChip } from "./ReconciliationSourceChip";

// FEAT-17 Anexo D — el backend no distingue si una provisional se aceptó
// como nueva o se vinculó a una existente: se muestra por tipo de tarea.
const APPLIED_TYPE_LABELS: Record<ReconciliationTaskType, string> = {
  duplicate_cluster: "Unificación",
  provisional: "Provisional resuelta",
  manual: "Línea manual",
};

function formatAppliedAt(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-PE", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Lima",
  });
}

interface ReconciliationAppliedListProps {
  tasks: ReconciliationTask[];
}

export function ReconciliationAppliedList({
  tasks,
}: ReconciliationAppliedListProps) {
  return (
    <div className="overflow-hidden rounded-md border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Tipo</TableHead>
            <TableHead>Productos</TableHead>
            <TableHead>Canal</TableHead>
            <TableHead>Aplicada</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => {
            const sources = Array.from(
              new Set(
                task.items
                  .map((item) => item.source)
                  .filter(
                    (source): source is ReconciliationTaskItemSource =>
                      source !== null,
                  ),
              ),
            );
            return (
              <TableRow key={task.id}>
                <TableCell>
                  <Badge variant="secondary">
                    {APPLIED_TYPE_LABELS[task.type]}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {task.items.map((item) => item.variant_name).join(" · ")}
                </TableCell>
                <TableCell>
                  {sources.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {sources.map((source) => (
                        <ReconciliationSourceChip
                          key={source}
                          source={source}
                        />
                      ))}
                    </div>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {formatAppliedAt(task.resolvedAt)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
