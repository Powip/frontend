"use client";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";

interface Props {
  open: boolean;
  inventoryItemId: string | null;
  productName: string;
  sku: string;
  onClose: () => void;
  onSuccess?: () => void | Promise<void>;
}

export default function DeleteInventoryItemModal({
  open,
  inventoryItemId,
  productName,
  sku,
  onClose,
  onSuccess,
}: Props) {
  const [confirmText, setConfirmText] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const expectedText = "ELIMINAR";

  const handleFirstConfirm = () => {
    setStep(2);
  };

  const handleDelete = async () => {
    if (!inventoryItemId || confirmText !== expectedText || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await axiosAuth.delete(
        `${process.env.NEXT_PUBLIC_API_INVENTORY || GATEWAY.logistics}/inventory-item/${inventoryItemId}`,
      );
    } catch (error) {
      console.error("Error eliminando producto", error);
      const message = isAxiosError<{ message?: string | string[] }>(error)
        ? error.response?.data?.message
        : undefined;
      const errorMessage = Array.isArray(message)
        ? message.filter((value) => typeof value === "string").join(". ")
        : message;
      toast.error(errorMessage || "No se pudo eliminar el producto");
      setIsSubmitting(false);
      return;
    }

    try {
      await onSuccess?.();
      toast.success("Producto eliminado del almacén");
    } catch (error) {
      console.error("Error actualizando almacén después de eliminar", error);
      toast.warning(
        "Producto eliminado, pero no se pudo actualizar el almacén. Recarga la página.",
      );
    } finally {
      setIsSubmitting(false);
      resetAndClose();
    }
  };

  const resetAndClose = () => {
    setConfirmText("");
    setStep(1);
    onClose();
  };

  const handleClose = () => {
    if (!isSubmitting) resetAndClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent
        className="max-w-md"
        aria-describedby="delete-inventory-description"
        showCloseButton={!isSubmitting}
        onEscapeKeyDown={(event) => isSubmitting && event.preventDefault()}
        onInteractOutside={(event) => isSubmitting && event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Eliminar Producto del Almacén
          </DialogTitle>
        </DialogHeader>

        {step === 1 ? (
          <>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p id="delete-inventory-description">
                ¿Estás seguro que deseas eliminar el siguiente producto del
                almacén?
              </p>
              <div className="bg-muted p-3 rounded-md">
                <p className="font-semibold text-foreground">{productName}</p>
                <p className="text-sm text-muted-foreground">SKU: {sku}</p>
              </div>
              <p className="text-sm text-red-600 font-medium">
                Esta acción no se puede deshacer.
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleFirstConfirm}>
                Continuar
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-4 text-sm text-muted-foreground">
              <div className="bg-red-50 border border-red-200 p-4 rounded-md">
                <p className="text-sm text-red-800">
                  <strong>⚠️ Confirmación final</strong>
                </p>
                <p
                  id="delete-inventory-description"
                  className="text-sm text-red-700 mt-1"
                >
                  Escribe <span className="font-mono font-bold">ELIMINAR</span>{" "}
                  para confirmar la eliminación de:
                </p>
                <p className="font-semibold text-red-900 mt-2">{productName}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="delete-inventory-confirmation">
                  Escribe ELIMINAR para confirmar
                </Label>
                <Input
                  id="delete-inventory-confirmation"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                  placeholder="ELIMINAR"
                  className="font-mono"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                disabled={isSubmitting}
              >
                Volver
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isSubmitting || confirmText !== expectedText}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar Definitivamente
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
