"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useOperationsRole, OPS_PERMISSIONS } from "@/contexts/OperationsRoleContext";
import { OrderHeader } from "@/interfaces/IOrder";
import { PorLiquidarTab } from "./_components/PorLiquidarTab";
import { PagoLiquidacion } from "./_components/types";
import { buildGuiasPorLiquidar } from "./_components/utils";

/* -----------------------------------------------------------------------
   Liquidaciones COD — pantalla admin-only del módulo Operaciones.
   Único dato real de partida: OrderHeader vía
   GET /order-header/store/:storeId. El resto de las pestañas que se habían
   armado con datos de prueba (Saldos clientes, Liquidaciones histórico,
   Rendición repartidor, Diferencias) se quitaron: no tenían ningún endpoint
   real detrás, ni siquiera parcial, y mostrar esos números como si fueran
   reales podía inducir a error. Ver BACKEND GAP en _components/types.ts.

   `liquidaciones` (registros de "Registrar liquidación" desde Por Liquidar)
   sigue viviendo en estado local de sesión — se pierde al recargar — porque
   tampoco existe un endpoint para persistirlo todavía, pero a diferencia de
   las pestañas quitadas, es una acción real que hace el usuario en esta
   sesión, no un dato inventado.
------------------------------------------------------------------------ */

export default function LiquidacionesPage() {
  const { can } = useOperationsRole();
  const { selectedStoreId } = useAuth();

  const hasAccess = can(OPS_PERMISSIONS.MANAGE_LIQUIDACIONES);

  const [orders, setOrders] = useState<OrderHeader[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [liquidaciones, setLiquidaciones] = useState<PagoLiquidacion[]>([]);

  const loadOrders = useCallback(async () => {
    if (!selectedStoreId || !hasAccess) return;
    setLoadingOrders(true);
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/store/${selectedStoreId}`,
      );
      setOrders(res.data ?? []);
    } catch {
      toast.error("No se pudieron cargar los pedidos para Liquidaciones");
    } finally {
      setLoadingOrders(false);
    }
  }, [selectedStoreId, hasAccess]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // orderNumbers ya cubiertos por alguna liquidación registrada en esta sesión.
  const coveredOrderNumbers = useMemo(() => {
    const set = new Set<string>();
    for (const l of liquidaciones) {
      for (const id of l.pedidosIds) set.add(id);
    }
    return set;
  }, [liquidaciones]);

  const guiasPorLiquidar = useMemo(
    () => buildGuiasPorLiquidar(orders, coveredOrderNumbers),
    [orders, coveredOrderNumbers],
  );

  const handleRegistrarLiquidacion = (pago: PagoLiquidacion) => {
    setLiquidaciones((prev) => [pago, ...prev]);
    if (pago.diferencia !== 0) {
      toast.warning(`Liquidación registrada con diferencia de ${pago.diferencia.toFixed(2)}`);
    } else {
      toast.success("Liquidación registrada y conciliada");
    }
  };

  if (!hasAccess) {
    return (
      <div className="space-y-4">
        <PageHeader />
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-card py-20 text-center shadow-sm">
          <ShieldAlert className="h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-bold">No tienes acceso a Liquidaciones</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Esta pantalla es solo para administradores. Si necesitas ver o registrar
            liquidaciones de courier, pide que un administrador te dé el permiso
            correspondiente.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader />

      {loadingOrders && orders.length === 0 ? (
        <LoadingGrid />
      ) : (
        <PorLiquidarTab
          guias={guiasPorLiquidar}
          loading={loadingOrders}
          onRegistrar={handleRegistrarLiquidacion}
        />
      )}
    </div>
  );
}

function PageHeader() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">Liquidaciones COD</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Plata que los couriers cobraron en la entrega y todavía no depositaron.
      </p>
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  );
}
