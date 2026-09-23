"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  CheckCheck,
  GitMerge,
  Link2,
  Loader2,
  PackageSearch,
  Users,
  X,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/buttonVariant";
import {
  BulkConfirmResultItem,
  ReconciliationTask,
  ReconciliationTaskStatus,
  ReconciliationTaskType,
  bulkConfirmReconciliationTasks,
  confirmReconciliationProvisional,
  getReconciliationTaskErrorMessage,
  listReconciliationTasks,
} from "@/services/reconciliationTask.service";
import { ReconciliationLinkDialog } from "./ReconciliationLinkDialog";
import { ReconciliationMergeDialog } from "./ReconciliationMergeDialog";
import { ReconciliationRejectDialog } from "./ReconciliationRejectDialog";

type TypeFilter = "ALL" | ReconciliationTaskType;
type StatusFilter = "ALL" | ReconciliationTaskStatus;

// Tipos cuyas tareas `pending` pueden entrar al lote de `bulk-confirm` —
// 'manual' siempre vuelve `skipped` en el backend (no tiene mecanismo de
// confirmación automática), así que ni se ofrece el checkbox para esas filas.
const BULK_SELECTABLE_TYPES: ReconciliationTaskType[] = [
  "provisional",
  "duplicate_cluster",
];

interface ReconciliationTabProps {
  companyId: string | undefined;
}

