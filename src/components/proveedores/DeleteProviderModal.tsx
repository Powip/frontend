"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";

type DeleteProviderModalProps = {
  provider: { id: string; ruc: string; name: string };
  onCancel: () => void;
  onConfirm: () => void;
};

export default function DeleteProviderModal({
  provider,
  onCancel,
  onConfirm,
}: DeleteProviderModalProps) {
  return (
    <Dialog open={!!provider} onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmar eliminación</DialogTitle>
          <DialogDescription>
            ¿Seguro que desea eliminar este proveedor?
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-2">
          <p>
            <span className="font-semibold">RUC:</span> {provider.ruc}
          </p>
          <p>
            <span className="font-semibold">Razón Social:</span> {provider.name}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="default" onClick={onConfirm}>
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
