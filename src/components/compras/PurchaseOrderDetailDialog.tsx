"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { warehouseErrorMessage } from "@/components/forms/warehouseUi";
import { PrintLabelsDialog } from "@/components/labels/PrintLabelsDialog";
import { formatPeruDateTime } from "@/components/inventory/movementLabels";
import {
  canCancelOrder,
  canEditOrder,
  canPayOrder,
  canPlaceOrder,
  canReceiveOrder,
  canReturnOrder,
  formatDay,
  lineLabel,
  paymentText,
  PURCHASE_STATUS_LABEL,
  purchaseUnitText,
  RECEIPT_TYPES,
  roundTo,
  type PurchaseAccess,
} from "@/lib/purchaseOrders";
import { getTrackedPurchase } from "@/services/inventoryTrackingService";
import { getPurchaseOrder, type PurchaseOrder, type PurchaseOrderLine, type PurchaseReception } from "@/services/purchasesService";
import { usePdfDownload } from "@/hooks/usePdfDownload";
import { purchaseOrderPdfSpec } from "@/lib/pdf/documents";
import { Money, PurchaseStatusBadge, ReturnStatusBadge } from "./PurchaseBits";

// FEAT-24 H3-E — detalle de una orden de compra (mockup mVerOC): proveedor,
// comprobante, destino, total y pago; líneas con lo pedido, recibido y devuelto
// y su costo; recepciones, devoluciones a proveedor y, en las compras con
// IMEI/serie, los códigos. Las acciones dependen del estado y del rol.
// FEAT-24 H7: cada recepción imprime las etiquetas de lo que entró (origen
// `purchase_order` de POST /labels/data, con la OC y la recepción).

export type PurchaseOrderAction = "edit" | "place" | "receive" | "return" | "payment" | "cancel";

interface TrackedPurchase {
  items?: Array<{ id?: string; variantId?: string; sku?: string; trackingMode?: string; codes?: string[]; units?: Array<{ code: string }> }>;
}

interface Props {
  order: PurchaseOrder;
  access: PurchaseAccess;
  warehouseName?: string;
  /** Emitiendo (la acción «Emitir» corre en la vista). */
  placing?: boolean;
  onAction: (action: PurchaseOrderAction, order: PurchaseOrder) => void;
  onClose: () => void;
}

const receiptLabel = (value: string | null) => RECEIPT_TYPES.find((type) => type.value === value)?.label ?? value ?? "—";

/** Subtotal sin IGV de una línea; `undefined` si el rol no ve costos. */
function lineNet(line: PurchaseOrderLine): number | null | undefined {
  if (!("unitCostNet" in line)) return undefined;
  if (line.unitCostNet === null || line.unitCostNet === undefined) return null;
  return roundTo(line.unitCostNet * line.quantity, 2);
}