export function ReconciliationTab({ companyId }: ReconciliationTabProps) {
  const [tasks, setTasks] = useState<ReconciliationTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");

  const [linkInputs, setLinkInputs] = useState<Record<string, string>>({});
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [isBulkConfirming, setIsBulkConfirming] = useState(false);

  const [mergeTask, setMergeTask] = useState<ReconciliationTask | null>(null);
  const [linkTask, setLinkTask] = useState<ReconciliationTask | null>(null);
  const [rejectTask, setRejectTask] = useState<ReconciliationTask | null>(
    null,
  );

  const loadTasks = useCallback(async () => {
    if (!companyId) {
      // Sin companyId no hay nada que pedir (todavía cargando el contexto de
      // auth, por ejemplo) — corta acá para no dejar isLoading en true para
      // siempre; el estado vacío ya cubre este caso.
      setTasks([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await listReconciliationTasks({
        type: typeFilter !== "ALL" ? typeFilter : undefined,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
      });
      setTasks(data);
    } catch (error) {
      toast.error(
        getReconciliationTaskErrorMessage(
          error,
          "Error al cargar las tareas de reconciliación",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }, [companyId, typeFilter, statusFilter]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Descarta selecciones de tareas que ya no están pendientes/visibles
  // (resueltas por otra acción, o filtradas afuera) cada vez que la lista
  // se refresca.
  useEffect(() => {
    setSelectedIds((prev) => {
      const validIds = new Set(
        tasks
          .filter(
            (task) =>
              task.status === "pending" &&
              BULK_SELECTABLE_TYPES.includes(task.type),
          )
          .map((task) => task.id),
      );
      const next = new Set<string>();
      prev.forEach((id) => {
        if (validIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [tasks]);

  const toggleSelected = (taskId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(taskId);
      } else {
        next.delete(taskId);
      }
      return next;
    });
  };

  const handleConfirmProvisional = async (task: ReconciliationTask) => {
    setActionLoadingId(task.id);
    try {
      await confirmReconciliationProvisional(task.id);
      toast.success("Producto confirmado como nuevo");
      await loadTasks();
    } catch (error) {
      toast.error(
        getReconciliationTaskErrorMessage(
          error,
          "No se pudo confirmar el producto",
        ),
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  // Limpia el input de UUID de la fila y refresca la lista una vez que
  // `ReconciliationLinkDialog` confirma el vínculo — la mutación en sí vive
  // en el diálogo (requiere confirmación explícita antes de ejecutar el
  // merge irreversible contra la variante existente).
  const handleLinkSuccess = useCallback(
    async (taskId: string) => {
      setLinkInputs((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
      await loadTasks();
    },
    [loadTasks],
  );

  const handleBulkConfirm = async () => {
    if (selectedIds.size === 0) return;

    setIsBulkConfirming(true);
    try {
      const results: BulkConfirmResultItem[] =
        await bulkConfirmReconciliationTasks(Array.from(selectedIds));

      const confirmed = results.filter((r) => r.status === "confirmed").length;
      const skipped = results.filter((r) => r.status === "skipped").length;
      const errored = results.filter((r) => r.status === "error").length;

      if (confirmed > 0) {
        toast.success(`${confirmed} tarea(s) confirmada(s) correctamente`);
      }
      if (skipped > 0 || errored > 0) {
        toast.error(
          `${skipped} omitida(s), ${errored} con error al confirmar en lote`,
        );
      }

      setBulkConfirmOpen(false);
      await loadTasks();
    } catch (error) {
      toast.error(
        getReconciliationTaskErrorMessage(
          error,
          "No se pudo confirmar el lote de tareas",
        ),
      );
    } finally {
      setIsBulkConfirming(false);
    }
  };

  const provisionalTasks = tasks.filter((task) => task.type === "provisional");
  const manualTasks = tasks.filter((task) => task.type === "manual");
  const duplicateClusterTasks = tasks.filter(
    (task) => task.type === "duplicate_cluster",
  );

  const showProvisional = typeFilter === "ALL" || typeFilter === "provisional";
  const showManual = typeFilter === "ALL" || typeFilter === "manual";
  const showDuplicates =
    typeFilter === "ALL" || typeFilter === "duplicate_cluster";

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex flex-col space-y-1">
        <h3 className="text-lg font-semibold tracking-tight">
          Reconciliación de productos
        </h3>
        <p className="text-sm text-muted-foreground">
          Revisá y resolvé productos provisionales, líneas de venta sin
          resolver y posibles duplicados detectados automáticamente.
        </p>
      </div>

      <div className="bg-muted/40 p-4 rounded-lg border border-border/50">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
          <div className="flex flex-col space-y-2">
            <Label className="text-xs font-semibold uppercase text-muted-foreground/70">
              Tipo
            </Label>
            <Select
              value={typeFilter}
              onValueChange={(value) => setTypeFilter(value as TypeFilter)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los tipos</SelectItem>
                <SelectItem value="provisional">Provisionales</SelectItem>
                <SelectItem value="manual">Cola manual</SelectItem>
                <SelectItem value="duplicate_cluster">
                  Clusters de duplicados
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col space-y-2">
            <Label className="text-xs font-semibold uppercase text-muted-foreground/70">
              Estado
            </Label>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as StatusFilter)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendientes</SelectItem>
                <SelectItem value="confirmed">Confirmadas</SelectItem>
                <SelectItem value="rejected">Rechazadas</SelectItem>
                <SelectItem value="ALL">Todos los estados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end">
            {selectedIds.size > 0 && (
              <Button
                size="sm"
                className="h-9"
                onClick={() => setBulkConfirmOpen(true)}
                disabled={isBulkConfirming}
              >
                <CheckCheck className="mr-2 h-4 w-4" />
                Confirmar seleccionadas ({selectedIds.size})
              </Button>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col space-y-6">
          {[...Array(3)].map((_, sectionIndex) => (
            <div key={sectionIndex} className="flex flex-col space-y-2">
              <Skeleton className="h-5 w-48" />
              <div className="rounded-md border overflow-hidden">
                {[...Array(3)].map((_, rowIndex) => (
                  <div
                    key={rowIndex}
                    className="flex items-center gap-4 border-b p-4 last:border-b-0"
                  >
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border bg-card py-16 text-muted-foreground shadow-sm">
          <GitMerge className="mb-3 h-10 w-10 opacity-40" />
          <p className="text-sm italic">
            No hay tareas de reconciliación con los filtros aplicados.
          </p>
        </div>
      ) : (
        <div className="flex flex-col space-y-8">
          {showProvisional && (
            <section className="flex flex-col space-y-2">
              <h4 className="flex items-center gap-2 text-sm font-semibold">
                <PackageSearch className="h-4 w-4 text-muted-foreground" />
                Provisionales pendientes
                <Badge variant="secondary">{provisionalTasks.length}</Badge>
              </h4>
              <div className="overflow-hidden rounded-md border bg-card shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[40px]" />
                      <TableHead>Nombre</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Origen</TableHead>
                      <TableHead>Vincular a variante existente</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {provisionalTasks.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="h-24 text-center italic text-muted-foreground"
                        >
                          No hay provisionales pendientes.
                        </TableCell>
                      </TableRow>
                    ) : (
                      provisionalTasks.map((task) => {
                        const item = task.items[0];
                        const isProcessing = actionLoadingId === task.id;
                        return (
                          <TableRow key={task.id}>
                            <TableCell>
                              {task.status === "pending" && (
                                <Checkbox
                                  checked={selectedIds.has(task.id)}
                                  onCheckedChange={(checked) =>
                                    toggleSelected(task.id, checked === true)
                                  }
                                />
                              )}
                            </TableCell>
                            <TableCell
                              className="max-w-[220px] truncate text-sm font-medium"
                              title={item?.variant_name}
                            >
                              {item?.variant_name ?? "-"}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {item?.sku ?? item?.company_sku ?? "Sin SKU"}
                            </TableCell>
                            <TableCell>
                              {item?.source ? (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] uppercase"
                                >
                                  {item.source}
                                </Badge>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Input
                                  placeholder="UUID de variante existente"
                                  className="h-8 w-[220px] text-xs"
                                  value={linkInputs[task.id] ?? ""}
                                  onChange={(e) =>
                                    setLinkInputs((prev) => ({
                                      ...prev,
                                      [task.id]: e.target.value,
                                    }))
                                  }
                                  disabled={isProcessing}
                                />
                                <Button
                                  size="icon-sm"
                                  variant="outline"
                                  title="Vincular a esta variante"
                                  disabled={
                                    isProcessing ||
                                    !linkInputs[task.id]?.trim()
                                  }
                                  onClick={() => setLinkTask(task)}
                                >
                                  <Link2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="space-x-1 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                                disabled={isProcessing}
                                onClick={() => handleConfirmProvisional(task)}
                              >
                                {isProcessing ? (
                                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Check className="mr-1 h-3.5 w-3.5" />
                                )}
                                Confirmar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 border-destructive/30 text-destructive hover:bg-destructive/10"
                                disabled={isProcessing}
                                onClick={() => setRejectTask(task)}
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
            </section>
          )}

          {showManual && (
            <section className="flex flex-col space-y-2">
              <h4 className="flex items-center gap-2 text-sm font-semibold">
                <Users className="h-4 w-4 text-muted-foreground" />
                Cola manual
                <Badge variant="secondary">{manualTasks.length}</Badge>
              </h4>
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
                    {manualTasks.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="h-24 text-center italic text-muted-foreground"
                        >
                          No hay líneas de venta sin resolver.
                        </TableCell>
                      </TableRow>
                    ) : (
                      manualTasks.map((task) => {
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
                                <Badge
                                  variant="outline"
                                  className="text-[10px] uppercase"
                                >
                                  {item.source}
                                </Badge>
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
                                onClick={() => setRejectTask(task)}
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
            </section>
          )}

          {showDuplicates && (
            <section className="flex flex-col space-y-2">
              <h4 className="flex items-center gap-2 text-sm font-semibold">
                <GitMerge className="h-4 w-4 text-muted-foreground" />
                Clusters de duplicados
                <Badge variant="secondary">{duplicateClusterTasks.length}</Badge>
              </h4>

              {duplicateClusterTasks.length === 0 ? (
                <div className="flex h-24 items-center justify-center rounded-md border bg-card italic text-muted-foreground shadow-sm">
                  No hay clusters de duplicados sugeridos.
                </div>
              ) : (
                <div className="flex flex-col space-y-3">
                  {duplicateClusterTasks.map((task) => {
                    const isProcessing = actionLoadingId === task.id;
                    return (
                      <div
                        key={task.id}
                        className="space-y-3 rounded-md border bg-card p-4 shadow-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {task.status === "pending" && (
                              <Checkbox
                                checked={selectedIds.has(task.id)}
                                onCheckedChange={(checked) =>
                                  toggleSelected(task.id, checked === true)
                                }
                              />
                            )}
                            <span className="text-sm font-semibold">
                              Cluster de {task.items.length} variantes candidatas
                            </span>
                            {task.confidenceLevel !== null && (
                              <Badge variant="secondary">
                                {Math.round(Number(task.confidenceLevel) * 100)}%
                                confianza
                              </Badge>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              disabled={isProcessing}
                              onClick={() => setMergeTask(task)}
                            >
                              <GitMerge className="mr-1 h-3.5 w-3.5" />
                              Resolver merge
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-destructive/30 text-destructive hover:bg-destructive/10"
                              disabled={isProcessing}
                              onClick={() => setRejectTask(task)}
                            >
                              <X className="mr-1 h-3.5 w-3.5" />
                              Rechazar
                            </Button>
                          </div>
                        </div>

                        <div className="overflow-hidden rounded border">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead>Nombre</TableHead>
                                <TableHead>SKU</TableHead>
                                <TableHead>Origen</TableHead>
                                <TableHead className="text-right">
                                  Confianza
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {task.items.map((item) => (
                                <TableRow
                                  key={item.variant_id ?? item.variant_name}
                                  className={
                                    item.is_suggested_winner
                                      ? "bg-emerald-50 dark:bg-emerald-950/20"
                                      : undefined
                                  }
                                >
                                  <TableCell className="text-sm">
                                    <div className="flex items-center gap-2">
                                      {item.is_suggested_winner && (
                                        <Badge className="bg-emerald-600 hover:bg-emerald-600">
                                          Sugerida
                                        </Badge>
                                      )}
                                      <span
                                        className="max-w-[220px] truncate"
                                        title={item.variant_name}
                                      >
                                        {item.variant_name}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-mono text-xs">
                                    {item.sku ?? item.company_sku ?? "Sin SKU"}
                                  </TableCell>
                                  <TableCell>
                                    {item.source ? (
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] uppercase"
                                      >
                                        {item.source}
                                      </Badge>
                                    ) : (
                                      "-"
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right text-xs">
                                    {Math.round(item.confidence * 100)}%
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      <ReconciliationMergeDialog
        task={mergeTask}
        onClose={() => setMergeTask(null)}
        onSuccess={loadTasks}
      />

      <ReconciliationLinkDialog
        task={linkTask}
        targetVariantId={linkTask ? (linkInputs[linkTask.id] ?? "") : ""}
        onClose={() => setLinkTask(null)}
        onSuccess={handleLinkSuccess}
      />

      <ReconciliationRejectDialog
        task={rejectTask}
        onClose={() => setRejectTask(null)}
        onSuccess={loadTasks}
      />

      <AlertDialog
        open={bulkConfirmOpen}
        onOpenChange={(open) => {
          if (!open && !isBulkConfirming) setBulkConfirmOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Confirmar {selectedIds.size} tarea(s) en lote
            </AlertDialogTitle>
            <AlertDialogDescription>
              Los provisionales seleccionados se confirmarán como productos
              nuevos. Los clusters de duplicados seleccionados se fusionarán
              automáticamente usando la variante ganadora sugerida por el
              sistema. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkConfirming}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              disabled={isBulkConfirming}
              onClick={(event) => {
                event.preventDefault();
                handleBulkConfirm();
              }}
            >
              {isBulkConfirming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Confirmando...
                </>
              ) : (
                "Confirmar en lote"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
