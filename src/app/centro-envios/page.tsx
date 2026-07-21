"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Package,
  Truck,
  Building2,
  CheckCircle2,
  ScanLine,
  AlertTriangle,
  Ban,
  Link2,
  Eye,
  Send,
  RefreshCw,
  Repeat,
  SlidersHorizontal,
  Search,
} from "lucide-react";

import { HeaderConfig } from "@/components/header/HeaderConfig";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { OrderHeader, OrderStatus } from "@/interfaces/IOrder";
import { useAuth } from "@/contexts/AuthContext";
import { fetchCouriers } from "@/services/courierService";
import {
  SalesFilters,
  emptySalesFilters,
  applyFilters,
} from "@/components/ventas/SalesTableFilters";
import CreateGuideModal, {
  CreateGuideData,
} from "@/components/modals/CreateGuideModal";
import GuideDetailsModal from "@/components/modals/GuideDetailsModal";
import PaymentVerificationModal from "@/components/modals/PaymentVerificationModal";
import CourierTrackingView from "@/components/couriers/CourierTrackingView";
import ScannerSheet from "./components/ScannerSheet";
import FiltersSheet from "./components/FiltersSheet";
import ReassignDeliveryModal from "./components/ReassignDeliveryModal";
import ShipmentDetailModal from "./components/ShipmentDetailModal";
import IntroModal from "./components/IntroModal";
import type { CancellationReason } from "@/components/modals/CancellationModal";
import {
  ShipmentBadge,
  PaymentBadge,
  IntegrationBadge,
  daysSince,
  getPendingPayment,
  isFailedDelivery,
  isReassigned,
  hasSyncError,
} from "./components/shipmentUtils";

/* -----------------------------------------
   Helpers
----------------------------------------- */

const SHIPPING_STATUSES: OrderStatus[] = [
  "PREPARADO",
  "LLAMADO",
  "ASIGNADO_A_GUIA",
  "EN_ENVIO",
  "ENTREGADO",
];

type QuickFilter =
  | "all"
  | "porDespachar"
  | "enTransito"
  | "fallidos"
  | "reasignados"
  | "erroresShalom"
  | "agenciaPorVencer"
  | "porConfirmar"
  | "sinTracking";

type ViewFilter = "activos" | "hoy" | "provincias" | "mios";

interface ShipmentRow {
  id: string;
  orderNumber: string;
  clientName: string;
  phoneNumber: string;
  date: string;
  paymentMethod: string;
  pendingPayment: number;
  salesRegion: "LIMA" | "PROVINCIA";
  deliveryType: string;
  courier?: string | null;
  zone?: string;
  guideNumber?: string | null;
  externalSource?: string | null;
  raw: OrderHeader;
}

function toRow(order: OrderHeader): ShipmentRow {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    clientName: order.customer.fullName,
    phoneNumber: order.customer.phoneNumber || "",
    date: new Date(order.created_at).toLocaleDateString("es-AR"),
    paymentMethod: order.payments[0]?.paymentMethod || "—",
    pendingPayment: getPendingPayment(order),
    salesRegion: order.salesRegion,
    deliveryType: order.deliveryType.replace("_", " "),
    courier: order.courier,
    zone: order.customer.zone,
    guideNumber: order.guideNumber,
    externalSource: order.externalSource,
    raw: order,
  };
}

