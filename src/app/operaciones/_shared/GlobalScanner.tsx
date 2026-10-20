"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OperationsDataError } from "@/app/operaciones/_shared/OperationsDataError";
import { useBusinessOrders } from "@/hooks/useBusinessOrders";

import axios from "@/lib/axiosAuth";
import { toast } from "sonner";
import ScannerSheet from "@/app/centro-envios/components/ScannerSheet";
import { OrderHeader } from "@/interfaces/IOrder";
import { useAuth } from "@/contexts/AuthContext";
import { useUserAuditInfo } from "@/hooks/useUserAuditInfo";
import { SHIPPING_STATUSES } from "@/utils/domain/operations-pedidos-tabs";
import { assignmentBlockReason, requiresAuthenticatedSaleMutation, saleMutationUrl } from "@/services/saleTrackingService";

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

  const patchOrder = async (order: OrderHeader, status: "EN_ENVIO" | "ENTREGADO") => {
    if (!auth) throw new Error("Inicia sesión para actualizar el pedido.");
    const blocked = assignmentBlockReason(order, status);
    if (blocked) {
      toast.error(blocked);
      throw new Error(blocked);
    }
    const response = await axios.patch<OrderHeader>(saleMutationUrl(process.env.NEXT_PUBLIC_API_VENTAS || "", order.id, order), {
      status,
      ...getUserInfo(),
    });
    await loadOrders();
    if (requiresAuthenticatedSaleMutation(order) && (
      response.data?.status !== status || assignmentBlockReason(response.data, status)
    )) {
      const message = "La operación está pendiente de confirmación de IMEI/series. Consulta la venta antes de volver a escanear.";
      toast.warning(message);
      // ScannerSheet sólo registra éxito cuando esta promesa se resuelve.
      throw new Error(message);
    }
  };

  const handleDispatch = async (order: OrderHeader) => {
    await patchOrder(order, "EN_ENVIO");
  };

  const handleConfirmDelivery = async (order: OrderHeader) => {
    await patchOrder(order, "ENTREGADO");
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
