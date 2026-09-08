"use client";

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
import { useDeleteSunatDocumentSequence } from "@/features/sunat/sunat-document-sequence/hooks/use-delete-sunat-document-sequence";
import type { SunatDocumentSequence } from "@/features/sunat/sunat-document-sequence/models/sunat-document-sequence";

interface DeleteSunatDocumentSequenceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * The sequence to delete. `null` closes the dialog. Rendered as a
   * controlled dialog (rather than owning its own trigger) so SeriesTab can
   * open it from a per-row "Eliminar" button without needing one
   * AlertDialogTrigger per row.
   */
  sequence: SunatDocumentSequence | null;
  documentTypeLabel: string;
}

export function DeleteSunatDocumentSequenceDialog({
  isOpen,
  onClose,
  sequence,
  documentTypeLabel,
}: DeleteSunatDocumentSequenceDialogProps) {
  const deleteSequence = useDeleteSunatDocumentSequence();

  if (!sequence) {
    return null;
  }

  function handleConfirm() {
    if (!sequence) {
      return;
    }

    deleteSequence.mutate(
      {
        taxDocumentType: sequence.taxDocumentType,
        series: sequence.series,
      },
      {
        onSuccess: onClose,
      },
    );
  }

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !deleteSequence.isPending) {
          onClose();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar serie {sequence.series}</AlertDialogTitle>

          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                Esto elimina el correlativo configurado para {documentTypeLabel} - serie{" "}
                <span className="font-mono font-semibold">{sequence.series}</span>. Los comprobantes
                ya emitidos con esta serie no se ven afectados, pero necesitarás inicializarla de
                nuevo antes de poder emitir con ella otra vez.
              </p>

              {sequence.isDefault && (
                <p className="font-medium text-amber-600 dark:text-amber-500">
                  Esta es la serie predeterminada para {documentTypeLabel}. Si la eliminas, ningún
                  otro correlativo quedará marcado como predeterminado hasta que elijas uno nuevo.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteSequence.isPending}>Cancelar</AlertDialogCancel>

          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            disabled={deleteSequence.isPending}
            onClick={(event) => {
              // Keep the dialog open (and showing the spinner) until the
              // mutation settles, instead of the default Radix behavior of
              // closing immediately on click.
              event.preventDefault();
              handleConfirm();
            }}
          >
            {deleteSequence.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Eliminando...
              </>
            ) : (
              "Eliminar serie"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
