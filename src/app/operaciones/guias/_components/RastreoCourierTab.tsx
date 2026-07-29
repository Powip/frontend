"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { OrderHeader } from "@/interfaces/IOrder";
import CourierTrackingView from "@/components/couriers/CourierTrackingView";

/* -----------------------------------------------------------------------
   Rastreo Courier — monta CourierTrackingView tal cual (Shalom / Todos /
   Aliclik / EVA, lógica ya construida). Lo único propio de esta pestaña es
   el manejo del filtro rápido `qf=sin-tracking` que manda el Tablero desde
   la bandeja "Sin tracking": como CourierTrackingView no tiene un modo de
   filtrado por eso (son pedidos SIN guía, es decir fuera del universo de
   guías que consulta ese componente), se muestra un banner con esos
   pedidos por encima, en vez de forzar ese filtro dentro del componente
   compartido.
------------------------------------------------------------------------ */

export default function RastreoCourierTab({ qf }: { qf?: string }) {
  const { selectedStoreId } = useAuth();
  const [orders, setOrders] = useState<OrderHeader[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (qf !== "sin-tracking" || !selectedStoreId) return;
    axios
      .get(`${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/store/${selectedStoreId}`)
      .then((res) => setOrders(res.data ?? []))
      .catch(() => setOrders([]));
  }, [qf, selectedStoreId]);

  const sinTracking = useMemo(
    () => orders.filter((o) => !o.guideNumber && !o.externalTrackingNumber && !!o.externalSource),
    [orders],
  );

  const showBanner = qf === "sin-tracking" && !dismissed;

  return (
    <div className="space-y-4">
      {showBanner && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-500/30 dark:bg-blue-500/10">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-700 dark:text-blue-300" />
              <div>
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                  {sinTracking.length} pedido(s) externos sin guía ni tracking vinculado
                </p>
                <p className="text-xs text-blue-800/80 dark:text-blue-300/80">
                  Vienen de la bandeja &quot;Sin tracking&quot; del Tablero: pedidos importados de un canal
                  externo que todavía no tienen guía de Powip ni número de tracking del courier.
                </p>
              </div>
            </div>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setDismissed(true)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          {sinTracking.length > 0 && (
            <div className="mt-3 divide-y rounded-lg border bg-background text-xs">
              {sinTracking.slice(0, 20).map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
                  <span className="font-semibold">{o.orderNumber}</span>
                  <span className="truncate text-muted-foreground">{o.customer?.fullName}</span>
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {o.externalSource}
                  </Badge>
                </div>
              ))}
              {sinTracking.length > 20 && (
                <p className="px-3 py-1.5 text-muted-foreground">+{sinTracking.length - 20} más…</p>
              )}
            </div>
          )}
        </div>
      )}

      <CourierTrackingView />
    </div>
  );
}
