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
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/buttonVariant";
import {
  ReconciliationTask,
  getReconciliationTaskErrorMessage,
  resolveReconciliationLink,
} from "@/services/reconciliationTask.service";

// FEAT-17 Anexo A (sección 4) — forma mínima compartida por
// `ReconciliationTaskSuggestion` (sugerencia del backend) y
// `VariantSearchResult` (elegida a mano en "Buscar otra variante"): a este
// diálogo le da igual de cuál de las dos vino la variante, sólo necesita
// estos 4 campos para mostrarla y para vincular.
export interface ReconciliationLinkTargetVariant {
  variant_id: string;
  product_name: string;
  sku: string;
  attribute_values: Record<string, string>;
}

interface ReconciliationLinkDialogProps {
  // Tarea `type: 'provisional'` + variante existente elegida (sugerencia
  // aceptada o resultado del buscador) a vincular. `null` cierra el
  // diálogo — se renderiza como diálogo controlado, mismo criterio que
  // `ReconciliationMergeDialog`, para exigir confirmación explícita antes
  // de ejecutar el link (irreversible, setea `merged_into` en el backend).
  target: {
    task: ReconciliationTask;
    variant: ReconciliationLinkTargetVariant;
  } | null;
  onClose: () => void;
  onSuccess: (taskId: string) => Promise<void> | void;
}

function formatAttributeChip(
  attributeValues: Record<string, string> | undefined,
): string | null {
  if (!attributeValues) return null;
  const values = Object.values(attributeValues).filter(Boolean);
  return values.length > 0 ? values.join(" · ") : null;
}

export function ReconciliationLinkDialog({
  target,
  onClose,
  onSuccess,
}: ReconciliationLinkDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!target) return null;

  const { task, variant } = target;
  const item = task.items[0];
  const provisionalAttributes = formatAttributeChip(item?.attribute_values);
  const targetAttributes = formatAttributeChip(variant.attribute_values);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await resolveReconciliationLink(task.id, variant.variant_id);
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
      open={!!target}
      onOpenChange={(open) => {
        if (!open && !isSubmitting) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Vincular a variante existente</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-md border p-3 text-left">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                    Provisional (venta)
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {item?.variant_name ?? "-"}
                  </p>
                  <p className="font-mono text-xs">
                    SKU: {item?.sku ?? item?.company_sku ?? "Sin SKU"}
                  </p>
                  {provisionalAttributes && (
                    <Badge variant="secondary" className="mt-1 text-[10px]">
                      {provisionalAttributes}
                    </Badge>
                  )}
                </div>
                <div className="rounded-md border p-3 text-left">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                    Variante en Powip
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {variant.product_name}
                  </p>
                  <p className="font-mono text-xs">
                    SKU: {variant.sku || "Sin SKU"}
                  </p>
                  {targetAttributes && (
                    <Badge variant="secondary" className="mt-1 text-[10px]">
                      {targetAttributes}
                    </Badge>
                  )}
                </div>
              </div>
              <p>
                Las próximas ventas de esta variante descontarán stock de la
                variante de Powip. El stock y las reservas de la provisional
                pasan a esa variante.
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
