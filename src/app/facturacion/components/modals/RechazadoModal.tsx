"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { ERRORES_SUNAT } from "@/types/facturacion";
import { ComprobanteRow } from "@/hooks/useComprobantesSunat";

interface RechazadoModalProps {
  isOpen: boolean;
  onClose: () => void;
  row: ComprobanteRow | null;
  onReintentar: (row: ComprobanteRow) => void;
}

export default function RechazadoModal({ isOpen, onClose, row, onReintentar }: RechazadoModalProps) {
  if (!row) return null;
  const { sale, log } = row;
  const catalogado = ERRORES_SUNAT.find((e) => log?.response_description?.includes(e.code));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Comprobante Rechazado
          </DialogTitle>
          <DialogDescription>
            Venta: <span className="font-bold text-foreground">{sale.orderNumber}</span> — {sale.customer.fullName} — S/{" "}
            {Number(sale.grandTotal).toFixed(2)}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40 p-3 text-sm">
          <div className="font-bold text-red-600 dark:text-red-400">
            {log?.observations || log?.response_description || "SUNAT rechazó el comprobante"}
          </div>
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
            className="bg-primary hover:bg-primary/90 text-white"
          >
            Corregir y reintentar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
