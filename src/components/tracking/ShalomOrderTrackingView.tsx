"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Search,
  Truck,
  FileText,
  DollarSign,
  MessageCircle,
  Lock,
  Eye,
  EyeOff,
  RefreshCw,
  Check,
  X,
  Edit2,
  ClipboardList,
  Link2,
  FileSpreadsheet,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast } from "sonner";
import { OrderHeader } from "@/interfaces/IOrder";
import CustomerServiceModal, {
  ShippingGuideData,
} from "@/components/modals/CustomerServiceModal";
import GuideDetailsModal from "@/components/modals/GuideDetailsModal";
import ShippingNotesModal from "@/components/modals/ShippingNotesModal";
import PaymentVerificationModal from "@/components/modals/PaymentVerificationModal";
import ShalomPremiumTrackingModal from "@/components/modals/ShalomPremiumTrackingModal";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { trackShalomShipment } from "@/services/shalomService";
import { isShalomCourier } from "@/utils/courierNormalizer";

interface ShippingGuide {
  id: string;
  guideNumber: string;
  notes?: string | null;
  created_at: string;
}

interface EnvioItem {
  order: OrderHeader;
  guide?: ShippingGuide | null;
}

const calculatePendingPayment = (order: OrderHeader): number => {
  if (!order) return 0;
  const grandTotal = parseFloat(order.grandTotal) || 0;
  if (!order.payments) return grandTotal;
  const totalPaid = order.payments
    .filter((p) => p && p.status === "PAID")
    .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  return grandTotal - totalPaid;
};

const SHALOM_STEPS = [
  { key: "registrado", label: "Registrado" },
  { key: "origen",     label: "En Origen" },
  { key: "transito",   label: "En Tránsito" },
  { key: "destino",    label: "En Destino" },
  { key: "reparto",    label: "En Reparto" },
  { key: "entregado",  label: "Entregado" },
] as const;

const SHALOM_STEP_STYLES: Record<string, string> = {
  "Registrado":  "bg-green-50 text-green-700 border-green-200",
  "En Origen":   "bg-teal-50 text-teal-700 border-teal-200",
  "En Tránsito": "bg-blue-50 text-blue-700 border-blue-200",
  "En Destino":  "bg-indigo-50 text-indigo-700 border-indigo-200",
  "En Reparto":  "bg-violet-50 text-violet-700 border-violet-200",
  "Entregado":   "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const SHALOM_STEP_ICONS: Record<string, string> = {
  "Registrado":  "✅",
  "En Origen":   "📦",
  "En Tránsito": "🚚",
  "En Destino":  "📍",
  "En Reparto":  "🛵",
  "Entregado":   "🎉",
};

function getLatestShalomStep(rawResponse: Record<string, unknown>): string | null {
  let payload: Record<string, unknown> = rawResponse;
  for (let i = 0; i < 3; i++) {
    if (payload?.statuses) break;
    if (payload?.data) { payload = payload.data as Record<string, unknown>; continue; }
    break;
  }
  const statuses = (payload?.statuses as { data?: Record<string, unknown> } | undefined)?.data;
  if (!statuses) return null;
  for (let i = SHALOM_STEPS.length - 1; i >= 0; i--) {
    if (statuses[SHALOM_STEPS[i].key]) return SHALOM_STEPS[i].label;
  }
  return null;
}

