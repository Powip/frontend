"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Eye, FileSpreadsheet, Info, Pencil, Plus, ScanBarcode } from "lucide-react";
import { toast } from "sonner";
import { HeaderConfig } from "@/components/header/HeaderConfig";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { warehouseErrorMessage } from "@/components/forms/warehouseUi";
import {
  canCancelOrder,
  canEditOrder,
  canReceiveOrder,
  formatDay,
  orderUnits,
  paymentText,
  PURCHASE_STATUS_LABEL,
  purchaseAccess,
} from "@/lib/purchaseOrders";
import {
  cancelPurchaseOrder,
  getPurchaseOrder,
  listPurchaseOrders,
  listPurchaseSuppliers,
  placePurchaseOrder,
  type PurchaseOrder,
  type PurchaseOrderStatus,
} from "@/services/purchasesService";
import { listWarehouses } from "@/services/warehousesService";
import CancelPurchaseDialog from "./CancelPurchaseDialog";
import CostImportDialog from "./CostImportDialog";
import { Money, PurchasesNav, PurchaseStatusBadge, SELECT_CLASS } from "./PurchaseBits";
import PurchaseOrderDetailDialog, { type PurchaseOrderAction } from "./PurchaseOrderDetailDialog";
import PurchaseOrderFormDialog from "./PurchaseOrderFormDialog";
import PurchasePaymentDialog from "./PurchasePaymentDialog";
import ReceivePurchaseOrderDialog from "./ReceivePurchaseOrderDialog";
import SupplierReturnFormDialog from "./SupplierReturnFormDialog";

// FEAT-24 H3-E — Compras › Órdenes de compra (mockup vOC). Lista las órdenes
// de compra y las compras directas de antes; desde aquí se crean, editan,
// emiten, reciben (en partes), se pagan, se anulan y se devuelven al
// proveedor. Los botones dependen del rol (H3-D6) y los montos se ocultan
// («••••») cuando la API no los manda.

const PAGE_SIZE = 20;

const STATUS_FILTERS: Array<{ value: "" | PurchaseOrderStatus; label: string }> = [
  { value: "", label: "Todos los estados" },
  { value: "BORRADOR", label: PURCHASE_STATUS_LABEL.BORRADOR },
  { value: "PEDIDA", label: PURCHASE_STATUS_LABEL.PEDIDA },
  { value: "RECIBIDA_PARCIAL", label: PURCHASE_STATUS_LABEL.RECIBIDA_PARCIAL },
  { value: "RECIBIDA", label: PURCHASE_STATUS_LABEL.RECIBIDA },
  { value: "ANULADA", label: PURCHASE_STATUS_LABEL.ANULADA },
];

type DialogState =
  | { kind: "form"; order: PurchaseOrder | null }
  | { kind: "detail"; order: PurchaseOrder }
  | { kind: "receive"; order: PurchaseOrder }
  | { kind: "cancel"; order: PurchaseOrder }
  | { kind: "payment"; order: PurchaseOrder }
  | { kind: "return"; order: PurchaseOrder }
  | { kind: "costs" }
  | null;

