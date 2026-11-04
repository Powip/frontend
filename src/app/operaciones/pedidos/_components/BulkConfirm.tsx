"use client";

import { useCallback, useState, type ReactNode } from "react";
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

interface PendingConfirm {
  title: string;
  description: string;
  confirmLabel: string;
  run: () => void;
}

/**
 * Confirmación de acciones masivas con la cantidad real. `confirm(...)` abre el diálogo y solo ejecuta
 * `run` si la persona acepta; `dialog` hay que renderizarlo una vez en la pestaña.
 */
export function useBulkConfirm(): {
  confirm: (options: PendingConfirm) => void;
  dialog: ReactNode;
} {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const confirm = useCallback((options: PendingConfirm) => setPending(options), []);
  const dialog = (
    <AlertDialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{pending?.title}</AlertDialogTitle>
          <AlertDialogDescription>{pending?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              const action = pending;
              setPending(null);
              action?.run();
            }}
          >
            {pending?.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
  return { confirm, dialog };
}
