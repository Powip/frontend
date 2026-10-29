"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCheck, GitMerge, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Pagination } from "@/components/ui/pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ReconciliationTabKey,
  ReconciliationTask,
  ReconciliationTaskCounts,
  bulkConfirmReconciliationTasks,
  confirmReconciliationProvisional,
  getReconciliationTaskErrorMessage,
  listReconciliationTaskPage,
} from "@/services/reconciliationTask.service";
import { ReconciliationAppliedList } from "./ReconciliationAppliedList";
import { ReconciliationClusterCard } from "./ReconciliationClusterCard";
import {
  ReconciliationLinkDialog,
  ReconciliationLinkTargetVariant,
} from "./ReconciliationLinkDialog";
import { ReconciliationManualTable } from "./ReconciliationManualTable";
import { ReconciliationMergeDialog } from "./ReconciliationMergeDialog";
import { ReconciliationProvisionalCard } from "./ReconciliationProvisionalCard";
import { ReconciliationRejectDialog } from "./ReconciliationRejectDialog";

// FEAT-17 Anexo D — bandeja en tabs paginadas (spec-anexo-D). Las rechazadas
// no se muestran. La aceptación masiva es solo para provisionales (los
// clusters se unifican uno por uno, decisión de producto) y tiene tope de 10.
export const RECONCILIATION_PAGE_SIZE = 10;
export const BULK_CONFIRM_MAX = 10;

const TAB_ORDER: ReconciliationTabKey[] = [
  "por_unificar",
  "aplicadas",
  "provisionales",
  "cola_manual",
];

const TAB_LABELS: Record<ReconciliationTabKey, string> = {
  por_unificar: "Por unificar",
  aplicadas: "Aplicadas",
  provisionales: "Provisionales pendientes",
  cola_manual: "Cola manual",
};

const EMPTY_MESSAGES: Record<ReconciliationTabKey, string> = {
  por_unificar: "No hay posibles duplicados para unificar.",
  aplicadas: "Todavía no hay reconciliaciones aplicadas.",
  provisionales: "No hay provisionales pendientes.",
  cola_manual: "No hay líneas de venta sin resolver.",
};

const EMPTY_COUNTS: ReconciliationTaskCounts = {
  por_unificar: 0,
  aplicadas: 0,
  provisionales: 0,
  cola_manual: 0,
};

const isPendingProvisional = (task: ReconciliationTask) =>
  task.type === "provisional" && task.status === "pending";

interface ReconciliationTabProps {
  companyId: string | undefined;
}

