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
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/buttonVariant";
import { errorStatus, opsErrorMessage } from "@/lib/warehouseOps";
import { removeFromWarehouse, type RemoveFromWarehouseResult } from "@/services/warehouseOpsService";

/** Qué se quita: una variante (con su nombre y SKU) o el producto entero (todas sus variantes en el almacén). */
export type RemoveFromWarehouseItem =
  | { kind: "variant"; variantId: string; name: string; sku?: string | null }
  | { kind: "product"; productId: string; name: string };

interface Props {
  item: RemoveFromWarehouseItem;
  warehouse: { id: string; name: string; storeName?: string };
  onClose: () => void;
  /** Refresca la lista: tras quitar (`saved` true) y tras un 409 (`saved` false: el stock pudo cambiar). */
  onChanged: (saved: boolean) => void;
}

function successText(item: RemoveFromWarehouseItem, warehouseName: string, result: RemoveFromWarehouseResult): string {
  const removed = result.removed.length;
  if (removed === 0) return `${item.name} ya no estaba en ${warehouseName}.`;
  if (item.kind === "variant") return `Se quitó ${item.name} de ${warehouseName}.`;
  return `Se quitó ${item.name} de ${warehouseName} (${removed} variante${removed === 1 ? "" : "s"}).`;
}

/**
 * FEAT-24 RMV — «Quitar del almacén» con doble confirmación. Paso 1: qué se quita, de qué almacén y qué se
 * conserva. Paso 2: «Sí, quitar». El rechazo del servidor (409 con el motivo, 403) se muestra tal cual en el
 * diálogo y la lista se refresca.
 */
export function RemoveFromWarehouseDialog({ item, warehouse, onClose, onChanged }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const where = warehouse.storeName ? `${warehouse.name} (${warehouse.storeName})` : warehouse.name;
  const what = item.kind === "variant" ? `la variante ${item.name}${item.sku ? ` (SKU ${item.sku})` : ""}` : `el producto ${item.name}`;

  const confirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const target = item.kind === "variant" ? { variantId: item.variantId } : { productId: item.productId };
      const result = await removeFromWarehouse(warehouse.id, target);
      toast.success(successText(item, warehouse.name, result));
      onChanged(true);
      onClose();
    } catch (err) {
      setError(opsErrorMessage(err, "No se pudo quitar del almacén. Inténtalo de nuevo."));
      if (errorStatus(err) === 409) onChanged(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open onOpenChange={(open) => { if (!open && !submitting) onClose(); }}>
      <AlertDialogContent>
        {step === 1 ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Quitar del almacén</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm">
                  <p>
                    Vas a quitar <strong>{what}</strong> del almacén <strong>{where}</strong>.
                  </p>
                  <ul className="list-disc space-y-1 pl-5">
                    {item.kind === "product" ? <li>Se quitan todas sus variantes de este almacén, también las que ocultan los filtros. Si alguna no se puede quitar, no se quita ninguna.</li> : null}
                    <li>Deja de aparecer en el stock de este almacén.</li>
                    <li>No se elimina: sigue en el catálogo y en los demás almacenes.</li>
                    <li>Su historial de movimientos se conserva.</li>
                    <li>Puedes volver a agregarlo: aparece otra vez en este almacén cuando entra stock (compra, traslado, ajuste o importación).</li>
                    <li>Solo se puede con stock en 0 y sin reservas, traslados en camino, lotes con saldo, ajustes o conteos pendientes ni pedidos esperando.</li>
                  </ul>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <Button variant="destructive" onClick={() => setStep(2)}>Continuar</Button>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Seguro que quieres quitarlo?</AlertDialogTitle>
              <AlertDialogDescription>
                Confirma que quitas {what} del almacén {where}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {error ? (
              <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}
            <AlertDialogFooter>
              <Button variant="outline" disabled={submitting} onClick={() => { setStep(1); setError(null); }}>Volver</Button>
              <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className={buttonVariants({ variant: "destructive" })}
                disabled={submitting}
                onClick={(event) => {
                  // Deja el diálogo abierto hasta que responde el servidor (Radix lo cierra al hacer clic).
                  event.preventDefault();
                  void confirm();
                }}
              >
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Quitando...</> : "Sí, quitar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default RemoveFromWarehouseDialog;
