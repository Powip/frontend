"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import { DateRange } from "react-day-picker";
import { useAuth } from "@/contexts/AuthContext";
import { useOrdersByStore } from "@/hooks/useOrdersByStore";
import { useIncompleteOrders } from "@/hooks/useIncompleteOrders";
import { useCcPedidos } from "@/hooks/useCcPedidos";
import { useCcKpis } from "@/hooks/useCcKpis";
import { OrderHeader, OrderStatus, SubEstadoCc, TipoGestionCC } from "@/interfaces/IOrder";
import { HeaderConfig } from "@/components/header/HeaderConfig";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Gift, FileDown, MessageCircle, Copy } from "lucide-react";
import { toast } from "sonner";
import { exportSalesToExcel } from "@/utils/exportSalesExcel";
import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import { confirmOrder } from "@/services/incompleteOrdersService";

import { isSuperadmin, hasAdminAccess } from "@/config/permissions.config";
import { CcMovimientosTab } from "@/components/atencion-cliente/cc-v2/CcMovimientosTab";
import { CcTabsL1 } from "@/components/atencion-cliente/cc-v2/CcTabsL1";
import { CcTabsL2, defaultSubEstado } from "@/components/atencion-cliente/cc-v2/CcTabsL2";
import { CcKpiBar } from "@/components/atencion-cliente/cc-v2/CcKpiBar";
import { CcToolbar, AGENTE_UNASSIGNED } from "@/components/atencion-cliente/cc-v2/CcToolbar";
import { CcPedidosTable } from "@/components/atencion-cliente/cc-v2/CcPedidosTable";
import { useAgentes } from "@/hooks/useAgentes";
import { IncompleteOrdersTab } from "@/components/atencion-cliente/IncompleteOrdersTab";

import CustomerServiceModal from "@/components/modals/CustomerServiceModal";
import PaymentVerificationModal from "@/components/modals/PaymentVerificationModal";
import ReassignSellerModal from "@/components/modals/ReassignSellerModal";
import { reassignSeller, recuperarVentaCC } from "@/services/atencionClienteService";

import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { SourceBadge } from "@/components/shared/SourceBadge";

/* -------------------------------------------------------
   Helpers legacy (tabs que coexisten con CC v2)
------------------------------------------------------- */
function mapOrderToLegacySale(order: OrderHeader) {
  const totalPaid = (order.payments ?? [])
    .filter((p) => p.status === "PAID")
    .reduce((s, p) => s + Number(p.amount), 0);
  const grandTotal = Number(order.grandTotal);
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    clientName: order.customer?.fullName ?? "—",
    phoneNumber: order.customer?.phoneNumber ?? "—",
    date: new Date(order.created_at).toLocaleDateString("es-PE"),
    total: grandTotal,
    status: order.status,
    paymentMethod: order.payments?.[0]?.paymentMethod ?? "—",
    deliveryType: order.deliveryType,
    salesRegion: order.salesRegion,
    district: order.customer?.district ?? "—",
    address: order.customer?.address ?? "—",
    advancePayment: totalPaid,
    pendingPayment: Math.max(grandTotal - totalPaid, 0),
    callStatus: order.callStatus,
    callbackAt: order.callbackAt
      ? new Date(order.callbackAt).toLocaleString("es-PE")
      : null,
    sellerName: order.sellerName ?? null,
    externalSource: order.externalSource ?? null,
    externalId: (order as any).externalId ?? null,
  };
}

