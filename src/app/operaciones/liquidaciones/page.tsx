"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useOperationsRole, OPS_PERMISSIONS } from "@/contexts/OperationsRoleContext";
import { OrderHeader } from "@/interfaces/IOrder";
import { PorLiquidarTab } from "./_components/PorLiquidarTab";
import { SaldosClientesTab } from "./_components/SaldosClientesTab";
import { LiquidacionesTab } from "./_components/LiquidacionesTab";
import { RendicionRepartidorTab } from "./_components/RendicionRepartidorTab";
import { DiferenciasTab } from "./_components/DiferenciasTab";
import {
  MOCK_DIFERENCIAS,
  MOCK_LIQUIDACIONES,
  MOCK_RENDICIONES,
  MOCK_SALDOS_CLIENTES,
} from "./_components/mockData";
import { DiferenciaLiquidacion, PagoLiquidacion, RendicionRepartidor, SaldoCliente } from "./_components/types";
import { buildGuiasPorLiquidar } from "./_components/utils";
import { PowipPulseLoader } from "@/components/shared/PowipPulseLoader";

/* -----------------------------------------------------------------------
   Liquidaciones COD — pantalla admin-only del módulo Operaciones.
   Construida desde cero (no se retoma el prototipo mock de
   src/components/finanzas/LiquidacionesCourierTab.tsx — ver comentario al
   final de esta tarea). Único dato real de partida: OrderHeader vía
   GET /order-header/store/:storeId (usado en "Por Liquidar"). Todo lo
   demás vive en estado local de sesión — ver BACKEND GAP en
   _components/types.ts y el informe de brechas de backend.

   Query param: ?tab=porliq|saldos|registradas|rendicion|difs
------------------------------------------------------------------------ */

const TAB_VALUES = ["porliq", "saldos", "registradas", "rendicion", "difs"] as const;
type TabValue = (typeof TAB_VALUES)[number];

function isTabValue(v: string | null): v is TabValue {
  return !!v && (TAB_VALUES as readonly string[]).includes(v);
}

