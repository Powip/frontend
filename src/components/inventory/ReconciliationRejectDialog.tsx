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
  rejectReconciliationTask,
} from "@/services/reconciliationTask.service";

interface ReconciliationRejectDialogProps {
  // Tarea a rechazar — cualquier `type` ('provisional' | 'manual' |
  // 'duplicate_cluster'). `null` cierra el diálogo. Se renderiza como
  // diálogo controlado, mismo criterio que `ReconciliationMergeDialog` /
  // `ReconciliationLinkDialog`, para exigir confirmación explícita antes de
  // rechazar (para 'provisional' desactiva una variante real).
  task: ReconciliationTask | null;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
}

export function ReconciliationRejectDialog({
  task,
  onClose,
  onSuccess,
}: ReconciliationRejectDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!task) return null;

  const item = task.items[0];
  const consequenceText =
    task.type === "provisional"
      ? "la variante provisional se desactivará."
      : "la tarea se descartará.";

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await rejectReconciliationTask(task.id);
      toast.success("Tarea rechazada");
      await onSuccess();
      onClose();
    } catch (error) {
      toast.error(
        getReconciliationTaskErrorMessage(
          error,
          "No se pudo rechazar la tarea",
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
          <AlertDialogTitle>Rechazar tarea de reconciliación</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                {item?.variant_name && (
                  <>
                    Tarea de <strong>{item.variant_name}</strong>.{" "}
                  </>
                )}
                Al confirmar, {consequenceText}
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
            disabled={isSubmitting}
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
                Rechazando...
              </>
            ) : (
              "Confirmar rechazo"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
