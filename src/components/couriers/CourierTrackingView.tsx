"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { DateRange } from "react-day-picker";
import {
  Truck,
  Search,
  RefreshCw,
  FileText,
  Printer,
  Package,
  Clock,
  MapPin,
  AlertCircle,
  Calculator,
  ArrowRight,
  User,
  CheckCircle2,
  X,
  Eye,
  FileSpreadsheet,
  CalendarIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast } from "sonner";
import { 
  getShalomLabelPdfUrl, 
  getShalomTicketPdfUrl,
  quoteShalom,
  trackShalomGuide,
  updateGuideQuote
} from "@/services/shalomService";
import CustomerServiceModal from "@/components/modals/CustomerServiceModal";
import ShalomOrderTrackingView from "@/components/tracking/ShalomOrderTrackingView";
import AliclikOrderTrackingView from "@/components/tracking/AliclikOrderTrackingView";
import EvaOrderTrackingView from "@/components/tracking/EvaOrderTrackingView";
import { getPendingPayment } from "@/app/centro-envios/components/shipmentUtils";
import { fetchCouriers } from "@/services/courierService";
import { getEvaCredentials } from "@/services/evaService";
import { getAliclikCredentials } from "@/services/aliclikService";
import { OrderHeader } from "@/interfaces/IOrder";

