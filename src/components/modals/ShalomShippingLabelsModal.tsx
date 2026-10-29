"use client";

import { useId, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { ShalomDocumentCard, type ShalomDocumentOrder } from "./ShalomDocumentModal";

interface ShalomShippingLabelsModalProps {
  open: boolean;
  onClose: () => void;
  orders: ShalomDocumentOrder[];
}

function ShippingLabelSelection({ orders }: { orders: ShalomDocumentOrder[] }) {
  const { auth } = useAuth();
  const selectId = useId();
  const [selectedOrderId, setSelectedOrderId] = useState(orders[0]?.id ?? "");
  const order = orders.find((item) => item.id === selectedOrderId) ?? orders[0];

  if (!order) {
    return <p className="p-4 text-sm text-muted-foreground">No hay pedidos para mostrar.</p>;
  }

  const documentKey = JSON.stringify([
    order.id, order.externalTrackingNumber, order.shippingCode,
    auth?.company?.id, auth?.user?.id, auth?.accessToken,
  ]);

  return (
    <div className="space-y-3">
      {orders.length > 1 ? (
        <div className="space-y-1.5">
          <label htmlFor={selectId} className="text-sm font-medium">Pedido</label>
          <select
            id={selectId}
            value={order.id}
            onChange={(event) => setSelectedOrderId(event.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {orders.map((item) => (
              <option key={item.id} value={item.id}>
                {item.orderNumber}{item.customer?.fullName ? ` · ${item.customer.fullName}` : ""}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Pedido {order.orderNumber}</p>
      )}
      <div className="h-[65vh] min-h-[440px]">
        <ShalomDocumentCard key={documentKey} order={order} initialTab="rotulo" />
      </div>
    </div>
  );
}

export default function ShalomShippingLabelsModal({ open, onClose, orders }: ShalomShippingLabelsModalProps) {
  const orderListKey = JSON.stringify(orders.map((order) => order.id));

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="sm:max-w-[620px] max-h-[95vh] overflow-y-auto">
        <DialogTitle>Etiqueta de envío Shalom</DialogTitle>
        {open && <ShippingLabelSelection key={orderListKey} orders={orders} />}
      </DialogContent>
    </Dialog>
  );
}
