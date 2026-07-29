"use client";

import { useState, useCallback } from "react";
import axios from "axios";
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
  const { auth, selectedStoreId } = useAuth();
  const getUserInfo = useUserAuditInfo();
  const [orders, setOrders] = useState<OrderHeader[]>([]);
  const [loaded, setLoaded] = useState(false);

  const loadOrders = useCallback(async () => {
    if (!selectedStoreId) return;
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/store/${selectedStoreId}`,
      );
      const shippable = (res.data as OrderHeader[]).filter(
        (o) => o.deliveryType === "DOMICILIO" && SHIPPING_STATUSES.includes(o.status),
      );
      setOrders(shippable);
      setLoaded(true);
    } catch {
      toast.error("No se pudieron cargar los pedidos para escanear");
    }
  }, [selectedStoreId]);

  const handleOpenChange = (next: boolean) => {
    if (next && !loaded) loadOrders();
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
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: "EN_ENVIO" } : o)));
  };

  const handleConfirmDelivery = async (order: OrderHeader) => {
    await patchOrder(order.id, { status: "ENTREGADO" });
    setOrders((prev) =>
      prev.filter((o) => o.id !== order.id), // ya no aplica a "por confirmar en escáner"
    );
  };

  if (!auth) return null;

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