export default function PurchaseOrderDetailDialog({ order: summary, access, warehouseName, placing, onAction, onClose }: Props) {
  const detailQuery = useQuery({
    queryKey: ["purchase-order", summary.id],
    queryFn: ({ signal }) => getPurchaseOrder(summary.id, signal),
    retry: false,
  });
  const order = detailQuery.data ?? summary;
  const trackedQuery = useQuery({
    queryKey: ["tracked-purchase", summary.id],
    queryFn: ({ signal }) => getTrackedPurchase<TrackedPurchase>(summary.id, signal),
    enabled: summary.hasTrackedUnits,
    retry: false,
  });
  const codesFor = (line: PurchaseOrderLine) => {
    const item = trackedQuery.data?.items?.find(
      (candidate) => candidate.id === line.id || (candidate.variantId && candidate.variantId === line.variantId) || (!candidate.variantId && candidate.sku === line.sku),
    );
    if (!item) return null;
    const codes = item.codes ?? item.units?.map((unit) => unit.code) ?? [];
    return codes.length ? { mode: item.trackingMode, codes } : null;
  };
  const receptions = detailQuery.data?.receptions ?? [];
  const [labelsFor, setLabelsFor] = useState<PurchaseReception | null>(null);
  const returns = detailQuery.data?.supplierReturns ?? [];
  // FEAT-24 H10-D4: PDF de la orden con el encabezado común (empresa, logo, usuario y página).
  const downloadPdf = usePdfDownload();
  const [pdfError, setPdfError] = useState<string | null>(null);
  const printOrder = () => {
    setPdfError(null);
    downloadPdf(purchaseOrderPdfSpec(order, { warehouseName })).catch(() => setPdfError("No se pudo generar el PDF de la orden."));
  };

  const actions: Array<{ action: PurchaseOrderAction; label: string; variant?: "outline" | "destructive" | "default" }> = [];
  if (access.canWrite && canEditOrder(order)) actions.push({ action: "edit", label: "Editar", variant: "outline" });
  if (access.canWrite && canReturnOrder(order)) actions.push({ action: "return", label: "Devolver al proveedor", variant: "outline" });
  if (access.canAdmin && canPayOrder(order))
    actions.push({ action: "payment", label: order.paymentStatus === "pagada" ? "Marcar pendiente de pago" : "Registrar pago", variant: "outline" });
  if (access.canAdmin && canCancelOrder(order)) actions.push({ action: "cancel", label: "Anular", variant: "destructive" });
  if (access.canWrite && canPlaceOrder(order)) actions.push({ action: "place", label: "Emitir orden" });
  if (access.canWrite && canReceiveOrder(order)) actions.push({ action: "receive", label: "Recibir" });

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            Compra {order.number} <PurchaseStatusBadge status={order.status} />
          </DialogTitle>
          <DialogDescription>
            {PURCHASE_STATUS_LABEL[order.status]} · {paymentText(order)}
            {order.origin === "direct" ? " · compra directa" : ""}
          </DialogDescription>
        </DialogHeader>

        {detailQuery.error ? (
          <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
            {warehouseErrorMessage(detailQuery.error, "No se pudo cargar el detalle de la compra.")}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Proveedor</p>
            <p className="font-medium">{order.supplierName ?? "—"}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Comprobante</p>
            <p className="font-mono font-medium">{order.document || "—"}</p>
            <p className="text-xs text-muted-foreground">
              {receiptLabel(order.receiptType)} · {formatDay(order.purchaseDate ?? order.createdAt)}
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Destino</p>
            <p className="font-medium">{warehouseName ?? "—"}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-semibold">
              <Money value={order.total} />
            </p>
            <p className="text-xs text-muted-foreground">
              {order.pricesIncludeIgv ? "Precios con IGV" : "Precios sin IGV"}
            </p>
          </div>
        </div>

        {order.status === "ANULADA" ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <p className="font-medium">Anulada</p>
            <p>{order.cancelReason || "Sin motivo registrado"}</p>
            {order.cancelledBy || order.cancelledAt ? (
              <p className="text-xs text-muted-foreground">
                {[order.cancelledBy, order.cancelledAt ? formatPeruDateTime(order.cancelledAt) : null].filter(Boolean).join(" · ")}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="p-2 text-left">Producto</th>
                <th className="p-2 text-left">SKU</th>
                <th className="p-2 text-right">Pedido</th>
                <th className="p-2 text-right">Recibido</th>
                <th className="p-2 text-right">Devuelto</th>
                <th className="p-2 text-right">Costo unit. sin IGV</th>
                <th className="p-2 text-right">Costo final unit.</th>
                <th className="p-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((line) => {
                const tracked = codesFor(line);
                return (
                  <tr key={line.id} className="border-t align-top">
                    <td className="p-2">
                      {lineLabel(line)}
                      {tracked ? (
                        <div className="mt-1 text-xs">
                          <p className="text-muted-foreground">{tracked.mode || "Códigos de unidad"}</p>
                          <ul className="break-all font-mono">
                            {tracked.codes.map((code) => (
                              <li key={code}>{code}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </td>
                    <td className="p-2 font-mono text-xs">{line.sku}</td>
                    <td className="p-2 text-right tabular-nums">
                      {line.quantity}
                      {line.purchaseUnit && line.purchaseFactor > 1 ? (
                        <span className="block text-xs text-muted-foreground">({purchaseUnitText(line)})</span>
                      ) : null}
                    </td>
                    <td className="p-2 text-right tabular-nums">{line.receivedQuantity}</td>
                    <td className="p-2 text-right tabular-nums">{line.returnedQuantity}</td>
                    <td className="p-2 text-right">
                      <Money value={line.unitCostNet} decimals={4} />
                    </td>
                    <td className="p-2 text-right">
                      <Money value={line.entryCost} decimals={4} />
                    </td>
                    <td className="p-2 text-right">
                      <Money value={lineNet(line)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {trackedQuery.isLoading ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Cargando los códigos de unidad…
          </p>
        ) : null}
        {trackedQuery.error ? (
          <p role="alert" className="text-xs text-destructive">
            {warehouseErrorMessage(trackedQuery.error, "No se pudieron cargar los códigos de unidad.")}
          </p>
        ) : null}

        <dl className="ml-auto grid w-full max-w-xs gap-1 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal sin IGV</dt>
            <dd>
              <Money value={order.subtotal} />
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>IGV</dt>
            <dd>
              <Money value={order.igvAmount} />
            </dd>
          </div>
          <div className="flex justify-between font-semibold">
            <dt>Total</dt>
            <dd>
              <Money value={order.total} />
            </dd>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <dt>Gastos (en el costo)</dt>
            <dd>
              <Money value={order.expenses} />
            </dd>
          </div>
        </dl>

        {receptions.length > 0 ? (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Recepciones</h3>
            <ul className="space-y-1 text-sm">
              {receptions.map((reception) => (
                <li key={reception.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
                  <span className="font-mono">{reception.number}</span>
                  <span className="text-muted-foreground">
                    {formatPeruDateTime(reception.createdAt)}
                    {reception.userName || reception.userEmail ? ` · ${reception.userName || reception.userEmail}` : ""}
                  </span>
                  <span className="tabular-nums">{reception.lines.reduce((sum, line) => sum + line.quantity, 0)} und</span>
                  {order.status !== "ANULADA" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={`Imprimir etiquetas de ${reception.number}`}
                      onClick={() => setLabelsFor(reception)}
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      Imprimir etiquetas
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {returns.length > 0 ? (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Devoluciones a proveedor</h3>
            <ul className="space-y-1 text-sm">
              {returns.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
                  <span className="font-mono">{item.number}</span>
                  <ReturnStatusBadge status={item.status} />
                  <span className="font-mono text-xs">{item.creditNoteNumber ? `NC ${item.creditNoteNumber}` : "Sin nota de crédito"}</span>
                  <Money value={item.total} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {order.notes ? <p className="text-sm text-muted-foreground">Notas: {order.notes}</p> : null}

        {labelsFor ? (
          <PrintLabelsDialog
            open
            source={{
              kind: "purchase_order",
              purchaseOrderId: order.id,
              receiptId: labelsFor.id,
              title: `${order.number} · ${labelsFor.number}`,
            }}
            onOpenChange={(next) => (!next ? setLabelsFor(null) : undefined)}
          />
        ) : null}

        {pdfError ? <p role="alert" className="text-sm text-destructive">{pdfError}</p> : null}

        <DialogFooter className="flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          <Button type="button" variant="outline" disabled={!detailQuery.data} onClick={printOrder}>
            <FileText className="mr-2 h-4 w-4" />
            PDF de la orden
          </Button>
          {actions.map(({ action, label, variant }) => (
            <Button
              key={action}
              type="button"
              variant={variant ?? "default"}
              disabled={placing && action === "place"}
              onClick={() => onAction(action, order)}
            >
              {placing && action === "place" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {label}
            </Button>
          ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
