"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OperationsDataError } from "@/app/operaciones/_shared/OperationsDataError";
import { useBusinessOrders } from "@/hooks/useBusinessOrders";

import { useState, useCallback } from "react";
import axios from "@/lib/axiosAuth";
import { toast } from "sonner";
import ScannerSheet from "@/app/centro-envios/components/ScannerSheet";
import { OrderHeader } from "@/interfaces/IOrder";
import { useAuth } from "@/contexts/AuthContext";
import { useUserAuditInfo } from "@/hooks/useUserAuditInfo";
import { SHIPPING_STATUSES } from "@/utils/domain/operations-pedidos-tabs";

/**
 * El botón "📷 Escanear" del ribbon vive en el layout, disponible desde
 * cualquier pantalla del módulo (Tablero, Pedidos, Guías…), no solo desde
 * "Por Despachar" — igual que en el mockup. Reutiliza el mismo
 * `ScannerSheet` que ya tenía Centro de Envíos (3 modos: Despacho / Confirmar
 * entrega / Consultar), pero carga sus propios pedidos al abrirse en vez de
 * depender del estado de la página que esté montada.
 */
export function GlobalScanner({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { auth } = useAuth();
  const getUserInfo = useUserAuditInfo();
  const { orders: allOrders, loading, error, retry, refetch: loadOrders } = useBusinessOrders(undefined, undefined, { enabled: open });
  const orders = allOrders.filter((o) => o.deliveryType === "DOMICILIO" && SHIPPING_STATUSES.includes(o.status));

  // Recarga siempre al abrir — un pedido puede haber cambiado de estado (p.ej.
  // recién pasó a PREPARADO) o de tienda seleccionada desde la última vez que
  // se abrió el panel en esta misma página, y antes se quedaba con la lista
  // vieja hasta recargar la página completa.
  const handleOpenChange = (next: boolean) => {
    if (next) loadOrders();
    onOpenChange(next);
  };

  const patchOrder = async (orderId: string, data: Record<string, unknown>) => {
    await axios.patch(`${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`, {
      ...data,
      ...getUserInfo(),
    });
  };

  const handleDispatch = async (order: OrderHeader) => {
    await patchOrder(order.id, { status: "EN_ENVIO" });
    await loadOrders();
  };

  const handleConfirmDelivery = async (order: OrderHeader) => {
    await patchOrder(order.id, { status: "ENTREGADO" });
    await loadOrders();
  };

  if (!auth) return null;

  if (open && (loading || error)) return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent><DialogHeader><DialogTitle>Escanear pedidos</DialogTitle></DialogHeader>
        {error ? <OperationsDataError retry={retry} /> : <p role="status">Cargando pedidos…</p>}
      </DialogContent>
    </Dialog>
  );

  return (
    <ScannerSheet
      open={open}
      onOpenChange={handleOpenChange}
      orders={orders}
      onDispatch={handleDispatch}
      onConfirmDelivery={handleConfirmDelivery}
    />
  );
}