/** `initialOrderId` (FEAT-24 H13): abre el detalle de esa OC al entrar (los enlaces `/compras?oc=` del pedido sugerido). */
export default function PurchaseOrdersView({ initialOrderId }: { initialOrderId?: string } = {}) {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";
  const access = purchaseAccess(auth?.user);
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"" | PurchaseOrderStatus>("");
  const [supplierId, setSupplierId] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<DialogState>(null);
  const initialOpened = useRef(false);
  const initialOrderQuery = useQuery({
    queryKey: ["purchase-order", initialOrderId],
    queryFn: ({ signal }) => getPurchaseOrder(initialOrderId as string, signal),
    enabled: !!companyId && !!initialOrderId,
    retry: false,
  });
  useEffect(() => {
    if (initialOpened.current || !initialOrderQuery.data) return;
    initialOpened.current = true;
    setDialog({ kind: "detail", order: initialOrderQuery.data });
  }, [initialOrderQuery.data]);
  useEffect(() => {
    if (initialOpened.current || !initialOrderQuery.error) return;
    initialOpened.current = true;
    toast.error(warehouseErrorMessage(initialOrderQuery.error, "No se pudo abrir esa orden de compra."));
  }, [initialOrderQuery.error]);

  const ordersQuery = useQuery({
    queryKey: ["purchase-orders", companyId, status, supplierId, page],
    queryFn: ({ signal }) =>
      listPurchaseOrders({ status: status || undefined, supplierId: supplierId || undefined, page, limit: PAGE_SIZE }, signal),
    enabled: !!companyId,
    retry: false,
  });
  const suppliersQuery = useQuery({
    queryKey: ["purchase-suppliers", companyId, "all"],
    queryFn: ({ signal }) => listPurchaseSuppliers(true, signal),
    enabled: !!companyId,
  });
  const warehousesQuery = useQuery({
    queryKey: ["company-warehouses", companyId],
    queryFn: () => listWarehouses(),
    enabled: !!companyId,
  });
  const warehouseNames = useMemo(
    () => new Map((warehousesQuery.data?.warehouses ?? []).map((warehouse) => [warehouse.id, warehouse])),
    [warehousesQuery.data],
  );

  const refresh = (orderId?: string) => {
    void queryClient.invalidateQueries({ queryKey: ["purchase-orders", companyId] });
    void queryClient.invalidateQueries({ queryKey: ["purchase-suppliers", companyId] });
    if (orderId) void queryClient.invalidateQueries({ queryKey: ["purchase-order", orderId] });
  };

  const place = useMutation({
    mutationFn: (order: PurchaseOrder) => placePurchaseOrder(order.id),
    onSuccess: (placed) => {
      toast.success(`${placed.number} emitida`, { description: "Aparece para recibir cuando llegue la mercadería." });
      refresh(placed.id);
      setDialog((current) => (current?.kind === "detail" ? { kind: "detail", order: placed } : current));
    },
    onError: (error) => toast.error(warehouseErrorMessage(error, "No se pudo emitir la orden.")),
  });

  const act = (action: PurchaseOrderAction, order: PurchaseOrder) => {
    if (action === "place") place.mutate(order);
    else if (action === "edit") setDialog({ kind: "form", order });
    else if (action === "receive") setDialog({ kind: "receive", order });
    else if (action === "cancel") setDialog({ kind: "cancel", order });
    else if (action === "payment") setDialog({ kind: "payment", order });
    else if (action === "return") setDialog({ kind: "return", order });
  };

  const orders = ordersQuery.data?.items ?? [];
  const total = ordersQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const warehouseLabel = (id: string) => warehouseNames.get(id)?.name ?? "—";

  return (
    <div className="w-full px-4 pb-6 md:px-6">
      <HeaderConfig title="Compras" description="Órdenes de compra, recepción y costo de lo que compras" />
      <div className="mb-4">
        <PurchasesNav />
      </div>

      <div className="mb-4 flex gap-2 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          <strong className="text-foreground">Compras sin borrar:</strong> Borrador → Pedida → Recibida parcial → Recibida, o Anulada (con
          movimientos inversos). Se piden por variante y en la unidad de compra (ej. 2 cajas × 12 = 24 und). El costo se guarda sin IGV y
          los gastos de la compra se reparten en el costo. Cada recepción recalcula el costo promedio.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Órdenes de compra
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            {access.canAdmin ? (
              <Button type="button" variant="outline" onClick={() => setDialog({ kind: "costs" })}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Cargar costos por Excel
              </Button>
            ) : null}
            {access.canWrite ? (
              <Button asChild variant="outline">
                <Link href="/registrar-compra">
                  <ScanBarcode className="mr-2 h-4 w-4" />
                  Compra directa (IMEI/serie)
                </Link>
              </Button>
            ) : null}
            {access.canWrite ? (
              <Button type="button" onClick={() => setDialog({ kind: "form", order: null })}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva compra
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 md:flex-row">
            <select
              aria-label="Estado"
              className={`${SELECT_CLASS} md:w-56`}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as "" | PurchaseOrderStatus);
                setPage(1);
              }}
            >
              {STATUS_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Proveedor"
              className={`${SELECT_CLASS} md:w-72`}
              value={supplierId}
              onChange={(e) => {
                setSupplierId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos los proveedores</option>
              {(suppliersQuery.data ?? []).map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>

          {ordersQuery.error ? (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
              {warehouseErrorMessage(ordersQuery.error, "No se pudieron cargar las compras.")}
              <Button type="button" size="sm" variant="outline" onClick={() => void ordersQuery.refetch()}>
                Reintentar
              </Button>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="whitespace-nowrap p-2 text-left">Número</th>
                  <th className="whitespace-nowrap p-2 text-left">Fecha</th>
                  <th className="whitespace-nowrap p-2 text-left">Proveedor</th>
                  <th className="whitespace-nowrap p-2 text-left">Comprobante</th>
                  <th className="whitespace-nowrap p-2 text-left">Destino</th>
                  <th className="whitespace-nowrap p-2 text-right">Unidades</th>
                  <th className="whitespace-nowrap p-2 text-right">Total</th>
                  <th className="whitespace-nowrap p-2 text-left">Recepción</th>
                  <th className="whitespace-nowrap p-2 text-left">Pago</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {ordersQuery.isLoading ? (
                  [...Array(4)].map((_, index) => (
                    <tr key={index} className="border-t">
                      <td colSpan={10} className="p-2">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    </tr>
                  ))
                ) : orders.length === 0 ? (
                  // Con error de carga no se dice «todavía no hay»: el aviso de arriba ya explica qué pasó.
                  ordersQuery.error ? null : <tr>
                    <td colSpan={10} className="p-8 text-center text-muted-foreground">
                      {status || supplierId ? "No hay compras con esos filtros." : "Todavía no hay compras."}
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => {
                    const warehouse = warehouseNames.get(order.inventoryId);
                    return (
                      <tr key={order.id} className="border-t">
                        <td className="whitespace-nowrap p-2 font-mono font-semibold">{order.number}</td>
                        <td className="whitespace-nowrap p-2">{formatDay(order.purchaseDate ?? order.createdAt)}</td>
                        <td className="p-2">{order.supplierName ?? "—"}</td>
                        <td className="whitespace-nowrap p-2 font-mono text-xs">{order.document || "—"}</td>
                        <td className="p-2">
                          {warehouse?.name ?? "—"}
                          {warehouse?.type === "COURIER" ? (
                            <span className="ml-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-900 dark:bg-sky-950 dark:text-sky-200">
                              Directo a courier
                            </span>
                          ) : null}
                        </td>
                        <td className="p-2 text-right tabular-nums">{orderUnits(order)}</td>
                        <td className="whitespace-nowrap p-2 text-right" data-testid={`total-${order.id}`}>
                          <Money value={order.total} />
                        </td>
                        <td className="p-2">
                          <PurchaseStatusBadge status={order.status} />
                        </td>
                        <td className="whitespace-nowrap p-2 text-xs text-muted-foreground">{paymentText(order)}</td>
                        <td className="whitespace-nowrap p-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              title="Ver detalles"
                              aria-label={`Ver ${order.number}`}
                              onClick={() => setDialog({ kind: "detail", order })}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {access.canWrite && canEditOrder(order) ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                title="Editar"
                                aria-label={`Editar ${order.number}`}
                                onClick={() => setDialog({ kind: "form", order })}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            ) : null}
                            {access.canWrite && canReceiveOrder(order) ? (
                              <Button type="button" size="sm" onClick={() => setDialog({ kind: "receive", order })}>
                                Recibir
                              </Button>
                            ) : null}
                            {access.canAdmin && canCancelOrder(order) ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                title="Anular"
                                onClick={() => setDialog({ kind: "cancel", order })}
                              >
                                Anular
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {total > PAGE_SIZE ? (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={total}
              itemsPerPage={PAGE_SIZE}
              onPageChange={setPage}
              itemName="compras"
            />
          ) : null}
        </CardContent>
      </Card>

      {dialog?.kind === "form" ? (
        <PurchaseOrderFormDialog
          companyId={companyId}
          order={dialog.order}
          canSeeCosts={access.canSeeCosts}
          onClose={() => setDialog(null)}
          onSaved={(saved) => {
            refresh(saved.id);
            setDialog(null);
          }}
        />
      ) : null}
      {dialog?.kind === "detail" ? (
        <PurchaseOrderDetailDialog
          order={dialog.order}
          access={access}
          warehouseName={warehouseNames.get(dialog.order.inventoryId)?.name}
          placing={place.isPending}
          onAction={act}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === "receive" ? (
        <ReceivePurchaseOrderDialog
          order={dialog.order}
          companyId={companyId}
          warehouseName={warehouseLabel(dialog.order.inventoryId)}
          showCosts={access.canSeeCosts}
          onClose={() => setDialog(null)}
          onConflict={() => refresh(dialog.order.id)}
          onReceived={() => {
            refresh(dialog.order.id);
            setDialog(null);
          }}
        />
      ) : null}
      {dialog?.kind === "payment" ? (
        <PurchasePaymentDialog
          order={dialog.order}
          onClose={() => setDialog(null)}
          onSaved={(saved) => {
            refresh(saved.id);
            setDialog(null);
          }}
        />
      ) : null}
      {dialog?.kind === "return" ? (
        <SupplierReturnFormDialog
          order={dialog.order}
          onClose={() => setDialog(null)}
          onCreated={() => {
            refresh(dialog.order.id);
            void queryClient.invalidateQueries({ queryKey: ["supplier-returns", companyId] });
            setDialog(null);
          }}
        />
      ) : null}
      {dialog?.kind === "cancel" ? (
        <CancelPurchaseDialog
          open
          purchaseNumber={dialog.order.number}
          description={
            dialog.order.status === "BORRADOR" || dialog.order.status === "PEDIDA"
              ? "Todavía no se recibió nada: la orden solo queda anulada, con su motivo."
              : undefined
          }
          onClose={() => setDialog(null)}
          onConfirm={async (reason) => {
            const cancelled = await cancelPurchaseOrder(dialog.order.id, reason);
            toast.success("Compra anulada", { description: cancelled?.number ?? dialog.order.number });
            refresh(dialog.order.id);
            setDialog(null);
          }}
        />
      ) : null}
      {dialog?.kind === "costs" ? <CostImportDialog companyId={companyId} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}