function LiquidacionesContent() {
  const { can } = useOperationsRole();
  const { selectedStoreId } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const hasAccess = can(OPS_PERMISSIONS.MANAGE_LIQUIDACIONES);

  const initialTab = isTabValue(searchParams.get("tab")) ? (searchParams.get("tab") as TabValue) : "porliq";
  const [tab, setTab] = useState<TabValue>(initialTab);

  const [orders, setOrders] = useState<OrderHeader[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  // Estado local de sesión — ver BACKEND GAP en el header de este archivo.
  const [liquidaciones, setLiquidaciones] = useState<PagoLiquidacion[]>(MOCK_LIQUIDACIONES);
  const [diferencias, setDiferencias] = useState<DiferenciaLiquidacion[]>(MOCK_DIFERENCIAS);
  const [rendiciones, setRendiciones] = useState<RendicionRepartidor[]>(MOCK_RENDICIONES);
  const [saldosClientes, setSaldosClientes] = useState<SaldoCliente[]>(MOCK_SALDOS_CLIENTES);

  const handleTabChange = (value: string) => {
    if (!isTabValue(value)) return;
    setTab(value);
    router.replace(`/operaciones/liquidaciones?tab=${value}`, { scroll: false });
  };

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

  // orderNumbers ya cubiertos por alguna liquidación registrada en esta
  // sesión (mock + lo que el usuario va registrando).
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
      const diferencia: DiferenciaLiquidacion = {
        id: `DIF-${Date.now()}`,
        pagoLiquidacionId: pago.id,
        courier: pago.courier,
        fecha: pago.fecha,
        pedidosIds: pago.pedidosIds,
        montoEsperado: pago.montoEsperado,
        montoDepositado: pago.montoDepositado,
        diferencia: pago.diferencia,
        estado: "ABIERTA",
      };
      setDiferencias((prev) => [diferencia, ...prev]);
      toast.warning(
        `Liquidación registrada con diferencia de ${pago.diferencia.toFixed(2)} — se agregó a Diferencias`,
      );
    } else {
      toast.success("Liquidación registrada y conciliada");
    }
  };

  const handleUpdateDiferencia = (diferencia: DiferenciaLiquidacion) => {
    setDiferencias((prev) => prev.map((d) => (d.id === diferencia.id ? diferencia : d)));
  };

  const handleRegistrarPagoCliente = (id: string, montoRecibido: number) => {
    setSaldosClientes((prev) =>
      prev
        .map((s) =>
          s.id === id
            ? { ...s, pagado: s.pagado + montoRecibido, saldo: Math.max(0, s.saldo - montoRecibido) }
            : s,
        )
        .filter((s) => s.saldo > 0),
    );
    toast.success("Pago registrado");
  };

  const handleRecordatorioEnviado = (ids: string[]) => {
    const idSet = new Set(ids);
    const hoy = new Date().toISOString().slice(0, 10);
    setSaldosClientes((prev) =>
      prev.map((s) =>
        idSet.has(s.id)
          ? { ...s, recordatoriosEnviados: s.recordatoriosEnviados + 1, ultimoRecordatorioAt: hoy }
          : s,
      ),
    );
  };

  const handleRegistrarRendicion = (rendicion: RendicionRepartidor) => {
    setRendiciones((prev) => {
      const exists = prev.some((r) => r.id === rendicion.id);
      if (exists) return prev.map((r) => (r.id === rendicion.id ? rendicion : r));
      return [rendicion, ...prev];
    });
    toast.success(
      rendicion.estado === "CUADRADO"
        ? "Rendición cuadrada correctamente"
        : "Rendición registrada con faltante",
    );
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

      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList className="h-auto w-full gap-1 bg-muted/60 p-1">
          <TabsTrigger value="porliq" className="flex-1 gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium sm:text-sm">
            Por Liquidar
          </TabsTrigger>
          <TabsTrigger value="saldos" className="flex-1 gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium sm:text-sm">
            Saldos clientes
          </TabsTrigger>
          <TabsTrigger value="registradas" className="flex-1 gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium sm:text-sm">
            Liquidaciones
          </TabsTrigger>
          <TabsTrigger value="rendicion" className="flex-1 gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium sm:text-sm">
            Rendición repartidor
          </TabsTrigger>
          <TabsTrigger value="difs" className="flex-1 gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium sm:text-sm">
            Diferencias
          </TabsTrigger>
        </TabsList>

        <TabsContent value="porliq" className="mt-4">
          {loadingOrders && orders.length === 0 ? (
            <LoadingGrid />
          ) : (
            <PorLiquidarTab
              guias={guiasPorLiquidar}
              loading={loadingOrders}
              onRegistrar={handleRegistrarLiquidacion}
            />
          )}
        </TabsContent>

        <TabsContent value="saldos" className="mt-4">
          <SaldosClientesTab
            saldos={saldosClientes}
            onRegistrarPago={handleRegistrarPagoCliente}
            onRecordatorioEnviado={handleRecordatorioEnviado}
          />
        </TabsContent>

        <TabsContent value="registradas" className="mt-4">
          <LiquidacionesTab liquidaciones={liquidaciones} />
        </TabsContent>

        <TabsContent value="rendicion" className="mt-4">
          <RendicionRepartidorTab rendiciones={rendiciones} onRegistrar={handleRegistrarRendicion} />
        </TabsContent>

        <TabsContent value="difs" className="mt-4">
          <DiferenciasTab
            diferencias={diferencias}
            liquidaciones={liquidaciones}
            onUpdate={handleUpdateDiferencia}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PageHeader() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">Liquidaciones COD</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Plata que los couriers cobraron en la entrega y todavía no depositaron, saldos por cobrar
        a clientes, histórico de depósitos, cuadre de caja de motorizados propios y diferencias
        por resolver.
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

export default function LiquidacionesPage() {
  return (
    <Suspense fallback={<PowipPulseLoader label="Cargando liquidaciones..." />}>
      <LiquidacionesContent />
    </Suspense>
  );
}
