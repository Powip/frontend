"use client";

import { useState } from "react";
import type { OrderHeader } from "@/interfaces/IOrder";
import { Button } from "@/components/ui/button";
import { hasKnownUnitTracking } from "@/services/saleUnitLifecycleService";
import type { SaleUnitLifecycleAction } from "@/services/saleUnitLifecycleService";
import SaleUnitLifecycleModal from "./SaleUnitLifecycleModal";

export function SaleUnitLifecycleButtons({
  order,
  onAction,
}: {
  order: OrderHeader;
  onAction: (action: SaleUnitLifecycleAction) => void;
}) {
  if (!hasKnownUnitTracking(order)) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {order.status === "EN_ENVIO" && (
        <Button type="button" variant="outline" onClick={() => onAction("return")}>
          Confirmar retorno físico
        </Button>
      )}
      {order.status === "ENTREGADO" && (
        <Button type="button" variant="outline" onClick={() => onAction("return")}>
          Devolver venta completa
        </Button>
      )}
      {order.status === "ANULADO" && (
        <Button type="button" variant="outline" onClick={() => onAction("reactivate")}>
          Reactivar con IMEI / series
        </Button>
      )}
    </div>
  );
}
export default function SaleUnitLifecycleActions({
  order,
  onUpdated,
}: {
  order: OrderHeader;
  onUpdated?: (order: OrderHeader) => void;
}) {
  const [action, setAction] = useState<SaleUnitLifecycleAction | null>(null);
  return (
    <>
      <SaleUnitLifecycleButtons order={order} onAction={setAction} />
      {action && (
        <SaleUnitLifecycleModal
          open
          orderId={order.id}
          action={action}
          onClose={() => setAction(null)}
          onUpdated={onUpdated}
        />
      )}
    </>
  );
}