export default function ShalomOrderTrackingView() {
  const { auth, selectedStoreId } = useAuth();
  const [shalomOrders, setShalomOrders] = useState<EnvioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [guideSearch, setGuideSearch] = useState("");
  const [guideStatusFilter, setGuideStatusFilter] = useState("");
  const [pendingFilter, setPendingFilter] = useState<"all" | "pending" | "paid">("all");
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);
  const [selectedSaleIds, setSelectedSaleIds] = useState<Set<string>>(
    new Set(),
  );

  // Modal states
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedGuideData, setSelectedGuideData] =
    useState<ShippingGuideData | null>(null);

  const [guideModalOpen, setGuideModalOpen] = useState(false);
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [selectedGuideForNotes, setSelectedGuideForNotes] = useState<{
    id: string;
    notes: string;
  } | null>(null);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<{
    id: string;
    orderNumber: string;
  } | null>(null);

  // New features states
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null);
  const [tempKey, setTempKey] = useState("");
  const [isUpdatingKey, setIsUpdatingKey] = useState(false);
  const [visibleKeyOrders, setVisibleKeyOrders] = useState<
    Record<string, boolean>
  >({});

  const [premiumModalOpen, setPremiumModalOpen] = useState(false);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);
  const [selectedEnvio, setSelectedEnvio] = useState<EnvioItem | null>(null);

  const [liveStatuses, setLiveStatuses] = useState<Record<string, string>>({});
  const [loadingLiveStatuses, setLoadingLiveStatuses] = useState(false);

  const fetchShalomOrders = useCallback(async () => {
    if (!selectedStoreId) return;
    setLoading(true);
    try {
      const ordersRes = await axios.get<OrderHeader[]>(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/store/${selectedStoreId}`,
      );

      const shalomOnly = ordersRes.data
        .filter(
          (o) =>
            (isShalomCourier(o.courier) || isShalomCourier(o.shippingOffice)) &&
            o.shalomStatus !== null &&
            o.shalomStatus !== undefined,
        )
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );

      const processed = await Promise.all(
        shalomOnly.map(async (order) => {
          let guide: ShippingGuide | null = null;
          if (order.guideNumber) {
            try {
              const guideRes = await axios.get<ShippingGuide>(
                `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/order/${order.id}`,
              );
              guide = guideRes.data;
            } catch (e) {
              console.error("Error fetching guide", e);
            }
          }
          return { order, guide };
        }),
      );

      setShalomOrders(processed);
    } catch (error) {
      console.error("Error fetching shalom orders", error);
      toast.error("Error al cargar pedidos de Shalom");
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId]);

  const fetchLiveStatuses = useCallback(async (orders: EnvioItem[]) => {
    if (!auth?.accessToken || !auth?.company?.id) return;
    const eligible = orders.filter(
      ({ order }) => order.externalTrackingNumber && order.shippingCode,
    );
    if (!eligible.length) return;

    setLoadingLiveStatuses(true);
    const results = await Promise.allSettled(
      eligible.map(async ({ order }) => {
        const raw = await trackShalomShipment(
          auth.accessToken,
          auth.company!.id,
          order.externalTrackingNumber!,
          order.shippingCode!,
        );
        const label = getLatestShalomStep(raw);
        return { orderId: order.id, label };
      }),
    );

    const updates: Record<string, string> = {};
    results.forEach((result) => {
      if (result.status === "fulfilled" && result.value.label) {
        updates[result.value.orderId] = result.value.label;
      }
    });
    setLiveStatuses(updates);
    setLoadingLiveStatuses(false);
  }, [auth?.accessToken, auth?.company?.id]);

  useEffect(() => {
    fetchShalomOrders();
  }, [fetchShalomOrders]);

  useEffect(() => {
    if (shalomOrders.length > 0) {
      fetchLiveStatuses(shalomOrders);
    }
  }, [shalomOrders, fetchLiveStatuses]);

  const filteredOrders = useMemo(() => {
    return shalomOrders.filter(({ order, guide }) => {
      if (guideSearch) {
        const search = guideSearch.toLowerCase();
        const matchesName = order.customer?.fullName?.toLowerCase().includes(search);
        const matchesNum = order.orderNumber.toLowerCase().includes(search);
        const matchesGuide =
          guide?.guideNumber?.toLowerCase().includes(search) ||
          order.guideNumber?.toLowerCase().includes(search);
        if (!matchesName && !matchesNum && !matchesGuide) return false;
      }

      if (guideStatusFilter && order.shalomStatus !== guideStatusFilter)
        return false;

      if (pendingFilter !== "all") {
        const pending = calculatePendingPayment(order);
        if (pendingFilter === "pending" && pending <= 0) return false;
        if (pendingFilter === "paid" && pending > 0) return false;
      }

      if (dateFrom || dateTo) {
        const orderDate = new Date(order.created_at);
        orderDate.setHours(0, 0, 0, 0);
        if (dateFrom) {
          const from = new Date(dateFrom + "T00:00:00");
          if (orderDate < from) return false;
        }
        if (dateTo) {
          const to = new Date(dateTo + "T23:59:59");
          if (orderDate > to) return false;
        }
      }

      return true;
    });
  }, [shalomOrders, guideSearch, guideStatusFilter, pendingFilter, dateFrom, dateTo]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedSaleIds(new Set(filteredOrders.map((o) => o.order.id)));
    } else {
      setSelectedSaleIds(new Set());
    }
  };

  const handleSelectRow = (id: string) => {
    const next = new Set(selectedSaleIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedSaleIds(next);
  };

  const handleBulkWhatsApp = () => {
    toast.info("WhatsApp Masivo en desarrollo");
  };

  const handleOpenOrder = (item: EnvioItem) => {
    setSelectedOrderId(item.order.id);
    setSelectedGuideData(item.guide ? ({ ...item.guide } as any) : null);
    setOrderModalOpen(true);
  };

  const handleOpenGuide = (item: EnvioItem) => {
    setSelectedOrderId(item.order.id);
    setGuideModalOpen(true);
  };

  const handleOpenNotes = (item: EnvioItem) => {
    setSelectedEnvio(item);
    setPremiumModalOpen(true);
  };

  const handleStartEditKey = (order: OrderHeader) => {
    setEditingKeyId(order.id);
    setTempKey(order.shippingKey || "");
  };

  const handleSaveKey = async (orderId: string) => {
    if (!auth?.accessToken) return;
    setIsUpdatingKey(true);
    try {
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`,
        { shippingKey: tempKey },
        { headers: { Authorization: `Bearer ${auth.accessToken}` } },
      );
      toast.success("Clave actualizada");
      fetchShalomOrders();
      setEditingKeyId(null);
    } catch (error) {
      console.error("Error updating key", error);
      toast.error("No se pudo actualizar la clave");
    } finally {
      setIsUpdatingKey(false);
    }
  };

  const toggleKeyVisibility = (orderId: string) => {
    setVisibleKeyOrders((prev) => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const handleExportExcel = async () => {
    if (filteredOrders.length === 0) {
      toast.warning("No hay datos para exportar");
      return;
    }

    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("Seguimiento Shalom");

    const DARK_NAVY = "FF1B2A3B";
    const HEADER_FONT: any = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    const TITLE_FONT: any = { bold: true, size: 13, color: { argb: "FF1B2A3B" } };
    const THIN_BORDER: any = {
      top: { style: "thin", color: { argb: "FFDDDDDD" } },
      left: { style: "thin", color: { argb: "FFDDDDDD" } },
      bottom: { style: "thin", color: { argb: "FFDDDDDD" } },
      right: { style: "thin", color: { argb: "FFDDDDDD" } },
    };

    const COLUMNS = [
      { header: "Fecha", width: 14 },
      { header: "Días", width: 8 },
      { header: "Saldo", width: 14 },
      { header: "Estado", width: 16 },
      { header: "Clave", width: 12 },
      { header: "N° Orden", width: 16 },
      { header: "Cliente", width: 26 },
      { header: "N° Guía Shalom", width: 20 },
      { header: "Código", width: 14 },
      { header: "Origen", width: 22 },
      { header: "Destino", width: 22 },
      { header: "DNI", width: 14 },
      { header: "Teléfono", width: 14 },
    ];

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const fecha = today.toLocaleDateString("es-PE");

    ws.addRow([`SEGUIMIENTO SHALOM — ${fecha}`]);
    ws.mergeCells(1, 1, 1, COLUMNS.length);
    const titleCell = ws.getCell("A1");
    titleCell.font = TITLE_FONT;
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 28;

    ws.addRow([`Total registros: ${filteredOrders.length}`]);
    ws.addRow([]);

    const headerRow = ws.addRow(COLUMNS.map((c) => c.header));
    headerRow.height = 22;
    headerRow.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_NAVY } };
      cell.font = HEADER_FONT;
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = THIN_BORDER;
    });

    const STATUS_LABELS: Record<string, string> = {
      PENDIENTE: "Registrado",
      EXITOSO: "Registrado",
      FALLIDO: "Fallido",
      EN_TRANSITO: "En tránsito",
      EN_DESTINO: "En destino",
      EN_REPARTO: "En reparto",
      ENTREGADO: "Entregado",
    };

    filteredOrders.forEach(({ order }) => {
      const created = new Date(order.created_at); created.setHours(0, 0, 0, 0);
      const days = Math.max(0, Math.floor((today.getTime() - created.getTime()) / 86400000));
      const pending = calculatePendingPayment(order);
      const saldoText = pending <= 0 ? "Pagado" : `S/ ${pending.toFixed(2)}`;
      const estadoText = order.shalomStatus ? (STATUS_LABELS[order.shalomStatus] || order.shalomStatus) : "Sin registrar";

      const dataRow = ws.addRow([
        new Date(order.created_at).toLocaleDateString("es-PE"),
        days,
        saldoText,
        estadoText,
        order.shippingKey || "-",
        order.orderNumber,
        order.customer?.fullName || "-",
        order.externalTrackingNumber || "-",
        order.shippingCode || "-",
        order.shalomOriginAgency || "-",
        order.shalomDestinationAgency || "-",
        order.shalomRecipientDoc || "-",
        order.shalomRecipientPhone || "-",
      ]);

      dataRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = THIN_BORDER;
        cell.alignment = { vertical: "middle" };
      });
    });

    COLUMNS.forEach((col, i) => { ws.getColumn(i + 1).width = col.width; });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Shalom_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    toast.success(`${filteredOrders.length} registros exportados`);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 p-4 border rounded-xl bg-muted/20">
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Búsqueda rápida</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Orden, guía o cliente..."
              value={guideSearch}
              onChange={(e) => setGuideSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Período</Label>
          <PeriodSelector
            onPeriodChange={(from, to) => { setDateFrom(from); setDateTo(to); }}
            className="w-full"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Estado Shalom</Label>
          <select
            className="w-full h-9 text-sm border rounded-md px-3 bg-background"
            value={guideStatusFilter}
            onChange={(e) => setGuideStatusFilter(e.target.value)}
          >
            <option value="">Todos los estados</option>
            <option value="PENDIENTE">✅ Registrado</option>
            <option value="FALLIDO">❌ Fallido</option>
            <option value="EN_TRANSITO">🚚 En tránsito</option>
            <option value="EN_DESTINO">📍 En destino</option>
            <option value="EN_REPARTO">🛵 En reparto</option>
            <option value="ENTREGADO">📦 Entregado</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Saldo</Label>
          <select
            className="w-full h-9 text-sm border rounded-md px-3 bg-background"
            value={pendingFilter}
            onChange={(e) => setPendingFilter(e.target.value as "all" | "pending" | "paid")}
          >
            <option value="all">Todos</option>
            <option value="pending">Con saldo pendiente</option>
            <option value="paid">Pagado completo</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {filteredOrders.length} registro{filteredOrders.length !== 1 ? "s" : ""}
        </span>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              fetchShalomOrders();
              fetchLiveStatuses(shalomOrders);
            }}
            disabled={loading || loadingLiveStatuses}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loadingLiveStatuses ? "animate-spin" : ""}`} />
            Actualizar estados
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportExcel}
            disabled={filteredOrders.length === 0}
            className="gap-2 text-green-700 border-green-200 hover:bg-green-50"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Exportar Excel
          </Button>
        </div>
      </div>

      {selectedSaleIds.size > 0 && (
        <div className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <span className="text-sm font-medium text-orange-800">
            {selectedSaleIds.size} pedidos seleccionados
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700"
              onClick={handleBulkWhatsApp}
            >
              <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp Masivo
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedSaleIds(new Set())}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {(() => {
        const failedCount = shalomOrders.filter(
          ({ order }) => order.shalomStatus === "FALLIDO",
        ).length;
        if (failedCount === 0 || guideStatusFilter === "FALLIDO") return null;
        return (
          <div role="alert" className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
            <span className="flex items-center gap-2 text-sm font-medium text-red-800">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {failedCount} despacho{failedCount !== 1 ? "s" : ""} fallido{failedCount !== 1 ? "s" : ""} requieren atención
            </span>
            <Button
              size="sm"
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-100"
              onClick={() => setGuideStatusFilter("FALLIDO")}
            >
              Ver fallidos
            </Button>
          </div>
        );
      })()}

      <div className="border rounded-xl overflow-hidden bg-background">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-10 text-center">
                <input
                  type="checkbox"
                  onChange={handleSelectAll}
                  checked={
                    filteredOrders.length > 0 &&
                    selectedSaleIds.size === filteredOrders.length
                  }
                />
              </TableHead>
              <TableHead className="text-[11px] uppercase font-bold">
                Fecha
              </TableHead>
              <TableHead className="text-[11px] uppercase font-bold text-center">
                Días
              </TableHead>
              <TableHead className="text-[11px] uppercase font-bold text-right">
                Saldo
              </TableHead>
              <TableHead className="text-[11px] uppercase font-bold text-center">
                Estado
              </TableHead>
              <TableHead className="text-[11px] uppercase font-bold text-center">
                Clave
              </TableHead>
              <TableHead className="text-[11px] uppercase font-bold">
                N° Orden
              </TableHead>
              <TableHead className="text-[11px] uppercase font-bold">
                Cliente
              </TableHead>
              <TableHead className="text-[11px] uppercase font-bold">
                N° Guía Shalom
              </TableHead>
              <TableHead className="text-[11px] uppercase font-bold">
                Código
              </TableHead>
              <TableHead className="text-[11px] uppercase font-bold">
                Origen
              </TableHead>
              <TableHead className="text-[11px] uppercase font-bold">
                Destino
              </TableHead>
              <TableHead className="text-[11px] uppercase font-bold">
                DNI
              </TableHead>
              <TableHead className="text-[11px] uppercase font-bold">
                Teléfono
              </TableHead>
              <TableHead className="text-[11px] uppercase font-bold text-right">
                Acciones
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell
                    colSpan={15}
                    className="h-12 animate-pulse bg-muted/20"
                  />
                </TableRow>
              ))
            ) : filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={15}
                  className="h-32 text-center text-muted-foreground"
                >
                  No hay órdenes Shalom
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((item) => {
                const { order, guide } = item;
                const pending = calculatePendingPayment(order);
                return (
                  <TableRow
                    key={order.id}
                    className={
                      selectedSaleIds.has(order.id) ? "bg-orange-50/30" : ""
                    }
                  >
                    <TableCell className="text-center">
                      <input
                        type="checkbox"
                        checked={selectedSaleIds.has(order.id)}
                        onChange={() => handleSelectRow(order.id)}
                      />
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(order.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-center">
                      {(() => {
                        const today = new Date(); today.setHours(0,0,0,0);
                        const created = new Date(order.created_at); created.setHours(0,0,0,0);
                        const days = Math.max(0, Math.floor((today.getTime() - created.getTime()) / 86400000));
                        const color = days <= 3
                          ? "bg-green-50 text-green-700 border-green-200"
                          : days <= 7
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-red-50 text-red-700 border-red-200";
                        return (
                          <Badge variant="outline" className={`text-[10px] font-bold ${color}`}>
                            {days}d
                          </Badge>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-right">
                      {(() => {
                        const pending = calculatePendingPayment(order);
                        if (pending <= 0) {
                          return <span className="text-[10px] font-bold text-green-600">Pagado</span>;
                        }
                        return <span className="text-xs font-bold text-red-600">S/ {pending.toFixed(2)}</span>;
                      })()}
                    </TableCell>
                    <TableCell className="text-center">
                      {(() => {
                        const liveLabel = liveStatuses[order.id];

                        if (liveLabel) {
                          const style = SHALOM_STEP_STYLES[liveLabel] ?? "bg-amber-50 text-amber-700 border-amber-200";
                          const icon = SHALOM_STEP_ICONS[liveLabel] ?? "•";
                          return (
                            <Badge variant="outline" className={`text-[10px] ${style}`}>
                              {icon} {liveLabel}
                            </Badge>
                          );
                        }

                        if (loadingLiveStatuses && order.externalTrackingNumber && order.shippingCode) {
                          return (
                            <Badge variant="outline" className="bg-slate-50 text-slate-400 border-slate-200 text-[10px]">
                              ⏳ Cargando...
                            </Badge>
                          );
                        }

                        const status = order.shalomStatus;
                        if (!status) {
                          return (
                            <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-300 text-[10px]">
                              Sin registrar
                            </Badge>
                          );
                        }
                        if (status === "PENDIENTE" || status === "EXITOSO") {
                          return (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px]">
                              ✅ Registrado
                            </Badge>
                          );
                        }
                        if (status === "FALLIDO") {
                          return (
                            <div className="flex flex-col items-center gap-0.5">
                              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px]">
                                ❌ Fallido
                              </Badge>
                              {order.shalomError && (
                                <span
                                  className="text-[9px] text-red-500 max-w-[140px] truncate"
                                  title={order.shalomError}
                                >
                                  {order.shalomError}
                                </span>
                              )}
                            </div>
                          );
                        }
                        if (status === "EN_TRANSITO") {
                          return (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
                              🚚 En tránsito
                            </Badge>
                          );
                        }
                        if (status === "EN_DESTINO") {
                          return (
                            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px]">
                              📍 En destino
                            </Badge>
                          );
                        }
                        if (status === "EN_REPARTO") {
                          return (
                            <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 text-[10px]">
                              🛵 En reparto
                            </Badge>
                          );
                        }
                        if (status === "ENTREGADO") {
                          return (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                              📦 Entregado
                            </Badge>
                          );
                        }
                        if (status === "DEVUELTO") {
                          return (
                            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-[10px]">
                              🔄 Devuelto
                            </Badge>
                          );
                        }
                        if (status === "CANCELADO") {
                          return (
                            <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-300 text-[10px]">
                              ✖ Cancelado
                            </Badge>
                          );
                        }
                        return (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                            {status}
                          </Badge>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-center min-w-[120px]">
                      <div className="flex items-center justify-center gap-1">
                        {editingKeyId === order.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              className="h-7 w-20 text-[10px] px-1"
                              value={tempKey}
                              onChange={(e) => setTempKey(e.target.value)}
                              autoFocus
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-green-600"
                              onClick={() => handleSaveKey(order.id)}
                              disabled={isUpdatingKey}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-red-600"
                              onClick={() => setEditingKeyId(null)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="group flex items-center gap-1">
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-green-50 text-green-700 border-green-200"
                            >
                              {visibleKeyOrders[order.id]
                                ? order.shippingKey || "-"
                                : "****"}
                            </Badge>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => toggleKeyVisibility(order.id)}
                              title={
                                visibleKeyOrders[order.id]
                                  ? "Ocultar clave"
                                  : "Mostrar clave"
                              }
                            >
                              {visibleKeyOrders[order.id] ? (
                                <EyeOff className="h-3 w-3" />
                              ) : (
                                <Eye className="h-3 w-3" />
                              )}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleStartEditKey(order)}
                              title="Editar clave"
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-bold">
                      {order.orderNumber}
                    </TableCell>
                    <TableCell className="text-xs max-w-[120px] truncate">
                      {order.customer?.fullName}
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {order.externalTrackingNumber ? (
                        <a
                          href={order.trackingUrl || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {order.externalTrackingNumber}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {order.shippingCode || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-xs max-w-[130px] truncate">
                      {order.shalomOriginAgency || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-xs max-w-[130px] truncate">
                      {order.shalomDestinationAgency || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {order.shalomRecipientDoc || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {order.shalomRecipientPhone || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Copiar link de rastreo"
                          onClick={() => {
                            const url = `https://www.powip.lat/rastreo/${order.orderNumber}`;
                            navigator.clipboard.writeText(url);
                            setCopiedOrderId(order.id);
                            setTimeout(() => setCopiedOrderId(null), 2000);
                          }}
                        >
                          {copiedOrderId === order.id
                            ? <Check className="h-4 w-4 text-green-500" />
                            : <Link2 className="h-4 w-4 text-purple-500" />
                          }
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleOpenOrder(item)}
                          title="Detalle Venta"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleOpenNotes(item)}
                          title="Seguimiento Premium"
                        >
                          <ClipboardList className="h-4 w-4 text-blue-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleOpenGuide(item)}
                          title="Gestión Guía"
                        >
                          <Truck className="h-4 w-4" />
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

      <CustomerServiceModal
        open={orderModalOpen}
        onClose={() => setOrderModalOpen(false)}
        orderId={selectedOrderId || ""}
        shippingGuide={selectedGuideData}
        onOrderUpdated={fetchShalomOrders}
        hideCallManagement={true}
      />

      <GuideDetailsModal
        open={guideModalOpen}
        onClose={() => {
          setGuideModalOpen(false);
          fetchShalomOrders();
        }}
        orderId={selectedOrderId || ""}
        onGuideUpdated={fetchShalomOrders}
      />

      <ShippingNotesModal
        open={notesModalOpen}
        onClose={() => setNotesModalOpen(false)}
        guideId={selectedGuideForNotes?.id || ""}
        initialNotes={selectedGuideForNotes?.notes || "[]"}
        onNoteAdded={fetchShalomOrders}
      />

      <PaymentVerificationModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        orderId={selectedOrderId || ""}
        orderNumber={selectedOrderForPayment?.orderNumber || ""}
        onPaymentUpdated={fetchShalomOrders}
        canApprove={true}
      />

      <ShalomPremiumTrackingModal
        open={premiumModalOpen}
        onClose={() => setPremiumModalOpen(false)}
        order={selectedEnvio?.order || null}
        guide={selectedEnvio?.guide}
      />
    </div>
  );
}