export function ReconciliationTab({ companyId }: ReconciliationTabProps) {
  const [activeTab, setActiveTab] =
    useState<ReconciliationTabKey>("por_unificar");
  const [page, setPage] = useState(1);
  const [tasks, setTasks] = useState<ReconciliationTask[]>([]);
  const [counts, setCounts] = useState<ReconciliationTaskCounts>(EMPTY_COUNTS);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [isBulkConfirming, setIsBulkConfirming] = useState(false);

  const [mergeTask, setMergeTask] = useState<ReconciliationTask | null>(null);
  // FEAT-17 Anexo A — la tarea viaja junto con la variante ya elegida
  // (sugerencia aceptada o resultado de "Buscar otra variante").
  const [linkTarget, setLinkTarget] = useState<{
    task: ReconciliationTask;
    variant: ReconciliationLinkTargetVariant;
  } | null>(null);
  const [rejectTask, setRejectTask] = useState<ReconciliationTask | null>(
    null,
  );

  // Cada carga se numera: solo la última puede tocar el estado. Evita que
  // una respuesta lenta de otra tab/página pise la que se está viendo.
  const latestRequestId = useRef(0);

  const loadTasks = useCallback(async () => {
    const requestId = ++latestRequestId.current;
    const isStale = () => requestId !== latestRequestId.current;

    if (!companyId) {
      // Sin companyId (auth todavía cargando) no hay nada que pedir: se corta
      // acá para no dejar isLoading en true para siempre.
      setTasks([]);
      setCounts(EMPTY_COUNTS);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadError(false);
    try {
      const result = await listReconciliationTaskPage({
        tab: activeTab,
        page,
        limit: RECONCILIATION_PAGE_SIZE,
      });
      if (isStale()) return;
      // Se resolvió la última tarea de una página > 1: volver a la anterior
      // en vez de mostrar una página vacía (el cambio de `page` recarga).
      if (result.data.length === 0 && page > 1) {
        setPage(page - 1);
        return;
      }
      setTasks(result.data);
      setCounts(result.counts);
      setTotal(result.meta.total);
      setTotalPages(result.meta.totalPages);
    } catch (error) {
      if (isStale()) return;
      setLoadError(true);
      toast.error(
        getReconciliationTaskErrorMessage(
          error,
          "Error al cargar las tareas de reconciliación",
        ),
      );
    } finally {
      if (!isStale()) setIsLoading(false);
    }
  }, [companyId, activeTab, page]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Nunca aceptar algo que no está en pantalla: la selección se limpia al
  // cambiar de tab o de página…
  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeTab, page]);

  // …y tras cada recarga se descartan las que ya no están pendientes.
  useEffect(() => {
    setSelectedIds((prev) => {
      const pendingIds = new Set(
        tasks.filter(isPendingProvisional).map((task) => task.id),
      );
      return new Set([...prev].filter((id) => pendingIds.has(id)));
    });
  }, [tasks]);

  const handleTabChange = (value: string) => {
    setActiveTab(value as ReconciliationTabKey);
    setPage(1);
  };

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

  const selectablePageIds = tasks
    .filter(isPendingProvisional)
    .map((task) => task.id);
  const allPageSelected =
    selectablePageIds.length > 0 &&
    selectablePageIds.every((id) => selectedIds.has(id));

  const toggleSelectPage = (checked: boolean) => {
    setSelectedIds(checked ? new Set(selectablePageIds) : new Set());
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

  const handleBulkConfirm = async () => {
    if (selectedIds.size === 0 || selectedIds.size > BULK_CONFIRM_MAX) return;

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
      setSelectedIds(new Set());
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

  const renderTabBody = (tab: ReconciliationTabKey) => {
    if (isLoading) {
      return (
        <div className="flex flex-col space-y-3">
          {[...Array(3)].map((_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      );
    }

    if (loadError) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-md border bg-card py-12 text-sm text-muted-foreground shadow-sm">
          No se pudieron cargar las tareas.
          <Button size="sm" variant="outline" onClick={() => loadTasks()}>
            Reintentar
          </Button>
        </div>
      );
    }

    if (tasks.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center rounded-md border bg-card py-16 text-muted-foreground shadow-sm">
          <GitMerge className="mb-3 h-10 w-10 opacity-40" />
          <p className="text-sm italic">{EMPTY_MESSAGES[tab]}</p>
        </div>
      );
    }

    switch (tab) {
      case "por_unificar":
        return (
          <div className="flex flex-col space-y-3">
            {tasks.map((task) => (
              <ReconciliationClusterCard
                key={task.id}
                task={task}
                isProcessing={actionLoadingId === task.id}
                onMerge={() => setMergeTask(task)}
                onReject={() => setRejectTask(task)}
              />
            ))}
          </div>
        );
      case "aplicadas":
        return <ReconciliationAppliedList tasks={tasks} />;
      case "cola_manual":
        return (
          <ReconciliationManualTable
            tasks={tasks}
            actionLoadingId={actionLoadingId}
            onReject={setRejectTask}
          />
        );
      case "provisionales":
        return (
          <div className="flex flex-col space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/40 p-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={allPageSelected}
                  onCheckedChange={(checked) =>
                    toggleSelectPage(checked === true)
                  }
                  aria-label="Seleccionar las de esta página"
                />
                Seleccionar las de esta página
              </label>
              <Button
                size="sm"
                disabled={
                  selectedIds.size === 0 ||
                  selectedIds.size > BULK_CONFIRM_MAX ||
                  isBulkConfirming
                }
                onClick={() => setBulkConfirmOpen(true)}
              >
                <CheckCheck className="mr-2 h-4 w-4" />
                Aceptar como productos nuevos ({selectedIds.size})
              </Button>
            </div>
            {tasks.map((task) => (
              <ReconciliationProvisionalCard
                key={task.id}
                task={task}
                isSelected={selectedIds.has(task.id)}
                isProcessing={actionLoadingId === task.id}
                onToggleSelected={(checked) =>
                  toggleSelected(task.id, checked)
                }
                onConfirmNew={() => handleConfirmProvisional(task)}
                onReject={() => setRejectTask(task)}
                onLinkToVariant={(variant) =>
                  setLinkTarget({ task, variant })
                }
              />
            ))}
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex flex-col space-y-1">
        <h3 className="text-lg font-semibold tracking-tight">
          Reconciliación de productos
        </h3>
        <p className="text-sm text-muted-foreground">
          Revisá y resolvé posibles duplicados, productos provisionales y
          líneas de venta sin resolver.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="h-auto flex-wrap">
          {TAB_ORDER.map((tab) => (
            <TabsTrigger key={tab} value={tab} className="gap-2">
              {TAB_LABELS[tab]}
              <Badge variant="secondary">{counts[tab]}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {TAB_ORDER.map((tab) => (
          <TabsContent
            key={tab}
            value={tab}
            className="flex flex-col space-y-4"
          >
            {tab === activeTab && renderTabBody(tab)}
            {tab === activeTab &&
              !isLoading &&
              !loadError &&
              totalPages > 1 && (
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  totalItems={total}
                  itemsPerPage={RECONCILIATION_PAGE_SIZE}
                  onPageChange={setPage}
                  itemName="tareas"
                />
              )}
          </TabsContent>
        ))}
      </Tabs>

      <ReconciliationMergeDialog
        task={mergeTask}
        onClose={() => setMergeTask(null)}
        onSuccess={loadTasks}
      />

      <ReconciliationLinkDialog
        target={linkTarget}
        onClose={() => setLinkTarget(null)}
        onSuccess={loadTasks}
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
              Aceptar {selectedIds.size} producto(s) como nuevos
            </AlertDialogTitle>
            <AlertDialogDescription>
              Los provisionales seleccionados se confirmarán como productos
              nuevos. Esta acción no se puede deshacer.
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
                  Aceptando...
                </>
              ) : (
                "Aceptar en lote"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
