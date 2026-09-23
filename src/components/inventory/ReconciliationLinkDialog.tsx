"use client";

import { useState } from "react";
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
import {
  ReconciliationTask,
  getReconciliationTaskErrorMessage,
  resolveReconciliationLink,
} from "@/services/reconciliationTask.service";

interface ReconciliationLinkDialogProps {
  // Tarea `type: 'provisional'` a vincular contra una variante existente.
  // `null` cierra el diálogo — se renderiza como diálogo controlado, mismo
  // criterio que `ReconciliationMergeDialog`, para abrirse desde el botón
  // "Vincular a esta variante" de cada fila de provisionales en
  // `ReconciliationTab` en vez de disparar el merge (irreversible, setea
  // `merged_into` en el backend) directo al click.
  task: ReconciliationTask | null;
  // UUID de la variante existente cargado en el input de la fila. Vive en el
  // estado del padre (`linkInputs`), no acá, para no perderlo si se cancela
  // el diálogo y se reabre.
  targetVariantId: string;
  onClose: () => void;
  onSuccess: (taskId: string) => Promise<void> | void;
}

export function ReconciliationLinkDialog({
  task,
  targetVariantId,
  onClose,
  onSuccess,
}: ReconciliationLinkDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!task) return null;

  const item = task.items[0];
  const trimmedTargetId = targetVariantId.trim();

  const handleConfirm = async () => {
    if (!trimmedTargetId) return;

    setIsSubmitting(true);
    try {
      await resolveReconciliationLink(task.id, trimmedTargetId);
      toast.success("Variante vinculada correctamente");
      await onSuccess(task.id);
      onClose();
    } catch (error) {
      toast.error(
        getReconciliationTaskErrorMessage(
          error,
          "No se pudo vincular la variante",
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
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Vincular a variante existente</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                Vas a vincular{" "}
                <strong>{item?.variant_name ?? "esta variante provisional"}</strong>
                {" "}
                (SKU: {item?.sku ?? item?.company_sku ?? "Sin SKU"}) contra la
                variante existente con id{" "}
                <span className="break-all font-mono text-xs">
                  {trimmedTargetId || "-"}
                </span>
                .
              </p>
              <p>
                La variante provisional quedará fusionada contra la variante
                existente y dejará de existir como registro independiente.
              </p>
              <p className="font-medium text-destructive">
                Esta acción no se puede deshacer.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            disabled={isSubmitting || !trimmedTargetId}
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
                Vinculando...
              </>
            ) : (
              "Confirmar vinculación"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