function money(n: number): string {
  return `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// EVA/Aliclik/Shalom pueden despachar un pedido sin pasar por una guía
// propia (ver `allOrderRows`), así que `order.courier` puede venir vacío
// para esos casos — se completa con la integración detectada.
function courierLabel(order: OrderHeader): string {
  if (order.courier) return order.courier;
  if (order.evaStatus) return "EVA Courier";
  if (order.aliclikDispatchStatus) return "Aliclik";
  if (order.shalomStatus) return "Shalom";
  return "-";
}

function courierTabValue(courierName: string): string {
  return `courier-${courierName.toLowerCase().replace(/\s+/g, "-")}`;
}

function openDocument(url: string) {
  window.open(url, "_blank");
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const ITEMS_PER_PAGE = 15;

const TRACKING_FIELDS = [
  { key: "externalTrackingNumber", label: "Nro Tracking", placeholder: "Nro Tracking..." },
  { key: "shippingCode", label: "Código", placeholder: "Código..." },
  { key: "shippingOffice", label: "Oficina", placeholder: "Oficina..." },
  { key: "shippingKey", label: "Clave", placeholder: "Clave..." },
] as const;

type TrackingFieldKey = (typeof TRACKING_FIELDS)[number]["key"];

function trackingValuesOf(order: OrderHeader): Record<TrackingFieldKey, string> {
  return {
    externalTrackingNumber: order.externalTrackingNumber || "",
    shippingCode: order.shippingCode || "",
    shippingOffice: order.shippingOffice || "",
    shippingKey: order.shippingKey || "",
  };
}

/**
 * Campos de tracking manual (mismos 4 que "Información de Seguimiento" en
 * CustomerServiceModal) editables directo desde la fila de la tabla, para
 * couriers sin integración propia donde alguien tiene que tipear el
 * número/código/oficina/clave a mano. Autoguarda solo — sin botón: al salir
 * de cualquiera de los 4 campos (blur) guarda en un solo PATCH todos los que
 * hayan cambiado desde el último valor conocido.
 */
function TrackingInputCells({
  order,
  onSaved,
}: {
  order: OrderHeader;
  onSaved: () => void;
}) {
  const original = trackingValuesOf(order);
  const [values, setValues] = useState<Record<TrackingFieldKey, string>>(original);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValues(trackingValuesOf(order));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    order.id,
    order.externalTrackingNumber,
    order.shippingCode,
    order.shippingOffice,
    order.shippingKey,
  ]);

  const handleAutoSave = async () => {
    const dirty = TRACKING_FIELDS.some(({ key }) => values[key] !== original[key]);
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const payload: Partial<Record<TrackingFieldKey, string | null>> = {};
      TRACKING_FIELDS.forEach(({ key }) => {
        if (values[key] !== original[key]) payload[key] = values[key] || null;
      });
      await axios.patch(`${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${order.id}`, payload);
      toast.success("Tracking guardado");
      onSaved();
    } catch {
      toast.error("No se pudo guardar el tracking");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {TRACKING_FIELDS.map(({ key, placeholder }, i) => (
        <TableCell key={key} className="px-2 py-2">
          <div className="flex items-center gap-1">
            <Input
              placeholder={placeholder}
              value={values[key]}
              onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
              onBlur={handleAutoSave}
              className="h-7 w-24 text-[11px]"
            />
            {i === TRACKING_FIELDS.length - 1 && saving && (
              <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
            )}
          </div>
        </TableCell>
      ))}
    </>
  );
}

interface TrackingGuide {
  id: string;
  guideNumber: string;
  courierName: string;
  status: string;
  created_at: string;
  originAgencyName?: string;
  destinationAgencyName?: string;
  quotedAmount?: number;
  quotedCurrency?: string;
  orders: {
    id: string;
    orderNumber: string;
    customerName: string;
    trackingInfo?: {
      orderNumber: string;
      orderCode: string;
    };
  }[];
  externalGuideReference?: string;
  externalCarrierId?: string;
  shalomTrackingData?: any;
}

export default function CourierTrackingView() {
  const { auth, selectedStoreId } = useAuth();
  const [guides, setGuides] = useState<TrackingGuide[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCarrierTab, setActiveCarrierTab] = useState("todos");

  // Qué couriers/integraciones tiene realmente la empresa — las pestañas de
  // arriba solo deben mostrar los que están configurados, no una lista fija.
  const [hasShalom, setHasShalom] = useState(false);
  const [hasAliclik, setHasAliclik] = useState(false);
  const [hasEva, setHasEva] = useState(false);

  // Pedidos (ms-ventas) para la pestaña "Todos" — trae los datos de cliente,
  // saldo y costo de envío que la guía de ms-courier no tiene.
  const [orders, setOrders] = useState<OrderHeader[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [viewOrderId, setViewOrderId] = useState<string | null>(null);

  // Couriers reales de la empresa (no los que aparecen sueltos en pedidos
  // viejos/importados) — mismo servicio que usa el resto de Operaciones.
  const [companyCouriers, setCompanyCouriers] = useState<string[]>([]);
  const [courierFilter, setCourierFilter] = useState("ALL");
  const [saldoFilter, setSaldoFilter] = useState<"ALL" | "PENDING" | "PAID">("ALL");
  const [fechaRange, setFechaRange] = useState<DateRange | undefined>(undefined);
  const [fechaCalendarOpen, setFechaCalendarOpen] = useState(false);
  const [page, setPage] = useState(1);

  // Track State
  const [trackingModalOpen, setTrackingModalOpen] = useState(false);
  const [trackResult, setTrackResult] = useState<any>(null);
  const [trackLoading, setTrackLoading] = useState(false);
  const [selectedGuide, setSelectedGuide] = useState<TrackingGuide | null>(null);

  const fetchGuides = useCallback(async () => {
    if (!selectedStoreId || !auth?.accessToken) return;
    setLoading(true);
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/store/${selectedStoreId}`,
        {
          headers: { Authorization: `Bearer ${auth.accessToken}` }
        }
      );
      setGuides(res.data);
    } catch {
      toast.error("No se pudieron cargar las guías de envío");
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId, auth]);

  const fetchOrders = useCallback(async () => {
    if (!selectedStoreId) return;
    setOrdersLoading(true);
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/store/${selectedStoreId}`,
      );
      setOrders(res.data ?? []);
    } catch {
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    fetchGuides();
    fetchOrders();
  }, [fetchGuides, fetchOrders]);

  useEffect(() => {
    if (!auth?.company?.id) return;
    fetchCouriers(auth.company.id)
      .then((data) => {
        const names = data.map((c) => c.name);
        setCompanyCouriers(names);
        setHasShalom(names.some((n) => n.toLowerCase().includes("shalom")));
      })
      .catch(() => setCompanyCouriers([]));
  }, [auth?.company?.id]);

  useEffect(() => {
    if (!auth?.company?.id || !auth?.accessToken) return;
    const companyId = auth.company.id;
    const token = auth.accessToken;
    getEvaCredentials(token, companyId)
      .then((cred) => setHasEva(!!cred?.isActive))
      .catch(() => setHasEva(false));
    getAliclikCredentials(token, companyId)
      .then((cred) => setHasAliclik(!!cred?.isActive))
      .catch(() => setHasAliclik(false));
  }, [auth?.company?.id, auth?.accessToken]);

  // Couriers registrados en la cuenta (fetchCouriers) que no tienen una
  // integración con vista propia (Shalom sí la tiene) — cada uno de estos
  // recibe su propia pestaña genérica con la tabla de pedidos filtrada.
  const otherCouriers = useMemo(
    () => companyCouriers.filter((c) => !c.toLowerCase().includes("shalom")),
    [companyCouriers],
  );

  // Si la pestaña activa deja de estar disponible (el courier/integración no
  // está configurado), volver a "Todos" en vez de mostrar contenido vacío.
  useEffect(() => {
    if (activeCarrierTab === "shalom" && !hasShalom) setActiveCarrierTab("todos");
    if (activeCarrierTab === "aliclik" && !hasAliclik) setActiveCarrierTab("todos");
    if (
      activeCarrierTab.startsWith("courier-") &&
      !otherCouriers.some((c) => courierTabValue(c) === activeCarrierTab)
    ) {
      setActiveCarrierTab("todos");
    }
    if (activeCarrierTab === "eva" && !hasEva) setActiveCarrierTab("todos");
  }, [activeCarrierTab, hasShalom, hasAliclik, hasEva, otherCouriers]);

  // Fecha de despacho = cuándo se creó la guía en ms-courier (no existe un
  // campo propio en la orden) — se mapea por orderId a partir de `guides`.
  const dispatchDateByOrderId = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of guides) {
      for (const o of g.orders ?? []) map.set(o.id, g.created_at);
    }
    return map;
  }, [guides]);

  const dispatchedOrders = useMemo(
    () =>
      orders.filter(
        // "Despachado" no es solo tener guía interna (ms-courier): EVA,
        // Aliclik y Shalom pueden entregar sin pasar nunca por
        // /shipping-guides, así que un pedido cuenta como despachado si tiene
        // guía propia O quedó vinculado a cualquier integración de courier.
        (o) =>
          !!o.guideNumber ||
          !!o.evaStatus ||
          !!o.aliclikDispatchStatus ||
          !!o.shalomStatus ||
          !!o.externalTrackingNumber,
      ),
    [orders],
  );

  // El dropdown de filtro no puede depender solo de `companyCouriers`
  // (fetchCouriers): esos son los couriers registrados para guías propias,
  // y no incluye "EVA Courier"/"Aliclik"/"Shalom" cuando el pedido se
  // despachó por esas integraciones sin guía. Se arma con todos los
  // couriers que realmente aparecen en los pedidos despachados, más los
  // registrados (por si alguno no tiene pedidos todavía).
  const courierFilterOptions = useMemo(() => {
    const set = new Set<string>(companyCouriers);
    for (const o of dispatchedOrders) set.add(courierLabel(o));
    set.delete("-");
    return Array.from(set).sort();
  }, [companyCouriers, dispatchedOrders]);

  // Mismo criterio date-only que Por Liquidar/Pedidos — compara contra la
  // fecha de venta (`created_at`).
  const fechaDesde = fechaRange?.from ? dateKey(fechaRange.from) : "";
  const fechaHasta = fechaRange?.to
    ? dateKey(fechaRange.to)
    : fechaRange?.from
      ? dateKey(fechaRange.from)
      : "";

  const allOrderRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dispatchedOrders
      .filter(
        (o) => courierFilter === "ALL" || courierLabel(o) === courierFilter,
      )
      .filter((o) => {
        if (saldoFilter === "ALL") return true;
        const pending = getPendingPayment(o);
        return saldoFilter === "PENDING" ? pending > 0 : pending <= 0;
      })
      .filter((o) => {
        if (!fechaDesde && !fechaHasta) return true;
        const ventaDate = o.created_at ? o.created_at.slice(0, 10) : null;
        if (!ventaDate) return false;
        if (fechaDesde && ventaDate < fechaDesde) return false;
        if (fechaHasta && ventaDate > fechaHasta) return false;
        return true;
      })
      .filter(
        (o) =>
          !q ||
          o.orderNumber?.toLowerCase().includes(q) ||
          courierLabel(o).toLowerCase().includes(q) ||
          o.customer?.fullName?.toLowerCase().includes(q),
      )
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
  }, [dispatchedOrders, search, courierFilter, saldoFilter, fechaDesde, fechaHasta]);

  useEffect(() => {
    setPage(1);
  }, [search, courierFilter, saldoFilter, fechaDesde, fechaHasta]);

  const totalPages = Math.max(
    1,
    Math.ceil(allOrderRows.length / ITEMS_PER_PAGE),
  );
  const pagedOrderRows = allOrderRows.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );

  const handleTrackShalom = async (guide: TrackingGuide) => {
    if (!auth?.accessToken || !auth?.company?.id) return;
    
    setSelectedGuide(guide);
    setTrackingModalOpen(true);
    setTrackLoading(true);
    setTrackResult(null);

    try {
      const result = await trackShalomGuide(
        auth.accessToken,
        guide.id
      );
      setTrackResult(result);
    } catch (error) {
      setTrackResult({ error: "No se pudo obtener el rastreo de Shalom" });
    } finally {
      setTrackLoading(false);
    }
  };

  const handleQuoteDirectly = async (guide: TrackingGuide) => {
    if (!auth?.accessToken || !selectedStoreId) return;

    // Para cotizar necesitamos los detalles de la guía (agencia origen, destino, paquetes)
    // Pero el usuario dice que "la cotización debería de poderse calcular" si ya existe.
    // Vamos a obtener los detalles de la guía para tener los bultos reales.
    setLoading(true);
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/${guide.id}`,
        { headers: { Authorization: `Bearer ${auth.accessToken}` } }
      );
      const fullGuide = res.data;

      // Necesitamos al menos una orden para sacar los datos de bultos
      // O los datos guardados en la guía si los hubiera.
      // Como no tenemos un endpoint de "re-quote", vamos a simularlo obteniendo datos del primer pedido
      // o usando valores por defecto razonables si no están.
      
      // Fetch details of orders in guide to get package info
      const orderRes = await axios.get(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${fullGuide.orderIds[0]}/receipt`,
        { headers: { Authorization: `Bearer ${auth.accessToken}` } }
      );
      const order = orderRes.data;

      // Intentar reconstruir la cotización usando el payload guardado
      const shalomPayload = fullGuide.shalomRequestPayload;
      const meta = shalomPayload?.meta;
      const shipments = Array.isArray(shalomPayload) 
        ? shalomPayload 
        : (shalomPayload?.shipments || []);
      const firstShipment = shipments[0];
      
      const h = Number(firstShipment?.height) || 10;
      const w = Number(firstShipment?.width) || 10;
      const l = Number(firstShipment?.length) || 15;

      const quoteData = {
        origin: meta?.originAgencyId || firstShipment?.origin || fullGuide.shippingOffice || "1",
        destination: meta?.orderDestinations?.[fullGuide.orderIds?.[0]] || firstShipment?.destination || order.shippingOffice || "1",
        content: firstShipment?.content || "MERCADERIA",
        // Heurística: si es >= 1, asumimos CM y dividimos por 100. Si es < 1, ya está en metros.
        height: h < 1 ? h : h / 100,
        width: w < 1 ? w : w / 100,
        length: l < 1 ? l : l / 100,
        weight: Number(firstShipment?.weight) || 1,
        quantity: Number(firstShipment?.quantity) || 1
      };

      const quoteRes = await quoteShalom(auth.accessToken, quoteData);
      
      if (quoteRes.precio) {
        await updateGuideQuote(auth.accessToken, guide.id, quoteRes.precio, quoteRes.moneda);
        toast.success(`Cotización actualizada: ${quoteRes.moneda} ${quoteRes.precio}`);
        fetchGuides(); // Recargar tabla
      }
    } catch {
      toast.error("No se pudo calcular la cotización automáticamente");
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (allOrderRows.length === 0) {
      toast.warning("No hay pedidos para exportar con los filtros aplicados");
      return;
    }
    const rows = allOrderRows.map((o) => {
      const despachoAt = dispatchDateByOrderId.get(o.id);
      return {
        "N° Pedido": o.orderNumber,
        "Fecha de venta": new Date(o.created_at).toLocaleDateString("es-PE"),
        Despacho: despachoAt ? new Date(despachoAt).toLocaleDateString("es-PE") : "-",
        Cliente: o.customer?.fullName || "-",
        Teléfono: o.customer?.phoneNumber || "-",
        Ciudad: o.customer?.city || "-",
        Distrito: o.customer?.district || "-",
        "Saldo de deuda": getPendingPayment(o),
        Courier: courierLabel(o),
        "Costo de envío": o.carrierShippingCost ? Number(o.carrierShippingCost) : 0,
        "Número de tracking": o.externalTrackingNumber || "-",
        "Código de envío": o.shippingCode || "-",
        Oficina: o.shippingOffice || "-",
        "Clave de envío": o.shippingKey || "-",
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rastreo Courier");
    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      `rastreo_courier_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeCarrierTab} onValueChange={setActiveCarrierTab} className="w-full">
        <TabsList className="flex h-auto w-full flex-wrap gap-1 mb-6">
          {hasShalom && <TabsTrigger value="shalom">Shalom</TabsTrigger>}
          <TabsTrigger value="todos">Todos</TabsTrigger>
          {hasAliclik && <TabsTrigger value="aliclik">Aliclik</TabsTrigger>}
          {hasEva && <TabsTrigger value="eva">EVA Courier</TabsTrigger>}
          {otherCouriers.map((c) => (
            <TabsTrigger key={c} value={courierTabValue(c)}>
              {c}
            </TabsTrigger>
          ))}
        </TabsList>

        {hasShalom && (
          <TabsContent value="shalom">
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-3 px-4">
                <CardTitle className="text-lg">Seguimiento Detallado Shalom</CardTitle>
                <CardDescription>Gestiona las órdenes de Shalom con información de rastreo granular.</CardDescription>
              </CardHeader>
              <CardContent>
                <ShalomOrderTrackingView />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {hasAliclik && (
          <TabsContent value="aliclik">
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-3 px-4">
                <CardTitle className="text-lg">Seguimiento Aliclik</CardTitle>
                <CardDescription>Gestiona los pedidos enviados a Aliclik con información de estado y cancelación.</CardDescription>
              </CardHeader>
              <CardContent>
                <AliclikOrderTrackingView />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {hasEva && (
          <TabsContent value="eva">
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-3 px-4">
                <CardTitle className="text-lg">Seguimiento EVA Courier</CardTitle>
                <CardDescription>Gestiona los pedidos enviados a EVA Courier con información de estado en tiempo real.</CardDescription>
              </CardHeader>
              <CardContent>
                <EvaOrderTrackingView />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {otherCouriers.map((c) => (
          <TabsContent key={c} value={courierTabValue(c)}>
            <CourierOrdersTab
              courierName={c}
              dispatchedOrders={dispatchedOrders}
              dispatchDateByOrderId={dispatchDateByOrderId}
              loading={ordersLoading}
              onRefresh={fetchOrders}
              onView={setViewOrderId}
            />
          </TabsContent>
        ))}

        <TabsContent value="todos">
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3 px-4">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <div>
                  <CardTitle className="text-lg">Todos los pedidos despachados</CardTitle>
                  <CardDescription>Un pedido por fila, de cualquier courier.</CardDescription>
                </div>
                <div className="text-muted-foreground text-xs font-medium bg-muted/50 px-2 py-1 rounded">
                  {allOrderRows.length} pedidos
                </div>
              </div>
              <div className="flex items-center gap-3 pt-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por pedido, cliente o courier..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-background"
                  />
                </div>
                <Select value={courierFilter} onValueChange={setCourierFilter}>
                  <SelectTrigger className="w-[190px] shrink-0 bg-background">
                    <SelectValue placeholder="Courier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos los couriers</SelectItem>
                    {courierFilterOptions.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={saldoFilter} onValueChange={(v) => setSaldoFilter(v as typeof saldoFilter)}>
                  <SelectTrigger className="w-[170px] shrink-0 bg-background">
                    <SelectValue placeholder="Saldo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Con y sin saldo</SelectItem>
                    <SelectItem value="PENDING">Con saldo</SelectItem>
                    <SelectItem value="PAID">Sin saldo</SelectItem>
                  </SelectContent>
                </Select>
                <Popover open={fechaCalendarOpen} onOpenChange={setFechaCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 gap-2 min-w-[190px] justify-start shrink-0 bg-background">
                      <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs">
                        {fechaRange?.from
                          ? `${fechaRange.from.toLocaleDateString("es-PE", { day: "2-digit", month: "short" })} – ${(
                              fechaRange.to ?? fechaRange.from
                            ).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })}`
                          : "Fecha de venta"}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={fechaRange}
                      onSelect={(r) => {
                        if (r?.from && !r.to) {
                          setFechaRange({ from: r.from, to: new Date() });
                          setFechaCalendarOpen(false);
                          return;
                        }
                        setFechaRange(r);
                        if (r?.from && r?.to) setFechaCalendarOpen(false);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {fechaRange?.from && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    title="Quitar filtro de fecha"
                    onClick={() => setFechaRange(undefined)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  onClick={() => {
                    fetchGuides();
                    fetchOrders();
                  }}
                  variant="outline"
                  size="sm"
                  className="gap-2 shrink-0"
                >
                  <RefreshCw className={ordersLoading || loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                  Actualizar
                </Button>
                <Button
                  onClick={handleExportExcel}
                  variant="outline"
                  size="sm"
                  className="gap-2 shrink-0"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Exportar Excel
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
               <div className="border-t border-border overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="font-semibold px-4 h-10 text-xs whitespace-nowrap">N° Pedido</TableHead>
                      <TableHead className="font-semibold px-4 h-10 text-xs text-center whitespace-nowrap">Fecha de venta</TableHead>
                      <TableHead className="font-semibold px-4 h-10 text-xs text-center whitespace-nowrap">Despacho</TableHead>
                      <TableHead className="font-semibold px-4 h-10 text-xs whitespace-nowrap">Cliente</TableHead>
                      <TableHead className="font-semibold px-4 h-10 text-xs whitespace-nowrap">Teléfono</TableHead>
                      <TableHead className="font-semibold px-4 h-10 text-xs whitespace-nowrap">Ciudad</TableHead>
                      <TableHead className="font-semibold px-4 h-10 text-xs whitespace-nowrap">Distrito</TableHead>
                      <TableHead className="font-semibold px-4 h-10 text-xs text-right whitespace-nowrap">Saldo de deuda</TableHead>
                      <TableHead className="font-semibold px-4 h-10 text-xs text-center whitespace-nowrap">Courier</TableHead>
                      <TableHead className="font-semibold px-4 h-10 text-xs text-right whitespace-nowrap">Costo de envío</TableHead>
                      {TRACKING_FIELDS.map((f) => (
                        <TableHead key={f.key} className="font-semibold px-2 h-10 text-xs whitespace-nowrap">
                          {f.label}
                        </TableHead>
                      ))}
                      <TableHead className="font-semibold px-4 h-10 text-right text-xs whitespace-nowrap">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ordersLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={15} className="h-16 animate-pulse bg-muted/10 px-4" />
                        </TableRow>
                      ))
                    ) : allOrderRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={15} className="h-32 text-center text-muted-foreground text-sm">
                          No hay pedidos despachados para mostrar.
                        </TableCell>
                      </TableRow>
                    ) : (
                      pagedOrderRows.map((order) => {
                        const despachoAt = dispatchDateByOrderId.get(order.id);
                        return (
                          <TableRow key={order.id} className="hover:bg-muted/40 transition-colors">
                            <TableCell className="font-medium px-4 py-3 text-xs whitespace-nowrap">
                              {order.orderNumber}
                            </TableCell>
                            <TableCell className="px-4 py-3 text-[10px] text-center whitespace-nowrap">
                              {new Date(order.created_at).toLocaleDateString("es-PE")}
                            </TableCell>
                            <TableCell className="px-4 py-3 text-[10px] text-center whitespace-nowrap">
                              {despachoAt ? new Date(despachoAt).toLocaleDateString("es-PE") : "-"}
                            </TableCell>
                            <TableCell className="px-4 py-3 text-xs">
                              {order.customer?.fullName || "-"}
                            </TableCell>
                            <TableCell className="px-4 py-3 text-xs whitespace-nowrap">
                              {order.customer?.phoneNumber || "-"}
                            </TableCell>
                            <TableCell className="px-4 py-3 text-xs whitespace-nowrap">
                              {order.customer?.city || "-"}
                            </TableCell>
                            <TableCell className="px-4 py-3 text-xs whitespace-nowrap">
                              {order.customer?.district || "-"}
                            </TableCell>
                            <TableCell className="px-4 py-3 text-xs text-right tabular-nums whitespace-nowrap">
                              {money(getPendingPayment(order))}
                            </TableCell>
                            <TableCell className="px-4 py-3 text-center">
                              <Badge variant="outline" className="text-[10px]">
                                {courierLabel(order)}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-4 py-3 text-xs text-right tabular-nums whitespace-nowrap">
                              {order.carrierShippingCost
                                ? money(Number(order.carrierShippingCost))
                                : "-"}
                            </TableCell>
                            <TrackingInputCells order={order} onSaved={fetchOrders} />
                            <TableCell className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0"
                                  title="Ver comprobante de entrega"
                                  disabled={!order.shippingProofUrl}
                                  onClick={() => openDocument(order.shippingProofUrl!)}
                                >
                                  <FileText className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0"
                                  title="Ver pedido"
                                  onClick={() => setViewOrderId(order.id)}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
               </div>
               <Pagination
                 currentPage={page}
                 totalPages={totalPages}
                 totalItems={allOrderRows.length}
                 itemsPerPage={ITEMS_PER_PAGE}
                 onPageChange={setPage}
                 itemName="pedidos"
               />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL DE TRACKING */}
      <Dialog open={trackingModalOpen} onOpenChange={setTrackingModalOpen}>
        <DialogContent className="max-w-xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              Tracking en Tiempo Real - Shalom
            </DialogTitle>
          </DialogHeader>

          {trackLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-4">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground animate-pulse">Consultando terminal de Shalom...</p>
            </div>
          ) : trackResult?.error ? (
            <div className="py-8 text-center text-destructive flex flex-col items-center gap-2">
              <AlertCircle className="h-10 w-10" />
              <p>{trackResult.error}</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* 1. RESUMEN DE ORDEN */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/30 p-3 rounded-xl border border-border">
                <div className="space-y-0.5">
                  <label className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Orden</label>
                  <p className="font-mono text-sm font-semibold">{trackResult?.search?.data?.numero_orden || "—"}</p>
                </div>
                <div className="space-y-0.5">
                  <label className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Código</label>
                  <p className="font-mono text-sm font-semibold">{trackResult?.search?.data?.codigo_orden || "—"}</p>
                </div>
                <div className="space-y-0.5">
                  <label className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Monto</label>
                  <p className="text-sm font-bold text-primary">S/ {trackResult?.search?.data?.monto || "0.00"}</p>
                </div>
                <div className="space-y-0.5">
                  <label className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Estado Actual</label>
                  <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                    {trackResult?.statuses?.message || "Registrado"}
                  </Badge>
                </div>
              </div>

              {/* 2. RUTA DE ENVÍO */}
              <div className="relative p-4 bg-muted/20 border border-border rounded-xl">
                 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 text-primary">
                        <MapPin className="h-4 w-4" />
                        <span className="text-xs font-bold uppercase">Origen</span>
                      </div>
                      <p className="text-sm font-bold">{trackResult?.search?.data?.origen?.nombre}</p>
                      <p className="text-[10px] text-muted-foreground italic">
                        {trackResult?.search?.data?.origen?.distrito}, {trackResult?.search?.data?.origen?.provincia}
                      </p>
                    </div>

                    <div className="hidden md:flex flex-col items-center px-4">
                      <ArrowRight className="h-5 w-5 text-muted-foreground/40" />
                      <span className="text-[9px] text-muted-foreground font-medium mt-1 uppercase">{trackResult?.search?.data?.tiempo_llegada}</span>
                    </div>

                    <div className="flex-1 space-y-1 text-right">
                      <div className="flex items-center gap-2 text-green-600 justify-end">
                        <span className="text-xs font-bold uppercase">Destino</span>
                        <MapPin className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-bold">{trackResult?.search?.data?.destino?.nombre}</p>
                      <p className="text-[10px] text-muted-foreground italic">
                        {trackResult?.search?.data?.destino?.distrito}, {trackResult?.search?.data?.destino?.provincia}
                      </p>
                    </div>
                 </div>
                 
                 <div className="mt-4 pt-3 border-t border-border flex justify-between text-[11px]">
                   <div className="flex items-center gap-1.5">
                     <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                     <span className="text-muted-foreground">Emisión:</span>
                     <span className="font-semibold">{trackResult?.search?.data?.fecha_emision?.split(' ')[0]}</span>
                   </div>
                   <div className="flex items-center gap-1.5">
                     <CheckCircle2 className={`h-3.5 w-3.5 ${trackResult?.search?.data?.entregado ? "text-green-500" : "text-amber-500"}`} />
                     <span className="font-semibold uppercase">{trackResult?.search?.data?.entregado ? "Entregado" : "En Camino"}</span>
                   </div>
                 </div>
              </div>

              {/* 3. PARTICIPANTES Y DETALLES */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted/40 rounded-xl border border-border space-y-2">
                   <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Remitente</span>
                   </div>
                   <div>
                     <p className="text-xs font-bold truncate">{trackResult?.search?.data?.remitente?.nombre}</p>
                     <p className="text-[10px] text-muted-foreground">{trackResult?.search?.data?.remitente?.documento}</p>
                   </div>
                </div>
                <div className="p-3 bg-muted/40 rounded-xl border border-border space-y-2">
                   <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Destinatario</span>
                   </div>
                   <div>
                     <p className="text-xs font-bold truncate">{trackResult?.search?.data?.destinatario?.nombre}</p>
                     <p className="text-[10px] text-muted-foreground">{trackResult?.search?.data?.destinatario?.documento}</p>
                   </div>
                </div>
              </div>

              {/* 4. TIMELINE DE ESTADOS SHALOM */}
              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Truck className="h-4 w-4 text-primary" /> Línea de Tiempo Shalom
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 relative pl-4 border-l-2 border-primary/20 ml-2">
                  {Object.entries(trackResult?.statuses?.data || {}).map(([key, value]: [string, any], idx) => {
                    const hasData = value && value.fecha;
                    return (
                      <div key={key} className="relative py-1">
                        <div className={`absolute -left-[23px] top-1.5 h-4 w-4 rounded-full border-2 border-background flex items-center justify-center ${hasData ? "bg-primary text-white" : "bg-muted text-muted-foreground/30"}`}>
                          {hasData && <CheckCircle2 className="h-2.5 w-2.5" />}
                        </div>
                        <div className="space-y-0.5">
                          <p className={`text-[11px] font-bold uppercase ${hasData ? "text-foreground" : "text-muted-foreground/50"}`}>
                            {key.replace('_', ' ')}
                          </p>
                          {hasData ? (
                            <p className="text-[10px] font-medium text-muted-foreground">{value.fecha}</p>
                          ) : (
                            <p className="text-[9px] italic text-muted-foreground/40">Pendiente</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button variant="outline" size="sm" onClick={() => setTrackingModalOpen(false)} className="gap-2">
                  <X className="h-4 w-4" /> Cerrar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL DE VER PEDIDO (pestaña "Todos") */}
      <CustomerServiceModal
        open={!!viewOrderId}
        orderId={viewOrderId || ""}
        onClose={() => setViewOrderId(null)}
        onOrderUpdated={fetchOrders}
        isOperaciones
        showTracking
      />
    </div>
  );
}

/* -----------------------------------------------------------------------
   Pestaña genérica por courier — para los couriers registrados en la
   cuenta (fetchCouriers) que no tienen una integración con vista propia
   (Shalom/Aliclik/EVA). Misma tabla que "Todos" pero ya acotada a un solo
   courier, así que no necesita el selector de courier.
------------------------------------------------------------------------ */
function CourierOrdersTab({
  courierName,
  dispatchedOrders,
  dispatchDateByOrderId,
  loading,
  onRefresh,
  onView,
}: {
  courierName: string;
  dispatchedOrders: OrderHeader[];
  dispatchDateByOrderId: Map<string, string>;
  loading: boolean;
  onRefresh: () => void;
  onView: (orderId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [saldoFilter, setSaldoFilter] = useState<"ALL" | "PENDING" | "PAID">("ALL");
  const [fechaRange, setFechaRange] = useState<DateRange | undefined>(undefined);
  const [fechaCalendarOpen, setFechaCalendarOpen] = useState(false);
  const [page, setPage] = useState(1);

  const fechaDesde = fechaRange?.from ? dateKey(fechaRange.from) : "";
  const fechaHasta = fechaRange?.to
    ? dateKey(fechaRange.to)
    : fechaRange?.from
      ? dateKey(fechaRange.from)
      : "";

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dispatchedOrders
      .filter((o) => courierLabel(o) === courierName)
      .filter((o) => {
        if (saldoFilter === "ALL") return true;
        const pending = getPendingPayment(o);
        return saldoFilter === "PENDING" ? pending > 0 : pending <= 0;
      })
      .filter((o) => {
        if (!fechaDesde && !fechaHasta) return true;
        const ventaDate = o.created_at ? o.created_at.slice(0, 10) : null;
        if (!ventaDate) return false;
        if (fechaDesde && ventaDate < fechaDesde) return false;
        if (fechaHasta && ventaDate > fechaHasta) return false;
        return true;
      })
      .filter(
        (o) =>
          !q ||
          o.orderNumber?.toLowerCase().includes(q) ||
          o.customer?.fullName?.toLowerCase().includes(q),
      )
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
  }, [dispatchedOrders, courierName, search, saldoFilter, fechaDesde, fechaHasta]);

  useEffect(() => {
    setPage(1);
  }, [search, courierName, saldoFilter, fechaDesde, fechaHasta]);

  const totalPages = Math.max(1, Math.ceil(rows.length / ITEMS_PER_PAGE));
  const pagedRows = rows.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );

  const handleExportExcel = () => {
    if (rows.length === 0) {
      toast.warning("No hay pedidos para exportar con los filtros aplicados");
      return;
    }
    const data = rows.map((o) => {
      const despachoAt = dispatchDateByOrderId.get(o.id);
      return {
        "N° Pedido": o.orderNumber,
        "Fecha de venta": new Date(o.created_at).toLocaleDateString("es-PE"),
        Despacho: despachoAt ? new Date(despachoAt).toLocaleDateString("es-PE") : "-",
        Cliente: o.customer?.fullName || "-",
        Teléfono: o.customer?.phoneNumber || "-",
        Ciudad: o.customer?.city || "-",
        Distrito: o.customer?.district || "-",
        "Saldo de deuda": getPendingPayment(o),
        "Costo de envío": o.carrierShippingCost ? Number(o.carrierShippingCost) : 0,
        "Número de tracking": o.externalTrackingNumber || "-",
        "Código de envío": o.shippingCode || "-",
        Oficina: o.shippingOffice || "-",
        "Clave de envío": o.shippingKey || "-",
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, courierName.slice(0, 31));
    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      `${courierName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-3 px-4">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <div>
            <CardTitle className="text-lg">Pedidos — {courierName}</CardTitle>
            <CardDescription>Un pedido por fila, despachado con {courierName}.</CardDescription>
          </div>
          <div className="text-muted-foreground text-xs font-medium bg-muted/50 px-2 py-1 rounded">
            {rows.length} pedidos
          </div>
        </div>
        <div className="flex items-center gap-3 pt-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por pedido o cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>
          <Select value={saldoFilter} onValueChange={(v) => setSaldoFilter(v as typeof saldoFilter)}>
            <SelectTrigger className="w-[170px] shrink-0 bg-background">
              <SelectValue placeholder="Saldo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Con y sin saldo</SelectItem>
              <SelectItem value="PENDING">Con saldo</SelectItem>
              <SelectItem value="PAID">Sin saldo</SelectItem>
            </SelectContent>
          </Select>
          <Popover open={fechaCalendarOpen} onOpenChange={setFechaCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2 min-w-[190px] justify-start shrink-0 bg-background">
                <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs">
                  {fechaRange?.from
                    ? `${fechaRange.from.toLocaleDateString("es-PE", { day: "2-digit", month: "short" })} – ${(
                        fechaRange.to ?? fechaRange.from
                      ).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })}`
                    : "Fecha de venta"}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={fechaRange}
                onSelect={(r) => {
                  if (r?.from && !r.to) {
                    setFechaRange({ from: r.from, to: new Date() });
                    setFechaCalendarOpen(false);
                    return;
                  }
                  setFechaRange(r);
                  if (r?.from && r?.to) setFechaCalendarOpen(false);
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {fechaRange?.from && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              title="Quitar filtro de fecha"
              onClick={() => setFechaRange(undefined)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button onClick={onRefresh} variant="outline" size="sm" className="gap-2 shrink-0">
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Actualizar
          </Button>
          <Button onClick={handleExportExcel} variant="outline" size="sm" className="gap-2 shrink-0">
            <FileSpreadsheet className="h-4 w-4" />
            Exportar Excel
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="border-t border-border overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="font-semibold px-4 h-10 text-xs whitespace-nowrap">N° Pedido</TableHead>
                <TableHead className="font-semibold px-4 h-10 text-xs text-center whitespace-nowrap">Fecha de venta</TableHead>
                <TableHead className="font-semibold px-4 h-10 text-xs text-center whitespace-nowrap">Despacho</TableHead>
                <TableHead className="font-semibold px-4 h-10 text-xs whitespace-nowrap">Cliente</TableHead>
                <TableHead className="font-semibold px-4 h-10 text-xs whitespace-nowrap">Teléfono</TableHead>
                <TableHead className="font-semibold px-4 h-10 text-xs whitespace-nowrap">Ciudad</TableHead>
                <TableHead className="font-semibold px-4 h-10 text-xs whitespace-nowrap">Distrito</TableHead>
                <TableHead className="font-semibold px-4 h-10 text-xs text-right whitespace-nowrap">Saldo de deuda</TableHead>
                <TableHead className="font-semibold px-4 h-10 text-xs text-right whitespace-nowrap">Costo de envío</TableHead>
                {TRACKING_FIELDS.map((f) => (
                  <TableHead key={f.key} className="font-semibold px-2 h-10 text-xs whitespace-nowrap">
                    {f.label}
                  </TableHead>
                ))}
                <TableHead className="font-semibold px-4 h-10 text-right text-xs whitespace-nowrap">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={14} className="h-16 animate-pulse bg-muted/10 px-4" />
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={14} className="h-32 text-center text-muted-foreground text-sm">
                    No hay pedidos despachados con {courierName}.
                  </TableCell>
                </TableRow>
              ) : (
                pagedRows.map((order) => {
                  const despachoAt = dispatchDateByOrderId.get(order.id);
                  return (
                    <TableRow key={order.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="font-medium px-4 py-3 text-xs whitespace-nowrap">
                        {order.orderNumber}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-[10px] text-center whitespace-nowrap">
                        {new Date(order.created_at).toLocaleDateString("es-PE")}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-[10px] text-center whitespace-nowrap">
                        {despachoAt ? new Date(despachoAt).toLocaleDateString("es-PE") : "-"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs">
                        {order.customer?.fullName || "-"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs whitespace-nowrap">
                        {order.customer?.phoneNumber || "-"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs whitespace-nowrap">
                        {order.customer?.city || "-"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs whitespace-nowrap">
                        {order.customer?.district || "-"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs text-right tabular-nums whitespace-nowrap">
                        {money(getPendingPayment(order))}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs text-right tabular-nums whitespace-nowrap">
                        {order.carrierShippingCost ? money(Number(order.carrierShippingCost)) : "-"}
                      </TableCell>
                      <TrackingInputCells order={order} onSaved={onRefresh} />
                      <TableCell className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            title="Ver comprobante de entrega"
                            disabled={!order.shippingProofUrl}
                            onClick={() => openDocument(order.shippingProofUrl!)}
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            title="Ver pedido"
                            onClick={() => onView(order.id)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={rows.length}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={setPage}
          itemName="pedidos"
        />
      </CardContent>
    </Card>
  );
}