/* -------------------------------------------------------
   Page
------------------------------------------------------- */
export default function AtencionClientePage() {
  const { auth, selectedStoreId } = useAuth();


  /* ── CC v2 state ─────────────────────────────────────── */
  const [l1, setL1] = useState<TipoGestionCC>("cod");
  const [l2, setL2] = useState<SubEstadoCc>(defaultSubEstado("cod"));
  const [canalFiltro, setCanalFiltro] = useState("");
  const [agenteFiltro, setAgenteFiltro] = useState("");
  const [dateFiltro, setDateFiltro] = useState<DateRange | undefined>();
  const [pageCc, setPageCc] = useState(1);
  const [selectedCcIds, setSelectedCcIds] = useState<Set<string>>(new Set());
  const [movimientosActive, setMovimientosActive] = useState(false);

  // RBAC: solo admin/owner/superadmin ven la pestaña Movimientos
  const isAdmin =
    isSuperadmin(auth?.user?.email) || hasAdminAccess(auth?.user?.role);

  /* ── CC v2 data ──────────────────────────────────────── */
  const { data: agentes = [], isLoading: agentesLoading } = useAgentes(selectedStoreId);

  const { data: ccResult, isLoading: ccLoading, refetch: refetchCc } = useCcPedidos({
    storeId: selectedStoreId ?? undefined,
    tipoGestion: l1,
    subEstado: l2,
    canalOrigen: canalFiltro || undefined,
    agenteId: agenteFiltro && agenteFiltro !== AGENTE_UNASSIGNED ? agenteFiltro : undefined,
    unassigned: agenteFiltro === AGENTE_UNASSIGNED ? true : undefined,
    startDate: dateFiltro?.from?.toISOString(),
    endDate: dateFiltro?.to?.toISOString(),
    page: pageCc,
    limit: 50,
  });

  const ccPedidos = ccResult?.data ?? [];
  const ccTotalPages = ccResult?.totalPages ?? 1;
  const ccTotal = ccResult?.total;

  // Resetear página cuando cambia cualquier filtro (excepto la propia página)
  useEffect(() => {
    setPageCc(1);
  }, [l1, l2, canalFiltro, agenteFiltro, dateFiltro]);

  // KPIs por tab para contadores globales (independiente de la tab activa)
  const { data: kpisCod }     = useCcKpis("cod",     selectedStoreId);
  const { data: kpisLima }    = useCcKpis("lima",    selectedStoreId);
  const { data: kpisCarrito } = useCcKpis("carrito", selectedStoreId);
  // KPIs de la tab activa para KpiBar y L2 sub-tabs
  const { data: ccKpis, isLoading: kpisLoading } = useCcKpis(l1, selectedStoreId);

  // Contadores globales: cada tab muestra su total real sin importar dónde estés
  const l1Counts = useMemo(() => ({
    cod:     (kpisCod?.["por_confirmar"]             ?? 0) +
             (kpisCod?.["contactado"]                ?? 0) +
             (kpisCod?.["no_contesta"]               ?? 0),
    lima:    kpisLima?.["entrega_lima"]              ?? 0,
    carrito: (kpisCarrito?.["carrito_sin_contactar"] ?? 0) +
             (kpisCarrito?.["carrito_contactado"]    ?? 0),
  }), [kpisCod, kpisLima, kpisCarrito]);

  const l2Counts = useMemo(() => {
    const c: Partial<Record<SubEstadoCc, number>> = {};
    if (ccKpis) {
      Object.keys(ccKpis).forEach((k) => {
        if (k !== "efectividadHoy") c[k as SubEstadoCc] = ccKpis[k];
      });
    }
    return c;
  }, [ccKpis]);

  const canaresUnicos = useMemo(
    () => [...new Set(ccPedidos.map((o) => o.canalOrigen).filter(Boolean))] as string[],
    [ccPedidos],
  );

  /* ── Legacy orders ───────────────────────────────────── */
  const { data: ordersData, isLoading: legacyLoading, refetch: refetchOrders } =
    useOrdersByStore(selectedStoreId);

  const { data: incompleteOrders = [], isLoading: incompleteLoading, refetch: refetchIncomplete } =
    useIncompleteOrders(selectedStoreId);

  const legacySales = useMemo(() => {
    if (!ordersData) return [];
    return [...ordersData]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map(mapOrderToLegacySale);
  }, [ordersData]);

  const pedidosPreVenta = useMemo(
    () => legacySales.filter((s) => s.status === "PREVENTA"),
    [legacySales],
  );

  /* ── Promos ──────────────────────────────────────────── */
  const [promoItems, setPromoItems] = useState<any[]>([]);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoFromDate, setPromoFromDate] = useState("");
  const [promoToDate, setPromoToDate] = useState("");

  const fetchPromoItems = useCallback(async () => {
    if (!selectedStoreId) return;
    try {
      setPromoLoading(true);
      const params = new URLSearchParams({ storeId: selectedStoreId });
      if (promoFromDate) params.append("fromDate", promoFromDate);
      if (promoToDate) params.append("toDate", promoToDate);
      const res = await axiosAuth.get(
        `${GATEWAY.ventas}/order-items/promo-items?${params}`,
      );
      setPromoItems(res.data);
    } catch {
      toast.error("Error al cargar promos vendidas");
    } finally {
      setPromoLoading(false);
    }
  }, [selectedStoreId, promoFromDate, promoToDate]);

  /* ── Modals ──────────────────────────────────────────── */
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentOrderId, setPaymentOrderId] = useState<string | null>(null);
  const [paymentOrderNumber, setPaymentOrderNumber] = useState<string>("");

  const [reassignSellerModalOpen, setReassignSellerModalOpen] = useState(false);
  const [orderToReassign, setOrderToReassign] = useState<OrderHeader | null>(null);
  const [isReassigningLoading, setIsReassigningLoading] = useState(false);

  function openModal(order: OrderHeader) {
    setSelectedOrderId(order.id);
    setModalOpen(true);
  }

  function openPaymentModal(order: OrderHeader) {
    setPaymentOrderId(order.id);
    setPaymentOrderNumber(order.orderNumber);
    setPaymentModalOpen(true);
  }

  /* ── CC table handlers ───────────────────────────────── */
  function handleToggleCc(id: string) {
    setSelectedCcIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleToggleAllCc(ids: string[]) {
    const all = ids.every((id) => selectedCcIds.has(id));
    setSelectedCcIds(all ? new Set() : new Set(ids));
  }

  function handleWhatsApp(order: OrderHeader) {
    const phone = (order.customer?.phoneNumber ?? "").replace(/\D/g, "");
    const cleanPhone = phone.startsWith("51") ? phone : `51${phone}`;
    const msg = `Hola ${order.customer?.fullName ?? ""}! Te contactamos por tu pedido ${order.orderNumber}.`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  function handleWhatsAppMasivo() {
    const selected = ccPedidos.filter((o) => selectedCcIds.has(o.id));
    if (!selected.length) { toast.warning("No hay pedidos seleccionados"); return; }
    setSelectedCcIds(new Set());
    toast.info(`Abriendo ${selected.length} pestañas de WhatsApp...`);
    selected.forEach((o, i) => setTimeout(() => handleWhatsApp(o), i * 600));
  }

  async function handleCopiarCc() {
    const selected = ccPedidos.filter((o) => selectedCcIds.has(o.id));
    if (!selected.length) { toast.warning("No hay pedidos seleccionados"); return; }
    const text = selected
      .map((o) =>
        `Pedido ${o.orderNumber}\nCliente: ${o.customer?.fullName}\nTel: ${o.customer?.phoneNumber}\nTotal: S/${Number(o.grandTotal).toFixed(2)}`
      )
      .join("\n\n---\n\n");
    await navigator.clipboard.writeText(text);
    toast.success(`${selected.length} pedido(s) copiados`);
  }

  /* ── Reasignación de vendedor ────────────────────────── */
  async function handleReassignSeller(sellerId: string, sellerName: string) {
    if (!orderToReassign) return;
    setIsReassigningLoading(true);
    try {
      await reassignSeller(
        orderToReassign.id,
        sellerId,
        sellerName,
        auth?.user?.id,
        auth?.user ? `${auth.user.name || ""} ${auth.user.surname || ""}`.trim() : undefined,
      );
      toast.success("Vendedor reasignado correctamente");
      setReassignSellerModalOpen(false);
      setOrderToReassign(null);
      refetchCc();
    } catch {
      toast.error("No se pudo reasignar el vendedor");
    } finally {
      setIsReassigningLoading(false);
    }
  }

  /* ── Recuperar venta anulada ────────────────────────── */
  async function handleRecuperar(order: OrderHeader) {
    try {
      await recuperarVentaCC(order.id);
      toast.success("Pedido recuperado exitosamente");
      refetchCc();
    } catch {
      toast.error("No se pudo recuperar el pedido");
    }
  }

  /* ── L1 change: reset L2 y filtros ──────────────────── */
  function handleL1Change(tab: TipoGestionCC) {
    setL1(tab);
    setL2(defaultSubEstado(tab));
    setCanalFiltro("");
    setAgenteFiltro("");
    setDateFiltro(undefined);
    setSelectedCcIds(new Set());
    setMovimientosActive(false);
  }

  if (!auth) return null;

  return (
    <div className="flex h-screen w-full">
      <main className="flex-1 overflow-auto">

        {/* Header */}
        <div className="px-6 pt-6">
          <HeaderConfig
            title="Atención al Cliente"
            description="Call Center v2 — Gestión de ventas COD, entregas Lima y recupero de carritos"
          />
        </div>

        {/* ── Tabs raíz: CC v2 | Legacy | Otras ─────────────── */}
        <Tabs defaultValue="cc" className="w-full">
          <div className="px-6 pt-4">
            <TabsList>
              <TabsTrigger value="cc">📞 Call Center v2</TabsTrigger>
              <TabsTrigger value="preventa" className="text-violet-600">
                Pre-Ventas
                {pedidosPreVenta.length > 0 && (
                  <span className="ml-1 rounded-full bg-violet-600 text-white text-xs px-1.5 py-0.5">
                    {pedidosPreVenta.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="correcciones" className="text-orange-600">
                Correcciones
                {incompleteOrders.length > 0 && (
                  <span className="ml-1 rounded-full bg-orange-600 text-white text-xs px-1.5 py-0.5">
                    {incompleteOrders.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="promos" className="text-purple-600">
                <Gift className="h-3.5 w-3.5 mr-1" />
                Promos
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ── TAB: CC v2 ──────────────────────────────────── */}
          <TabsContent value="cc" className="mt-0">
            {/* L1 tabs */}
            <div className="px-6 pt-2">
              <CcTabsL1
                active={l1}
                onChange={handleL1Change}
                counts={l1Counts}
                showMovimientos={isAdmin}
                isMovimientos={movimientosActive}
                onMovimientosClick={() => setMovimientosActive(true)}
              />
            </div>

            {/* L2 sub-tabs — se ocultan en Movimientos */}
            {!movimientosActive && (
              <CcTabsL2 tipoGestion={l1} active={l2} onChange={setL2} counts={l2Counts} />
            )}

            {/* Content */}
            <div className="p-6 space-y-4 bg-gray-50 dark:bg-slate-900 min-h-screen">
              {movimientosActive ? (
                <CcMovimientosTab storeId={selectedStoreId ?? ""} />
              ) : (
                <>
                  <CcKpiBar tipoGestion={l1} kpis={ccKpis} loading={kpisLoading} />
                  <CcToolbar
                    agenteId={agenteFiltro}
                    canalOrigen={canalFiltro}
                    agentes={agentes}
                    agentesLoading={agentesLoading}
                    onAgenteChange={setAgenteFiltro}
                    onCanalChange={setCanalFiltro}
                    selectedCount={selectedCcIds.size}
                    onWhatsAppMasivo={handleWhatsAppMasivo}
                    onCopiar={handleCopiarCc}
                    canales={canaresUnicos}
                    date={dateFiltro}
                    onDateChange={setDateFiltro}
                  />
                  {ccLoading ? (
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-8 text-center text-gray-400 dark:text-slate-500 text-sm">
                      Cargando pedidos...
                    </div>
                  ) : (
                    <CcPedidosTable
                      data={ccPedidos}
                      tipoGestion={l1}
                      selectedIds={selectedCcIds}
                      onToggle={handleToggleCc}
                      onToggleAll={handleToggleAllCc}
                      onVerPedido={openModal}
                      onWhatsApp={handleWhatsApp}
                      onGestionarPago={openPaymentModal}
                      onReassignSeller={(order) => {
                        setOrderToReassign(order);
                        setReassignSellerModalOpen(true);
                      }}
                      onRecuperar={handleRecuperar}
                      page={pageCc}
                      totalPages={ccTotalPages}
                      total={ccTotal}
                      onPageChange={setPageCc}
                    />
                  )}
                </>
              )}
            </div>
          </TabsContent>

          {/* ── TAB: Pre-Ventas ─────────────────────────────── */}
          <TabsContent value="preventa" className="p-6">
            <Card>
              <CardHeader>
                <CardTitle>Pre-Ventas — pendientes de confirmación</CardTitle>
              </CardHeader>
              <CardContent>
                {pedidosPreVenta.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No hay pedidos en estado Pre-Venta.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>N° Pedido</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Teléfono</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pedidosPreVenta.map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell className="font-mono text-sm">{sale.orderNumber}</TableCell>
                          <TableCell>{sale.clientName}</TableCell>
                          <TableCell>{sale.phoneNumber}</TableCell>
                          <TableCell>S/ {sale.total.toFixed(2)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{sale.date}</TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              onClick={async () => {
                                try {
                                  await confirmOrder(sale.id);
                                  toast.success(`Pedido ${sale.orderNumber} confirmado`);
                                  refetchOrders();
                                } catch {
                                  toast.error("Error al confirmar el pedido");
                                }
                              }}
                            >
                              Confirmar venta
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TAB: Correcciones ───────────────────────────── */}
          <TabsContent value="correcciones" className="p-6">
            <Card>
              <CardHeader>
                <CardTitle>Pedidos con Errores de Sincronización</CardTitle>
              </CardHeader>
              <CardContent>
                <IncompleteOrdersTab
                  orders={incompleteOrders}
                  isLoading={incompleteLoading}
                  onRepaired={() => { refetchIncomplete(); refetchOrders(); }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TAB: Promos ─────────────────────────────────── */}
          <TabsContent value="promos" className="p-6">
            <Card className="border-purple-200 dark:border-purple-800">
              <CardHeader className="bg-purple-50 dark:bg-purple-950/30">
                <CardTitle className="text-purple-700 dark:text-purple-300 flex items-center gap-2">
                  <Gift className="h-5 w-5" />
                  Promos del Día Vendidas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="flex gap-4 items-end">
                  <div className="space-y-1">
                    <Label>Desde</Label>
                    <Input type="date" value={promoFromDate} onChange={(e) => setPromoFromDate(e.target.value)} className="w-40" />
                  </div>
                  <div className="space-y-1">
                    <Label>Hasta</Label>
                    <Input type="date" value={promoToDate} onChange={(e) => setPromoToDate(e.target.value)} className="w-40" />
                  </div>
                  <Button onClick={fetchPromoItems} disabled={promoLoading}>
                    {promoLoading ? "Cargando..." : "Buscar"}
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Orden</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-center">Cant.</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {promoItems.map((promo) => (
                      <TableRow key={promo.id}>
                        <TableCell className="text-xs">
                          {promo.addedAt ? new Date(promo.addedAt).toLocaleDateString("es-PE") : "—"}
                        </TableCell>
                        <TableCell className="font-medium">{promo.orderNumber}</TableCell>
                        <TableCell>{promo.customerName}</TableCell>
                        <TableCell>{promo.productName}</TableCell>
                        <TableCell className="text-center">{promo.quantity}</TableCell>
                        <TableCell className="text-right font-medium">
                          S/{Number(promo.subtotal).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {promoItems.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                          {promoLoading ? "Cargando..." : "Seleccioná un rango y hacé clic en Buscar"}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* ── Modals ─────────────────────────────────────────── */}
      <CustomerServiceModal
        open={modalOpen}
        orderId={selectedOrderId ?? ""}
        onClose={() => { setModalOpen(false); setSelectedOrderId(null); }}
        onOrderUpdated={refetchCc}
      />

      <PaymentVerificationModal
        open={paymentModalOpen}
        onClose={() => { setPaymentModalOpen(false); setPaymentOrderId(null); }}
        orderId={paymentOrderId ?? ""}
        orderNumber={paymentOrderNumber}
        onPaymentUpdated={refetchCc}
        canApprove={true}
      />

      {orderToReassign && (
        <ReassignSellerModal
          open={reassignSellerModalOpen}
          onClose={() => {
            setReassignSellerModalOpen(false);
            setOrderToReassign(null);
          }}
          orderNumber={orderToReassign.orderNumber}
          currentSellerName={orderToReassign.sellerName ?? null}
          companyId={auth?.company?.id ?? ""}
          onConfirm={handleReassignSeller}
          isLoading={isReassigningLoading}
        />
      )}
    </div>
  );
}
