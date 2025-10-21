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

type DeleteProductModalProps = {
  product: { id: string; sku: string; name: string };
  onCancel: () => void;
  onConfirm: () => void;
};

export default function DeleteProductModal({
  product,
  onCancel,
  onConfirm,
}: DeleteProductModalProps) {
  return (
    <Dialog open={!!product} onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmar eliminación</DialogTitle>
          <DialogDescription>
            ¿Seguro que querés eliminar este producto?
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-2">
          <p>
            <span className="font-semibold">SKU:</span> {product.sku}
          </p>
          <p>
            <span className="font-semibold">Nombre:</span> {product.name}
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
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
