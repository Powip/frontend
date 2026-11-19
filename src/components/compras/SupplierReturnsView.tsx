"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Info, Loader2, Plus, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { HeaderConfig } from "@/components/header/HeaderConfig";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { warehouseErrorMessage } from "@/components/forms/warehouseUi";
import { useCompanyWarehouses } from "@/hooks/useCompanyWarehouses";
import { usePdfDownload } from "@/hooks/usePdfDownload";
import { supplierReturnPdfSpec } from "@/lib/pdf/documents";
import { periodLockedMessage } from "@/lib/reports/periods";
import { canReturnOrder, formatDay, purchaseAccess, RETURN_STATUS_LABEL } from "@/lib/purchaseOrders";
import {
  cancelSupplierReturn,
  listPurchaseOrders,
  listSupplierReturns,
  registerCreditNote,
  sendSupplierReturn,
  type PurchaseOrder,
  type SupplierReturn,
  type SupplierReturnStatus,
} from "@/services/purchasesService";
import { Money, PurchasesNav, ReturnStatusBadge, SELECT_CLASS } from "./PurchaseBits";
import SupplierReturnFormDialog from "./SupplierReturnFormDialog";

// FEAT-24 H3-E — Compras › Devoluciones a proveedor (mockup vDevProv):
// borrador → enviada (sale el stock) → nota de crédito recibida, o anulada.
// Se crean desde una compra recibida.

type ReturnAction = "send" | "credit-note" | "cancel";

const STATUS_FILTERS: Array<{ value: "" | SupplierReturnStatus; label: string }> = [
  { value: "", label: "Todos los estados" },
  { value: "borrador", label: RETURN_STATUS_LABEL.borrador },
  { value: "enviada", label: RETURN_STATUS_LABEL.enviada },
  { value: "nc_recibida", label: RETURN_STATUS_LABEL.nc_recibida },
  { value: "anulada", label: RETURN_STATUS_LABEL.anulada },
];

