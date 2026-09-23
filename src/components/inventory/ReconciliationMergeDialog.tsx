"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import {
  ReconciliationTask,
  getReconciliationTaskErrorMessage,
  resolveReconciliationMerge,
} from "@/services/reconciliationTask.service";

interface ReconciliationMergeDialogProps {
  // Tarea `type: 'duplicate_cluster'` a resolver. `null` cierra el diálogo —
  // se renderiza como diálogo controlado (en vez de dueño de su propio
  // trigger) para poder abrirse desde el botón "Resolver merge" de cada
  // card del cluster en `ReconciliationTab`.
  task: ReconciliationTask | null;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
}

export function ReconciliationMergeDialog({
  task,
  onClose,
  onSuccess,
}: ReconciliationMergeDialogProps) {
  const [selectedWinnerId, setSelectedWinnerId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Preselecciona la ganadora sugerida por el backend (heurística: origen
  // manual > variante más antigua). Si el cluster no trae ninguna marcada
  // (no debería pasar), cae al primer candidato.
  useEffect(() => {
    if (!task) {
      setSelectedWinnerId("");
      return;
    }
    const suggested = task.items.find((item) => item.is_suggested_winner);
    const fallback = task.items[0];
    setSelectedWinnerId((suggested ?? fallback)?.variant_id ?? "");
  }, [task]);

  if (!task) return null;

  const handleConfirm = async () => {
    if (!selectedWinnerId) return;

    const loserVariantIds = task.items
      .map((item) => item.variant_id)
      .filter(
        (variantId): variantId is string =>
          variantId !== null && variantId !== selectedWinnerId,
      );

    setIsSubmitting(true);
    try {
      await resolveReconciliationMerge(
        task.id,
        selectedWinnerId,
        loserVariantIds,
      );
      toast.success("Cluster de duplicados fusionado correctamente");
      await onSuccess();
      onClose();
    } catch (error) {
      toast.error(
        getReconciliationTaskErrorMessage(
          error,
          "No se pudo resolver el merge del cluster",
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog
      open={!!task}
      onOpenChange={(open) => {
        if (!open && !isSubmitting) onClose();
      }}
    >
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Resolver duplicados</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Elegí cuál de las variantes candidatas es la correcta. Las
                demás se fusionarán contra ella (soft-merge) y dejarán de
                existir como variantes independientes. El stock y las
                reservas de las variantes que se eliminan pasan a la
                variante que queda. Esta acción no se puede deshacer.
              </p>
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {task.items.map((item) => {
                  const isSelected = selectedWinnerId === item.variant_id;
                  return (
                    <label
                      key={item.variant_id ?? item.variant_name}
                      className={`flex items-start gap-2 rounded-md border p-2 text-sm ${
                        isSubmitting ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                      } ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="reconciliation-merge-winner"
                        className="mt-1 accent-primary"
                        checked={isSelected}
                        disabled={isSubmitting}
                        onChange={() =>
                          item.variant_id &&
                          setSelectedWinnerId(item.variant_id)
                        }
                      />
                      <span className="flex-1 text-foreground">
                        <span className="font-medium">
                          {item.variant_name}
                        </span>
                        {item.is_suggested_winner && (
                          <Badge className="ml-2 bg-emerald-600 hover:bg-emerald-600">
                            Sugerida
                          </Badge>
                        )}
                        <span className="block text-xs text-muted-foreground">
                          SKU: {item.sku ?? item.company_sku ?? "Sin SKU"}
                          {item.source ? ` · ${item.source}` : ""} ·{" "}
                          {Math.round(item.confidence * 100)}% confianza
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            disabled={isSubmitting || !selectedWinnerId}
            onClick={(event) => {
              // Mantiene el diálogo abierto (mostrando el spinner) hasta que
              // la mutación termina, en vez del cierre inmediato por defecto
              // de Radix al clickear una AlertDialogAction.
              event.preventDefault();
              handleConfirm();
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Fusionando...
              </>
            ) : (
              "Confirmar fusión"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
