"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Info, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  buildReceiptsDocument,
  type PrintCompany,
  type ReceiptData,
} from "@/utils/bulk-receipt-printer";
import { cn } from "@/lib/utils";

export interface PrintPreviewOrder {
  id: string;
  orderNumber: string;
}

interface BulkPrintPreviewDialogProps {
  open: boolean;
  orders: PrintPreviewOrder[];
  company: PrintCompany | null | undefined;
  fetchReceipt: (order: PrintPreviewOrder) => Promise<ReceiptData>;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

type PreviewState =
  | { status: "loading" }
  | { status: "error"; failedOrders: string[] }
  | { status: "ready"; html: string };

export function BulkPrintPreviewDialog({
  open,
  orders,
  company,
  fetchReceipt,
  onConfirm,
  onClose,
}: BulkPrintPreviewDialogProps) {
  const [preview, setPreview] = useState<PreviewState>({ status: "loading" });
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [printed, setPrinted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const requestIdRef = useRef(0);
  const sourceRef = useRef({ fetchReceipt, company });

  useEffect(() => {
    sourceRef.current = { fetchReceipt, company };
  }, [fetchReceipt, company]);

  const loadPreview = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    const isStale = () => requestId !== requestIdRef.current;
    setPreview({ status: "loading" });
    setFrameLoaded(false);

    const { fetchReceipt: fetchOne, company: printCompany } = sourceRef.current;
    const results = await Promise.allSettled(orders.map((order) => fetchOne(order)));
    if (isStale()) return;

    const failedOrders = orders
      .filter((_, index) => results[index].status === "rejected")
      .map((order) => order.orderNumber);
    if (failedOrders.length > 0) {
      console.error("Error obteniendo recibos para la vista previa", results);
      setPreview({ status: "error", failedOrders });
      return;
    }

    try {
      const receipts = results.map(
        (result) => (result as PromiseFulfilledResult<ReceiptData>).value,
      );
      const html = await buildReceiptsDocument(receipts, printCompany);
      if (isStale()) return;
      setPreview({ status: "ready", html });
    } catch (error) {
      if (isStale()) return;
      console.error("Error generando la vista previa de etiquetas", error);
      setPreview({ status: "error", failedOrders: [] });
    }
  }, [orders]);

  useEffect(() => {
    if (!open) return;
    void loadPreview();
    return () => {
      requestIdRef.current++;
      setPreview({ status: "loading" });
      setFrameLoaded(false);
      setPrinted(false);
      setConfirmOpen(false);
      setConfirming(false);
    };
  }, [open, loadPreview]);

  const handlePrint = () => {
    const frameWindow = iframeRef.current?.contentWindow;
    if (!frameWindow) {
      toast.error("No se pudo acceder a la vista previa para imprimir.");
      return;
    }
    try {
      frameWindow.focus();
      frameWindow.print();
    } catch (error) {
      console.error("Error abriendo el diálogo de impresión", error);
      toast.error("No se pudo abrir el diálogo de impresión del navegador.");
      return;
    }
    setPrinted(true);
    setConfirmOpen(true);
  };

  const handleClose = () => {
    if (confirming) return;
    if (printed) {
      toast.info("Vista previa cerrada. Los estados no fueron modificados.");
    }
    onClose();
  };

  const handleBackToPreview = () => {
    if (confirming) return;
    setConfirmOpen(false);
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setConfirming(false);
    }
  };

  const canPrint = preview.status === "ready" && frameLoaded;
  const ordersLabel = `${orders.length} ${orders.length === 1 ? "pedido" : "pedidos"}`;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent
        className={cn("flex max-h-[95vh] flex-col", confirmOpen ? "sm:max-w-lg" : "sm:max-w-2xl")}
      >
        {confirmOpen ? (
          <DialogHeader>
            <DialogTitle>¿Marcar como PREPARADO?</DialogTitle>
            <DialogDescription>
              Confirma solo si las etiquetas se imprimieron o se guardaron como PDF.
            </DialogDescription>
          </DialogHeader>
        ) : (
          <DialogHeader>
            <DialogTitle>Vista previa de etiquetas</DialogTitle>
            <DialogDescription>
              {orders.length} etiqueta(s) en el orden seleccionado. Revisa las
              etiquetas antes de imprimir o guardar como PDF. Abrir o cerrar
              esta vista no cambia el estado de los pedidos.
            </DialogDescription>
          </DialogHeader>
        )}

        {confirmOpen && (
          <section aria-label="Confirmar cambio de estado" className="space-y-3">
            <div className="rounded-md border p-3">
              <p className="mb-2 text-sm font-medium">
                {ordersLabel} {orders.length === 1 ? "cambiará" : "cambiarán"} a PREPARADO
              </p>
              <ul
                aria-label="Pedidos a actualizar"
                className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto"
              >
                {orders.map((order) => (
                  <li
                    key={order.id}
                    className="rounded bg-muted px-2 py-0.5 font-mono text-xs"
                  >
                    {order.orderNumber}
                  </li>
                ))}
              </ul>
            </div>
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Si vuelves o cierras sin confirmar, ningún pedido cambia de estado.
            </p>
          </section>
        )}

        <div className={cn("min-h-0 flex-1", confirmOpen && "hidden")}>
          {preview.status === "loading" && (
            <div
              role="status"
              className="flex h-[60vh] flex-col items-center justify-center gap-2 text-sm text-muted-foreground"
            >
              <Loader2 className="h-6 w-6 animate-spin" />
              Generando etiquetas…
            </div>
          )}

          {preview.status === "error" && (
            <div
              role="alert"
              className="flex flex-col items-center justify-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-6 text-center text-sm"
            >
              <AlertTriangle className="h-6 w-6 text-destructive" />
              {preview.failedOrders.length > 0 ? (
                <p>
                  No se pudieron obtener los recibos de:{" "}
                  <strong>{preview.failedOrders.join(", ")}</strong>
                </p>
              ) : (
                <p>No se pudieron generar las etiquetas.</p>
              )}
              <Button variant="outline" onClick={() => void loadPreview()}>
                Reintentar
              </Button>
            </div>
          )}

          {preview.status === "ready" && (
            <iframe
              ref={iframeRef}
              title="Vista previa de etiquetas"
              srcDoc={preview.html}
              onLoad={() => setFrameLoaded(true)}
              className="h-[65vh] w-full rounded-md border bg-white"
            />
          )}
        </div>

        {confirmOpen ? (
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={handleBackToPreview} disabled={confirming}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Button>
            <Button onClick={() => void handleConfirm()} disabled={confirming}>
              {confirming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Actualizando...
                </>
              ) : (
                "Sí, marcar como PREPARADO"
              )}
            </Button>
          </DialogFooter>
        ) : (
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cerrar
            </Button>
            {printed && (
              <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Marcar como PREPARADO
              </Button>
            )}
            <Button onClick={handlePrint} disabled={!canPrint}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimir / Guardar PDF
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