export default function SupplierReturnsView() {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";
  const access = purchaseAccess(auth?.user);
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"" | SupplierReturnStatus>("");
  const [pickOrder, setPickOrder] = useState(false);
  const [newFor, setNewFor] = useState<PurchaseOrder | null>(null);
  const [action, setAction] = useState<{ kind: ReturnAction; item: SupplierReturn } | null>(null);
  // FEAT-24 H10-D4: PDF de la devolución con el encabezado común.
  const downloadPdf = usePdfDownload();
  const { nameOf } = useCompanyWarehouses();
  const printReturn = (item: SupplierReturn) => {
    downloadPdf(supplierReturnPdfSpec(item, { warehouseName: nameOf(item.inventoryId) })).catch(() => toast.error("No se pudo generar el PDF de la devolución."));
  };

  const returnsQuery = useQuery({
    queryKey: ["supplier-returns", companyId, status],
    queryFn: ({ signal }) => listSupplierReturns({ status: status || undefined }, signal),
    enabled: !!companyId,
    retry: false,
  });
  const items = returnsQuery.data ?? [];
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["supplier-returns", companyId] });
    void queryClient.invalidateQueries({ queryKey: ["purchase-orders", companyId] });
    void queryClient.invalidateQueries({ queryKey: ["purchase-suppliers", companyId] });
  };

  return (
    <div className="w-full px-4 pb-6 md:px-6">
      <HeaderConfig title="Compras" description="Producto que vuelve al proveedor" />
      <div className="mb-4">
        <PurchasesNav />
      </div>

      <div className="mb-4 flex gap-2 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          <strong className="text-foreground">Devolución a proveedor:</strong> producto fallado que vuelve al proveedor. Sale del stock al
          enviarla y queda esperando la nota de crédito; al recibirla, se descuenta de lo que se le debe al proveedor.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle className="flex items-center gap-2">
            <Undo2 className="h-5 w-5" />
            Devoluciones a proveedor
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Estado"
              className={`${SELECT_CLASS} md:w-64`}
              value={status}
              onChange={(e) => setStatus(e.target.value as "" | SupplierReturnStatus)}
            >
              {STATUS_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {access.canWrite ? (
              <Button type="button" onClick={() => setPickOrder(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva devolución
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {returnsQuery.error ? (
            <div role="alert" className="mb-3 rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
              {warehouseErrorMessage(returnsQuery.error, "No se pudieron cargar las devoluciones.")}
            </div>
          ) : null}
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="p-2 text-left">Nº</th>
                  <th className="p-2 text-left">Fecha</th>
                  <th className="p-2 text-left">Proveedor</th>
                  <th className="p-2 text-left">Compra</th>
                  <th className="p-2 text-left">Productos</th>
                  <th className="p-2 text-left">Motivo</th>
                  <th className="p-2 text-right">Monto</th>
                  <th className="p-2 text-left">Nota de crédito</th>
                  <th className="p-2 text-left">Estado</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {returnsQuery.isLoading ? (
                  <tr className="border-t">
                    <td colSpan={10} className="p-2">
                      <Skeleton className="h-5 w-full" />
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-muted-foreground">
                      No hay devoluciones a proveedor.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="border-t align-top">
                      <td className="whitespace-nowrap p-2 font-mono font-semibold">{item.number}</td>
                      <td className="whitespace-nowrap p-2">{formatDay(item.createdAt)}</td>
                      <td className="p-2">{item.supplierName ?? "—"}</td>
                      <td className="whitespace-nowrap p-2 font-mono">{item.purchaseOrderNumber ?? "—"}</td>
                      <td className="p-2">
                        {item.lines.map((line) => (
                          <div key={line.id}>
                            {line.quantity} × {line.productName ?? line.sku ?? "Producto"}
                          </div>
                        ))}
                      </td>
                      <td className="p-2 text-muted-foreground">{item.reason || "—"}</td>
                      <td className="whitespace-nowrap p-2 text-right">
                        <Money value={item.total} />
                      </td>
                      <td className="whitespace-nowrap p-2 font-mono">{item.creditNoteNumber || "—"}</td>
                      <td className="p-2">
                        <ReturnStatusBadge status={item.status} />
                      </td>
                      <td className="whitespace-nowrap p-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button type="button" size="sm" variant="outline" aria-label={`PDF de la devolución ${item.number}`} title="PDF de la devolución" onClick={() => printReturn(item)}>
                            <FileText className="h-4 w-4" />
                          </Button>
                          {access.canWrite && item.status === "borrador" ? (
                            <Button type="button" size="sm" onClick={() => setAction({ kind: "send", item })}>
                              Marcar enviada
                            </Button>
                          ) : null}
                          {access.canWrite && item.status === "enviada" ? (
                            <Button type="button" size="sm" onClick={() => setAction({ kind: "credit-note", item })}>
                              Registrar nota de crédito
                            </Button>
                          ) : null}
                          {access.canAdmin && (item.status === "borrador" || item.status === "enviada") ? (
                            <Button type="button" size="sm" variant="destructive" onClick={() => setAction({ kind: "cancel", item })}>
                              Anular
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {pickOrder ? (
        <PickReceivedOrderDialog
          companyId={companyId}
          onClose={() => setPickOrder(false)}
          onPick={(order) => {
            setPickOrder(false);
            setNewFor(order);
          }}
        />
      ) : null}
      {newFor ? (
        <SupplierReturnFormDialog
          order={newFor}
          onClose={() => setNewFor(null)}
          onCreated={() => {
            refresh();
            setNewFor(null);
          }}
        />
      ) : null}
      {action ? (
        <ReturnActionDialog
          kind={action.kind}
          item={action.item}
          onClose={() => setAction(null)}
          onDone={() => {
            refresh();
            setAction(null);
          }}
        />
      ) : null}
    </div>
  );
}

/** Elegir de qué compra recibida sale la devolución. */
function PickReceivedOrderDialog({
  companyId,
  onClose,
  onPick,
}: {
  companyId: string;
  onClose: () => void;
  onPick: (order: PurchaseOrder) => void;
}) {
  const [orderId, setOrderId] = useState("");
  const ordersQuery = useQuery({
    queryKey: ["purchase-orders", companyId, "returnable"],
    queryFn: async ({ signal }) => {
      const [received, partial] = await Promise.all([
        listPurchaseOrders({ status: "RECIBIDA", limit: 100 }, signal),
        listPurchaseOrders({ status: "RECIBIDA_PARCIAL", limit: 100 }, signal),
      ]);
      return [...partial.items, ...received.items].filter(canReturnOrder);
    },
    enabled: !!companyId,
    retry: false,
  });
  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);
  const chosen = orders.find((order) => order.id === orderId);

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva devolución a proveedor</DialogTitle>
          <DialogDescription>Elige la compra recibida de la que vuelve el producto.</DialogDescription>
        </DialogHeader>
        {ordersQuery.error ? (
          <p role="alert" className="text-sm text-destructive">
            {warehouseErrorMessage(ordersQuery.error, "No se pudieron cargar las compras recibidas.")}
          </p>
        ) : null}
        <div className="space-y-1">
          <Label htmlFor="return-order">Compra</Label>
          <select id="return-order" className={SELECT_CLASS} value={orderId} onChange={(e) => setOrderId(e.target.value)}>
            <option value="">{ordersQuery.isLoading ? "Cargando…" : orders.length ? "Elige la compra" : "No hay compras recibidas para devolver"}</option>
            {orders.map((order) => (
              <option key={order.id} value={order.id}>
                {order.number} · {order.supplierName ?? "Proveedor"} · {formatDay(order.purchaseDate ?? order.createdAt)}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">Las compras con IMEI/serie no se devuelven desde aquí.</p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" disabled={!chosen} onClick={() => chosen && onPick(chosen)}>
            Continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ACTION_TEXT: Record<ReturnAction, { title: string; description: string; button: string; done: string }> = {
  send: {
    title: "Marcar como enviada",
    description: "El producto sale del stock ahora y la devolución queda esperando la nota de crédito.",
    button: "Marcar enviada",
    done: "enviada",
  },
  "credit-note": {
    title: "Registrar nota de crédito",
    description: "Escribe la serie y número de la nota de crédito del proveedor. Se descuenta de lo que se le debe.",
    button: "Registrar",
    done: "con nota de crédito",
  },
  cancel: {
    title: "Anular devolución",
    description: "Si ya se envió, el producto vuelve a entrar al stock. Con nota de crédito ya no se anula.",
    button: "Anular devolución",
    done: "anulada",
  },
};

function ReturnActionDialog({
  kind,
  item,
  onClose,
  onDone,
}: {
  kind: ReturnAction;
  item: SupplierReturn;
  onClose: () => void;
  onDone: () => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const copy = ACTION_TEXT[kind];
  const run = useMutation({
    mutationFn: () => {
      if (kind === "send") return sendSupplierReturn(item.id);
      if (kind === "credit-note") return registerCreditNote(item.id, text.trim());
      return cancelSupplierReturn(item.id, text.trim() || undefined);
    },
    onSuccess: () => {
      toast.success(`${item.number} ${copy.done}`);
      onDone();
    },
    // FEAT-24 H10-D6: 423 si la devolución tiene fecha en un mes cerrado.
    onError: (failure) => setError(periodLockedMessage(failure) ?? warehouseErrorMessage(failure, "No se pudo completar. Inténtalo de nuevo.")),
  });
  const busy = run.isPending;
  const valid = kind !== "credit-note" || (text.trim().length > 0 && text.trim().length <= 50);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {copy.title} · {item.number}
          </DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        {kind === "credit-note" ? (
          <div className="space-y-1">
            <Label htmlFor="credit-note-number">Nota de crédito</Label>
            <Input
              id="credit-note-number"
              className="font-mono"
              placeholder="FC01-000123"
              maxLength={50}
              value={text}
              disabled={busy}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        ) : null}
        {kind === "cancel" ? (
          <div className="space-y-1">
            <Label htmlFor="return-cancel-reason">Motivo (opcional)</Label>
            <Textarea id="return-cancel-reason" maxLength={500} value={text} disabled={busy} onChange={(e) => setText(e.target.value)} />
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant={kind === "cancel" ? "destructive" : "default"} disabled={!valid || busy} onClick={() => run.mutate()}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {copy.button}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
