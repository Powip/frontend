"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TaxDocumentRow } from "@/features/sunat/sunat-document/types/tax-document-row";
import { ERRORES_SUNAT } from "@/types/facturacion";

interface RechazadoModalProps {
  isOpen: boolean;
  onClose: () => void;
  row: TaxDocumentRow | null;
  onReintentar: (row: TaxDocumentRow) => void;
}

export default function RechazadoModal({
  isOpen,
  onClose,
  row,
  onReintentar,
}: RechazadoModalProps) {
  if (!row) {
    return null;
  }

  const { sale, taxDocument } = row;

  const catalogado = ERRORES_SUNAT.find((error) =>
    taxDocument?.sunatDescription?.includes(error.code),
  );

  const errorMessage =
    taxDocument?.observations || taxDocument?.sunatDescription || "SUNAT rechazó el comprobante";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Comprobante Rechazado
          </DialogTitle>

          <DialogDescription>
            Venta: <span className="font-bold text-foreground">{sale.orderNumber}</span>
            {" — "}
            {sale.customer.fullName}
            {" — "}
            S/ {Number(sale.grandTotal).toFixed(2)}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950/40">
          <div className="font-bold text-red-600 dark:text-red-400">{errorMessage}</div>

          {catalogado && (
            <div className="mt-1 text-red-800 dark:text-red-300">
              <b>Solución sugerida:</b> {catalogado.sol}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>

          <Button
            onClick={() => {
              onClose();
              onReintentar(row);
            }}
            className="bg-primary text-white hover:bg-primary/90"
          >
            Corregir y reintentar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