function getUserInfo(auth: ReturnType<typeof useAuth>["auth"]) {
  return {
    userId: auth?.user?.id,
    sellerName:
      [auth?.user?.name, auth?.user?.surname].filter(Boolean).join(" ") ||
      undefined,
  };
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

/* -----------------------------------------
   Page
----------------------------------------- */

export default function CentroEnviosPage() {
  const { auth, selectedStoreId } = useAuth();

  const [orders, setOrders] = useState<OrderHeader[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<SalesFilters>(emptySalesFilters);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [view, setView] = useState<ViewFilter>("activos");
  const tableRef = useRef<HTMLDivElement>(null);

  // Aplica un filtro de la Bandeja de Atención a la tabla: resetea vista y
  // filtros avanzados para que lo mostrado coincida con el conteo de la
  // tarjeta, y hace scroll hasta la tabla.
  const applyQuickFilter = (qf: QuickFilter) => {
    setView("activos");
    setFilters(emptySalesFilters);
    setQuickFilter(qf);
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const [scannerOpen, setScannerOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [viewOrderId, setViewOrderId] = useState<string | null>(null);
  const [createGuideOrder, setCreateGuideOrder] = useState<OrderHeader | null>(
    null,
  );
  const [isCreatingGuide, setIsCreatingGuide] = useState(false);
  const [guideDetailsOrderId, setGuideDetailsOrderId] = useState<string | null>(
    null,
  );
  const [reassignOrder, setReassignOrder] = useState<OrderHeader | null>(null);
  const [isReassignLoading, setIsReassignLoading] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState<{
    id: string;
    orderNumber: string;
  } | null>(null);
  const [apiCouriers, setApiCouriers] = useState<string[]>([]);

  useEffect(() => {
    if (!auth?.company?.id) return;
    fetchCouriers(auth.company.id)
      .then((data) => setApiCouriers(data.map((c) => c.name)))
      .catch(() => toast.error("No se pudieron cargar los couriers"));
  }, [auth?.company?.id]);

  const fetchOrders = useCallback(async () => {
    if (!selectedStoreId) return;
    setLoading(true);
    try {
      const res = await axios.get<OrderHeader[]>(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/store/${selectedStoreId}`,
      );
      setOrders(res.data);
    } catch (error) {
      console.error("Error fetching orders", error);
      toast.error("No se pudieron cargar los pedidos");
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const viewOrder = useMemo(
    () => orders.find((o) => o.id === viewOrderId) ?? null,
    [orders, viewOrderId],
  );

  const currentUserName = [auth?.user?.name, auth?.user?.surname]
    .filter(Boolean)
    .join(" ");

  // Pedidos de envío a domicilio relevantes para el centro de envíos
  const shipments = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.deliveryType === "DOMICILIO" &&
          SHIPPING_STATUSES.includes(o.status),
      ),
    [orders],
  );

  // Unión de couriers registrados (API) + nombres que aparezcan en pedidos
  // existentes (legacy/free-text) — mismo criterio que usa /operaciones.
  const availableCouriers = useMemo(() => {
    const fromShipments = shipments
      .map((o) => o.courier)
      .filter((c): c is string => !!c);
    return Array.from(new Set([...apiCouriers, ...fromShipments])).sort();
  }, [apiCouriers, shipments]);

  // KPIs
  const kpis = useMemo(() => {
    const porDespachar = shipments.filter(
      (o) => o.status !== "EN_ENVIO" && o.status !== "ENTREGADO",
    ).length;
    const enTransito = shipments.filter((o) => o.status === "EN_ENVIO").length;
    const enAgencia = shipments.filter(
      (o) => o.status === "EN_ENVIO" && o.shalomStatus === "EN_DESTINO",
    ).length;
    const porConfirmar = shipments.filter(
      (o) => o.shalomStatus === "ENTREGADO" && o.status !== "ENTREGADO",
    ).length;
    return { porDespachar, enTransito, enAgencia, porConfirmar };
  }, [shipments]);

  // Bandeja de atención
  const bandeja = useMemo(() => {
    const listosParaEscanear = shipments.filter(
      (o) =>
        o.guideNumber && o.status !== "EN_ENVIO" && o.status !== "ENTREGADO",
    );
    const erroresShalom = shipments.filter((o) => hasSyncError(o));
    const agenciaPorVencer = shipments.filter(
      (o) =>
        o.status === "EN_ENVIO" &&
        o.shalomStatus === "EN_DESTINO" &&
        daysSince(o.updated_at) >= 25,
    );
    const porConfirmar = shipments.filter(
      (o) => o.shalomStatus === "ENTREGADO" && o.status !== "ENTREGADO",
    );
    const fallidos = shipments.filter((o) => isFailedDelivery(o));
    const sinTracking = shipments.filter(
      (o) => !o.guideNumber && !o.externalTrackingNumber && !!o.externalSource,
    );
    return {
      listosParaEscanear,
      erroresShalom,
      agenciaPorVencer,
      porConfirmar,
      fallidos,
      sinTracking,
    };
  }, [shipments]);

  const filteredRows = useMemo(() => {
    let base = shipments;

    if (view === "activos") {
      base = base.filter((o) => o.status !== "ENTREGADO");
    } else if (view === "hoy") {
      base = base.filter((o) => isToday(o.created_at));
    } else if (view === "provincias") {
      base = base.filter((o) => o.salesRegion === "PROVINCIA");
    } else if (view === "mios") {
      base = base.filter((o) => o.sellerName === currentUserName);
    }

    if (quickFilter === "porDespachar") {
      base = base.filter(
        (o) => o.status !== "EN_ENVIO" && o.status !== "ENTREGADO",
      );
    } else if (quickFilter === "enTransito") {
      base = base.filter((o) => o.status === "EN_ENVIO");
    } else if (quickFilter === "fallidos") {
      base = base.filter((o) => isFailedDelivery(o));
    } else if (quickFilter === "reasignados") {
      base = base.filter((o) => isReassigned(o));
    } else if (quickFilter === "erroresShalom") {
      base = base.filter((o) => hasSyncError(o));
    } else if (quickFilter === "agenciaPorVencer") {
      base = base.filter(
        (o) =>
          o.status === "EN_ENVIO" &&
          o.shalomStatus === "EN_DESTINO" &&
          daysSince(o.updated_at) >= 25,
      );
    } else if (quickFilter === "porConfirmar") {
      base = base.filter(
        (o) => o.shalomStatus === "ENTREGADO" && o.status !== "ENTREGADO",
      );
    } else if (quickFilter === "sinTracking") {
      base = base.filter(
        (o) =>
          !o.guideNumber && !o.externalTrackingNumber && !!o.externalSource,
      );
    }
    return applyFilters(base.map(toRow), filters);
  }, [shipments, view, quickFilter, filters, currentUserName]);

  const reassignCandidates = useMemo(() => {
    if (!reassignOrder) return [];
    return shipments.filter(
      (o) =>
        o.id !== reassignOrder.id &&
        o.status === "PREPARADO" &&
        !o.guideNumber &&
        o.customer.district === reassignOrder.customer.district &&
        o.items.some((i) =>
          reassignOrder.items.some(
            (oi) => oi.productVariantId === i.productVariantId,
          ),
        ),
    );
  }, [shipments, reassignOrder]);

  /* ---------- Acciones ---------- */

  const patchOrder = async (
    orderId: string,
    payload: Record<string, unknown>,
  ) => {
    await axios.patch(
      `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`,
      { ...payload, ...getUserInfo(auth) },
    );
  };

  const handleDispatch = async (order: OrderHeader) => {
    await patchOrder(order.id, { status: "EN_ENVIO" });
    fetchOrders();
  };

  const handleConfirmDelivery = async (order: OrderHeader) => {
    await patchOrder(order.id, { status: "ENTREGADO" });
    fetchOrders();
  };

  const handleQuickConfirm = async (order: OrderHeader) => {
    try {
      await handleConfirmDelivery(order);
      toast.success(`Entrega confirmada · ${order.orderNumber}`);
    } catch {
      toast.error("No se pudo confirmar la entrega");
    }
  };

  const handleCreateGuide = async (guidesData: CreateGuideData[]) => {
    setIsCreatingGuide(true);
    try {
      for (const guideData of guidesData) {
        const guideResponse = await axios.post(
          `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides`,
          guideData,
        );
        const guideNumber = guideResponse.data.guideNumber;
        for (const orderId of guideData.orderIds) {
          await patchOrder(orderId, {
            guideNumber,
            status: "ASIGNADO_A_GUIA",
            courier: guideData.courierName,
            courierId: guideData.courierId || null,
          });
        }
      }
      toast.success("Guía creada · pedido listo para despacho");
      setCreateGuideOrder(null);
      fetchOrders();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Error creando guía");
    } finally {
      setIsCreatingGuide(false);
    }
  };

  const handleReprogram = async (orderId: string, callbackAt: Date) => {
    try {
      await patchOrder(orderId, {
        callStatus: "SCHEDULED",
        callbackAt: callbackAt.toISOString(),
      });
      toast.success("Pedido reprogramado");
      fetchOrders();
    } catch {
      toast.error("No se pudo reprogramar el pedido");
    }
  };

  const handleCancelOrder = async (
    orderId: string,
    reason: CancellationReason,
    notes?: string,
  ) => {
    try {
      await patchOrder(orderId, {
        status: "ANULADO",
        cancellationReason: reason,
        ...(notes ? { notes } : {}),
      });
      toast.success("Pedido anulado");
      fetchOrders();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "No se pudo anular el pedido",
      );
    }
  };

  const handleReassign = async (
    failedOrder: OrderHeader,
    candidate: OrderHeader,
  ) => {
    setIsReassignLoading(true);
    try {
      await patchOrder(failedOrder.id, {
        status: "ANULADO",
        cancellationReason: "DELIVERY_ISSUE",
        notes: `[REASIGNADO] Entrega reasignada a ${candidate.orderNumber}`,
      });
      await patchOrder(candidate.id, {
        guideNumber: failedOrder.guideNumber,
        courier: failedOrder.courier,
        courierId: failedOrder.courierId,
        status: "EN_ENVIO",
        notes: `[REASIGNADO] Recibe entrega de ${failedOrder.orderNumber}`,
      });
      const logPayload = (orderId: string, comentarios: string) =>
        axios.post(`${process.env.NEXT_PUBLIC_API_VENTAS}/log-ventas`, {
          orderId,
          comentarios,
          operacion: "COMMENT",
          userId: auth?.user?.id ?? null,
          userName: auth?.user?.email ?? null,
          data: {},
          isSystemGenerated: true,
        });
      await Promise.all([
        logPayload(
          failedOrder.id,
          `Reasignado a ${candidate.orderNumber} (${candidate.customer.fullName})`,
        ),
        logPayload(
          candidate.id,
          `Recibe entrega reasignada de ${failedOrder.orderNumber} (${failedOrder.customer.fullName}) · misma guía ${failedOrder.guideNumber ?? "—"}`,
        ),
      ]);
      toast.success(
        `Reasignado · ${candidate.orderNumber} continúa la entrega`,
      );
      fetchOrders();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "No se pudo reasignar el pedido",
      );
    } finally {
      setIsReassignLoading(false);
    }
  };

  const getPrimaryAction = (order: OrderHeader) => {
    // Pedido finalizado: el único destino válido es ANULADO (ver
    // ORDER_STATUS_FLOW), no ofrecemos acciones de despacho/guía aquí.
    if (order.status === "ENTREGADO") {
      return null;
    }
    if (isFailedDelivery(order)) {
      return {
        label: "Reprogramar / anular",
        icon: Repeat,
        className: "bg-purple-600 hover:bg-purple-700 text-white",
        onClick: () => setReassignOrder(order),
      };
    }
    if (!order.guideNumber) {
      return {
        label: "Crear guía",
        icon: Link2,
        className: "bg-primary text-primary-foreground hover:bg-primary/90",
        onClick: () => setCreateGuideOrder(order),
      };
    }
    if (order.courier === "Shalom" && hasSyncError(order)) {
      return {
        label: "Reintentar",
        icon: RefreshCw,
        className: "bg-red-600 hover:bg-red-700 text-white",
        onClick: () => setGuideDetailsOrderId(order.id),
      };
    }
    if (order.courier === "Shalom" && !order.shalomStatus) {
      return {
        label: "Registrar Shalom",
        icon: Send,
        className: "bg-primary text-primary-foreground hover:bg-primary/90",
        onClick: () => setGuideDetailsOrderId(order.id),
      };
    }
    if (order.status === "EN_ENVIO" && order.shalomStatus === "ENTREGADO") {
      return {
        label: "Confirmar",
        icon: CheckCircle2,
        className: "bg-green-600 hover:bg-green-700 text-white",
        onClick: () => handleQuickConfirm(order),
      };
    }
    return null;
  };

  const views: { value: ViewFilter; label: string }[] = [
    { value: "activos", label: "Activos" },
    { value: "hoy", label: "Hoy" },
    { value: "mios", label: "Mis pedidos" },
    { value: "provincias", label: "Provincias" },
  ];

  // El chip "Reasignados" queda oculto: depende del flujo de reasignación a
  // otro cliente, deshabilitado en ReassignDeliveryModal hasta que exista
  // soporte de backend (ver REASSIGN_TO_CUSTOMER_ENABLED).
  const chips: { value: QuickFilter; label: string }[] = [
    { value: "all", label: "Todos" },
    { value: "porDespachar", label: "Por despachar" },
    { value: "enTransito", label: "En tránsito" },
    { value: "fallidos", label: "Fallidos" },
  ];

  const quickFilterLabels: Record<QuickFilter, string> = {
    all: "Todos",
    porDespachar: "Por despachar",
    enTransito: "En tránsito",
    fallidos: "Fallidos",
    reasignados: "🔄 Reasignados",
    erroresShalom: "Errores de agencia",
    agenciaPorVencer: "Agencia por vencer",
    porConfirmar: "Por confirmar",
    sinTracking: "Sin tracking",
  };

  const activeFilterCount = Object.values(filters).filter(
    (v) => v !== "",
  ).length;

  return (
    <div className="pb-16">
      <IntroModal />
      <HeaderConfig
        title="Centro de Envíos"
        description="Seguimiento, despacho y escaneo — todo en un panel operativo."
      >
        <Button
          size="lg"
          className="bg-gradient-to-r from-violet-600 to-purple-700 text-white font-semibold shadow-lg shadow-purple-500/40 hover:shadow-purple-500/60 hover:from-violet-500 hover:to-purple-600 transition-shadow"
          onClick={() => setScannerOpen(true)}
        >
          <ScanLine className="h-5 w-5 mr-1.5" /> Escanear
        </Button>
      </HeaderConfig>

      <div className="px-4 md:px-6 space-y-6">
        {/* KPIs */}
        <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="transition-all duration-200 hover:shadow-md hover:-translate-y-1 border-muted">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Por despachar</p>
                  <h3 className="mt-2 text-3xl font-bold tracking-tight">
                    {kpis.porDespachar}
                  </h3>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Package className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="transition-all duration-200 hover:shadow-md hover:-translate-y-1 border-muted">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">En tránsito</p>
                  <h3 className="mt-2 text-3xl font-bold tracking-tight">
                    {kpis.enTransito}
                  </h3>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400">
                  <Truck className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="transition-all duration-200 hover:shadow-md hover:-translate-y-1 border-muted">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">En agencia</p>
                  <h3 className="mt-2 text-3xl font-bold tracking-tight">
                    {kpis.enAgencia}
                  </h3>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                  <Building2 className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="transition-all duration-200 hover:shadow-md hover:-translate-y-1 border-muted">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Por confirmar</p>
                  <h3 className="mt-2 text-3xl font-bold tracking-tight">
                    {kpis.porConfirmar}
                  </h3>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bandeja de atención */}
        <div>
          <h2 className="text-sm font-bold mb-3">Bandeja de Atención</h2>
          <TooltipProvider delayDuration={300}>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      applyQuickFilter("porDespachar");
                      setScannerOpen(true);
                    }}
                    className="flex items-start gap-3 text-left rounded-xl border-l-4 border-purple-500 bg-card p-3.5 hover:shadow-md transition-shadow"
                  >
                    <div className="h-9 w-9 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center flex-shrink-0">
                      <ScanLine className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold">
                        Listos para escanear
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {bandeja.listosParaEscanear.length} pedidos con guía
                        esperando despacho
                      </div>
                    </div>
                    <div className="text-xl font-black text-purple-600">
                      {bandeja.listosParaEscanear.length}
                    </div>
                  </button>
                </TooltipTrigger>
                <TooltipContent>Click para ver estos pedidos</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => applyQuickFilter("erroresShalom")}
                    className="flex items-start gap-3 text-left rounded-xl border-l-4 border-red-500 bg-card p-3.5 hover:shadow-md transition-shadow"
                  >
                    <div className="h-9 w-9 rounded-lg bg-red-100 text-red-700 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold">
                        Errores de agencia
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {bandeja.erroresShalom.length} registros con error de
                        courier
                      </div>
                    </div>
                    <div className="text-xl font-black text-red-600">
                      {bandeja.erroresShalom.length}
                    </div>
                  </button>
                </TooltipTrigger>
                <TooltipContent>Click para ver estos pedidos</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => applyQuickFilter("agenciaPorVencer")}
                    className="flex items-start gap-3 text-left rounded-xl border-l-4 border-amber-500 bg-card p-3.5 hover:shadow-md transition-shadow"
                  >
                    <div className="h-9 w-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold">
                        Agencia por vencer
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {bandeja.agenciaPorVencer.length} pedidos con +25 días
                        en agencia
                      </div>
                    </div>
                    <div className="text-xl font-black text-amber-600">
                      {bandeja.agenciaPorVencer.length}
                    </div>
                  </button>
                </TooltipTrigger>
                <TooltipContent>Click para ver estos pedidos</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => applyQuickFilter("porConfirmar")}
                    className="flex items-start gap-3 text-left rounded-xl border-l-4 border-green-500 bg-card p-3.5 hover:shadow-md transition-shadow"
                  >
                    <div className="h-9 w-9 rounded-lg bg-green-100 text-green-700 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold">Por confirmar</div>
                      <div className="text-xs text-muted-foreground">
                        {bandeja.porConfirmar.length} entregas por confirmar +
                        cobro
                      </div>
                    </div>
                    <div className="text-xl font-black text-green-600">
                      {bandeja.porConfirmar.length}
                    </div>
                  </button>
                </TooltipTrigger>
                <TooltipContent>Click para ver estos pedidos</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => applyQuickFilter("fallidos")}
                    className="flex items-start gap-3 text-left rounded-xl border-l-4 border-red-500 bg-card p-3.5 hover:shadow-md transition-shadow"
                  >
                    <div className="h-9 w-9 rounded-lg bg-red-100 text-red-700 flex items-center justify-center flex-shrink-0">
                      <Ban className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold">Fallidos</div>
                      <div className="text-xs text-muted-foreground">
                        {bandeja.fallidos.length} pedidos devueltos — reasignar
                      </div>
                    </div>
                    <div className="text-xl font-black text-red-600">
                      {bandeja.fallidos.length}
                    </div>
                  </button>
                </TooltipTrigger>
                <TooltipContent>Click para ver estos pedidos</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => applyQuickFilter("sinTracking")}
                    className="flex items-start gap-3 text-left rounded-xl border-l-4 border-blue-500 bg-card p-3.5 hover:shadow-md transition-shadow"
                  >
                    <div className="h-9 w-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
                      <Link2 className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold">Sin tracking</div>
                      <div className="text-xs text-muted-foreground">
                        {bandeja.sinTracking.length} pedidos externos sin guía
                        vinculada
                      </div>
                    </div>
                    <div className="text-xl font-black text-blue-600">
                      {bandeja.sinTracking.length}
                    </div>
                  </button>
                </TooltipTrigger>
                <TooltipContent>Click para ver estos pedidos</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>

        {/* Búsqueda + filtros avanzados */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              placeholder="Buscar por cliente, teléfono, N° orden o guía…"
              value={filters.search}
              onChange={(e) =>
                setFilters({ ...filters, search: e.target.value })
              }
              className="w-full h-10 rounded-lg border border-input bg-card shadow-sm pl-10 pr-3.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            />
          </div>
          <Button variant="outline" onClick={() => setFiltersOpen(true)}>
            <SlidersHorizontal className="h-4 w-4 mr-1.5" /> Filtros avanzados
            {activeFilterCount > 0 && (
              <span className="ml-1.5 bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>

        {/* Tabla principal */}
        <div ref={tableRef}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-1 bg-muted p-1 rounded-lg mb-3 w-full sm:w-fit overflow-x-auto">
                {views.map((v) => (
                  <button
                    key={v.value}
                    onClick={() => setView(v.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap flex-shrink-0",
                      view === v.value
                        ? "bg-background shadow-sm text-primary"
                        : "text-muted-foreground",
                    )}
                  >
                    {v.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 flex-wrap mb-3">
                {chips.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setQuickFilter(c.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
                      quickFilter === c.value
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/30",
                    )}
                  >
                    {c.label}
                  </button>
                ))}
                <div className="flex-1" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchOrders}
                  disabled={loading}
                >
                  <RefreshCw
                    className={cn(
                      "h-3.5 w-3.5 mr-1.5",
                      loading && "animate-spin",
                    )}
                  />
                  Actualizar
                </Button>
              </div>

              {quickFilter !== "all" && (
                <div className="flex items-center gap-2 mb-3 text-xs">
                  <span className="text-muted-foreground">Filtrando por:</span>
                  <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary font-semibold rounded-full px-2.5 py-1">
                    {quickFilterLabels[quickFilter]}
                    <button
                      onClick={() => setQuickFilter("all")}
                      className="hover:opacity-70"
                      title="Quitar filtro"
                    >
                      ✕
                    </button>
                  </span>
                  <span className="text-muted-foreground">
                    {filteredRows.length} resultado
                    {filteredRows.length === 1 ? "" : "s"}
                  </span>
                </div>
              )}

              {/* Desktop/tablet: tabla completa */}
              <div className="hidden md:block overflow-x-auto border rounded-md">
                <Table className="min-w-[1100px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>N° Orden</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Zona / Courier</TableHead>
                      <TableHead>Envío</TableHead>
                      <TableHead>Cobro</TableHead>
                      <TableHead>Integración</TableHead>
                      <TableHead>Días</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="text-center text-sm text-muted-foreground py-8"
                        >
                          {loading
                            ? "Cargando pedidos…"
                            : "No hay pedidos para este filtro"}
                        </TableCell>
                      </TableRow>
                    )}
                    {filteredRows.map((row) => {
                      const order = row.raw;
                      const action = getPrimaryAction(order);
                      return (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium text-xs">
                            <div className="flex items-center gap-1">
                              {isFailedDelivery(order) && (
                                <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                              )}
                              {row.orderNumber}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono">
                              {order.guideNumber || "sin guía"}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="font-semibold">
                              {row.clientName}
                            </div>
                            <div className="text-muted-foreground">
                              {order.customer.district} · {row.phoneNumber}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="font-semibold">
                              {order.salesRegion === "LIMA"
                                ? "Lima"
                                : "Provincia"}
                            </div>
                            <div className="text-muted-foreground">
                              {row.courier || "—"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <ShipmentBadge order={order} />
                          </TableCell>
                          <TableCell>
                            <PaymentBadge order={order} />
                          </TableCell>
                          <TableCell>
                            <IntegrationBadge order={order} />
                          </TableCell>
                          <TableCell className="text-xs font-semibold">
                            {daysSince(order.updated_at)}d
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {action && (
                                <Button
                                  size="sm"
                                  className={cn(
                                    "h-8 text-xs",
                                    action.className,
                                  )}
                                  onClick={action.onClick}
                                >
                                  <action.icon className="h-3.5 w-3.5 mr-1" />
                                  {action.label}
                                </Button>
                              )}
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8"
                                onClick={() => setViewOrderId(order.id)}
                                title="Ver pedido"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: lista de tarjetas simplificada (foco en escaneo/uso con una mano) */}
              <div className="md:hidden border rounded-md divide-y">
                {filteredRows.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    {loading
                      ? "Cargando pedidos…"
                      : "No hay pedidos para este filtro"}
                  </div>
                )}
                {filteredRows.map((row) => {
                  const order = row.raw;
                  const action = getPrimaryAction(order);
                  return (
                    <div key={row.id} className="p-3.5 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          className="text-left min-w-0"
                          onClick={() => setViewOrderId(order.id)}
                        >
                          <div className="flex items-center gap-1.5 font-semibold text-sm">
                            {isFailedDelivery(order) && (
                              <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                            )}
                            <span className="truncate">{row.orderNumber}</span>
                          </div>
                          <div className="text-xs text-muted-foreground font-mono truncate">
                            {order.guideNumber || "sin guía"}
                          </div>
                        </button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-9 w-9 flex-shrink-0"
                          onClick={() => setViewOrderId(order.id)}
                          title="Ver pedido"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="text-sm">
                        <div className="font-medium truncate">
                          {row.clientName}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {order.customer.district} · {row.phoneNumber}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        <ShipmentBadge order={order} />
                        <PaymentBadge order={order} />
                        <IntegrationBadge order={order} />
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{row.courier || "sin courier"}</span>
                        <span>{daysSince(order.updated_at)}d</span>
                      </div>

                      {action && (
                        <Button
                          size="sm"
                          className={cn("w-full text-sm h-9", action.className)}
                          onClick={action.onClick}
                        >
                          <action.icon className="h-4 w-4 mr-1.5" />
                          {action.label}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Seguimiento detallado por courier */}
        <div>
          <h2 className="text-sm font-bold mb-3">
            Seguimiento detallado por courier
          </h2>
          <CourierTrackingView />
        </div>
      </div>

      {/* Modales y drawers */}
      <ScannerSheet
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        orders={shipments}
        onDispatch={handleDispatch}
        onConfirmDelivery={handleConfirmDelivery}
      />

      <FiltersSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={filters}
        onFiltersChange={setFilters}
        availableCouriers={availableCouriers}
      />

      <ShipmentDetailModal
        open={!!viewOrderId}
        order={viewOrder}
        onClose={() => setViewOrderId(null)}
        onOrderUpdated={fetchOrders}
        onOpenGuideDetails={(orderId) => setGuideDetailsOrderId(orderId)}
        onOpenReassign={(order) => setReassignOrder(order)}
        onOpenPayment={(id, orderNumber) =>
          setPaymentOrder({ id, orderNumber })
        }
        onOpenCreateGuide={(order) => setCreateGuideOrder(order)}
      />

      {createGuideOrder && (
        <CreateGuideModal
          open={!!createGuideOrder}
          onClose={() => setCreateGuideOrder(null)}
          storeId={selectedStoreId || ""}
          isLoading={isCreatingGuide}
          selectedOrders={[
            {
              id: createGuideOrder.id,
              orderNumber: createGuideOrder.orderNumber,
              clientName: createGuideOrder.customer.fullName,
              address: createGuideOrder.customer.address,
              district: createGuideOrder.customer.district,
              total: Number(createGuideOrder.grandTotal),
              pendingPayment: getPendingPayment(createGuideOrder),
              zone: createGuideOrder.customer.zone,
            },
          ]}
          onConfirm={handleCreateGuide}
        />
      )}

      {guideDetailsOrderId && (
        <GuideDetailsModal
          open={!!guideDetailsOrderId}
          onClose={() => setGuideDetailsOrderId(null)}
          orderId={guideDetailsOrderId}
          isCourierView={false}
          onGuideUpdated={fetchOrders}
        />
      )}

      {paymentOrder && (
        <PaymentVerificationModal
          open={!!paymentOrder}
          onClose={() => setPaymentOrder(null)}
          orderId={paymentOrder.id}
          orderNumber={paymentOrder.orderNumber}
          onPaymentUpdated={fetchOrders}
          canApprove
        />
      )}

      <ReassignDeliveryModal
        open={!!reassignOrder}
        onClose={() => setReassignOrder(null)}
        order={reassignOrder}
        candidates={reassignCandidates}
        isLoading={isReassignLoading}
        onReprogram={handleReprogram}
        onCancelOrder={handleCancelOrder}
        onReassign={handleReassign}
      />
    </div>
  );
}
