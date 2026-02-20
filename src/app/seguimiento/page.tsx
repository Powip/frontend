"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Eye,
  EyeOff,
  Search,
  Package,
  Phone,
  User,
  Truck,
  FileText,
  AlertTriangle,
  Clock,
  FileDown,
  Loader2,
  Check,
  DollarSign,
  MessageCircle,
  Lock,
  Pencil,
} from "lucide-react";
import {
  exportSeguimientoToExcel,
  SeguimientoExportData,
} from "@/utils/exportSalesExcel";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { HeaderConfig } from "@/components/header/HeaderConfig";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageSquare } from "lucide-react";
import ShippingNotesModal from "@/components/modals/ShippingNotesModal";
import GuideDetailsModal from "@/components/modals/GuideDetailsModal";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import { OrderHeader } from "@/interfaces/IOrder";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast } from "sonner";
import CustomerServiceModal, {
  ShippingGuideData,
} from "@/components/modals/CustomerServiceModal";
import { useRouter } from "next/navigation";
import PaymentVerificationModal from "@/components/modals/PaymentVerificationModal";

/* -----------------------------------------
   Types
----------------------------------------- */

interface ShippingGuide {
  id: string;
  guideNumber: string;
  storeId: string;
  courierId?: string | null;
  courierName?: string | null;
  orderIds: string[];
  status: string;
  chargeType?: string | null;
  amountToCollect?: number | null;
  scheduledDate?: Date | null;
  deliveryZones: string[];
  deliveryType: string;
  deliveryAddress?: string | null;
  notes?: string | null;
  trackingUrl?: string | null;
  externalCarrierId?: string | null;
  externalGuideReference?: string | null;
  shippingKey?: string | null;
  shippingOffice?: string | null;
  shippingProofUrl?: string | null;
  phoneNumber?: string | null;
  clientName?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EnvioItem {
  order: OrderHeader;
  guide?: ShippingGuide | null;
  daysSinceCreated: number;
}

/* -----------------------------------------
   Filters
----------------------------------------- */

interface SeguimientoFilters {
  search: string;
  courier: string;
  startDate: string;
  endDate: string;
  hasPendingPayment: "" | "yes" | "no";
  region: "" | "LIMA" | "PROVINCIA";
  guideStatus: string;
}

const emptyFilters: SeguimientoFilters = {
  search: "",
  courier: "",
  startDate: "",
  endDate: "",
  hasPendingPayment: "",
  region: "",
  guideStatus: "",
};

const COURIERS = [
  "Motorizado Propio",
  "Shalom",
  "Olva Courier",
  "Marvisur",
  "Flores",
];

const GUIDE_STATUSES = [
  { value: "", label: "Todos" },
  { value: "CREADA", label: "Creada" },
  { value: "APROBADA", label: "Aprobada" },
  { value: "ASIGNADA", label: "Asignada" },
  { value: "EN_RUTA", label: "En Ruta" },
  { value: "ENTREGADA", label: "Entregada" },
  { value: "PARCIAL", label: "Parcial" },
  { value: "FALLIDA", label: "Fallida" },
  { value: "CANCELADA", label: "Cancelada" },
];

const GUIDE_STATUS_STYLE: Record<string, string> = {
  CREADA: "bg-gray-100 text-gray-800",
  APROBADA: "bg-teal-100 text-teal-800",
  ASIGNADA: "bg-blue-100 text-blue-800",
  EN_RUTA: "bg-amber-100 text-amber-800",
  ENTREGADA: "bg-green-100 text-green-800",
  PARCIAL: "bg-orange-100 text-orange-800",
  FALLIDA: "bg-red-100 text-red-800",
  CANCELADA: "bg-red-100 text-red-800",
};

/* -----------------------------------------
   Helper functions
----------------------------------------- */
const calculatePendingPayment = (order: OrderHeader): number => {
  if (!order) return 0;
  const grandTotal = parseFloat(order.grandTotal) || 0;
  if (!order.payments) return grandTotal;
  const totalPaid = order.payments
    .filter((p) => p && p.status === "PAID")
    .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  return grandTotal - totalPaid;
};

const getNotesCount = (notesStr?: string | null) => {
  if (!notesStr) return 0;
  try {
    const parsed = JSON.parse(notesStr);
    return Array.isArray(parsed) ? parsed.length : 1;
  } catch (e) {
    return 1; // Si no es JSON, es una nota de texto plano, contar como 1
  }
};

/* -----------------------------------------
   Main Component
----------------------------------------- */

export default function SeguimientoPage() {
  const router = useRouter();
  const [envios, setEnvios] = useState<EnvioItem[]>([]);
  const [entregados, setEntregados] = useState<EnvioItem[]>([]);
  const [guides, setGuides] = useState<ShippingGuide[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingGuides, setLoadingGuides] = useState(false);
  const [filters, setFilters] = useState<SeguimientoFilters>(emptyFilters);
  const [guideSearch, setGuideSearch] = useState("");
  const [guideStatusFilter, setGuideStatusFilter] = useState("");

  // Map of orderId -> orderNumber for quick lookup
  const [orderMap, setOrderMap] = useState<Record<string, string>>({});

  // Modal state for GuideDetailsModal (unified with operaciones)
  const [selectedEnvio, setSelectedEnvio] = useState<EnvioItem | null>(null);
  const [selectedSaleForGuide, setSelectedSaleForGuide] = useState<any | null>(
    null,
  );
  const [guideModalOpen, setGuideModalOpen] = useState(false);

  // Modal state for order detail (CustomerServiceModal) - includes guide data
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedGuideData, setSelectedGuideData] =
    useState<ShippingGuideData | null>(null);

  // Notes Modal state
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [selectedGuideForNotes, setSelectedGuideForNotes] = useState<{
    id: string;
    notes: string;
  } | null>(null);

  // Payment Modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<{
    id: string;
    orderNumber: string;
  } | null>(null);

  // State for inline tracking field editing
  const [trackingEdits, setTrackingEdits] = useState<
    Record<
      string,
      {
        externalTrackingNumber: string;
        shippingCode: string;
        shippingKey: string;
        shippingOffice: string;
      }
    >
  >({});
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});

  const toggleKeyReveal = (orderId: string) => {
    setRevealedKeys((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  const { auth, selectedStoreId } = useAuth();

  // Helper function to check if user is admin
  const isAdmin =
    auth?.user?.role === "ADMIN" || auth?.user?.role === "ADMINISTRADOR";

  // Fetch orders with EN_ENVIO status
  const fetchEnvios = useCallback(async () => {
    if (!selectedStoreId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const ordersRes = await axios.get<OrderHeader[]>(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/store/${selectedStoreId}`,
      );

      const ordersEnEnvio = ordersRes.data.filter(
        (o) => o.status === "EN_ENVIO",
      );
      const ordersEntregado = ordersRes.data.filter(
        (o) => o.status === "ENTREGADO",
      );

      const processOrders = async (orders: OrderHeader[]) => {
        return await Promise.all(
          orders.map(async (order) => {
            let guide: ShippingGuide | null = null;
            let daysSinceCreated = 0;

            if (order.guideNumber) {
              try {
                const guideRes = await axios.get<ShippingGuide>(
                  `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/order/${order.id}`,
                );
                guide = guideRes.data;

                if (guide?.created_at) {
                  const createdDate = new Date(guide.created_at);
                  const today = new Date();
                  const diffTime = Math.abs(
                    today.getTime() - createdDate.getTime(),
                  );
                  daysSinceCreated = Math.ceil(
                    diffTime / (1000 * 60 * 60 * 24),
                  );
                }
              } catch (error) {
                console.error(
                  `Error fetching guide for order ${order.id}:`,
                  error,
                );
              }
            }

            return { order, guide, daysSinceCreated };
          }),
        );
      };

      const [envioItems, entregadoItems] = await Promise.all([
        processOrders(ordersEnEnvio),
        processOrders(ordersEntregado),
      ]);

      setEnvios(envioItems);
      setEntregados(entregadoItems);

      // Initialize tracking edits from all orders
      const edits: Record<
        string,
        {
          externalTrackingNumber: string;
          shippingCode: string;
          shippingKey: string;
          shippingOffice: string;
        }
      > = {};
      [...envioItems, ...entregadoItems].forEach((item) => {
        const o = item.order;
        edits[o.id] = {
          externalTrackingNumber: (o as any).externalTrackingNumber || "",
          shippingCode: (o as any).shippingCode || "",
          shippingKey: (o as any).shippingKey || "",
          shippingOffice: (o as any).shippingOffice || "",
        };
      });
      setTrackingEdits(edits);

      // Update order map
      const mapping: Record<string, string> = {};
      ordersRes.data.forEach((o) => {
        mapping[o.id] = o.orderNumber;
      });
      setOrderMap(mapping);

      // Actualizar modal si está abierto (usando actualización funcional para evitar loop)
      setSelectedEnvio((prev) => {
        if (!prev) return null;
        const updated = envioItems.find(
          (item) => item.order.id === prev.order.id,
        );
        return updated || prev;
      });
    } catch (error) {
      console.error("Error fetching envios:", error);
      toast.error("Error al cargar los envíos");
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId]);

  const fetchGuides = useCallback(async () => {
    if (!selectedStoreId) return;
    setLoadingGuides(true);
    try {
      const res = await axios.get<ShippingGuide[]>(
        `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/store/${selectedStoreId}`,
      );
      setGuides(res.data);
    } catch (error) {
      console.error("Error fetching guides:", error);
      toast.error("Error al cargar las guías");
    } finally {
      setLoadingGuides(false);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    fetchEnvios();
    fetchGuides();
  }, [selectedStoreId, fetchEnvios, fetchGuides]);

  // Apply filters
  const filteredEnvios = useMemo(() => {
    return envios.filter((item) => {
      const { order, guide, daysSinceCreated } = item;

      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const clientName = order.customer?.fullName?.toLowerCase() || "";
        const phone = order.customer?.phoneNumber || "";
        const orderNumber = order.orderNumber?.toLowerCase() || "";
        if (
          !clientName.includes(searchLower) &&
          !phone.includes(filters.search) &&
          !orderNumber.includes(searchLower)
        ) {
          return false;
        }
      }

      // Courier filter (case-insensitive)
      if (filters.courier) {
        const courierName = (
          guide?.courierName ||
          order.courier ||
          ""
        ).toLowerCase();
        if (!courierName.includes(filters.courier.toLowerCase())) {
          return false;
        }
      }

      // Date range filter
      if (filters.startDate || filters.endDate) {
        const itemDate = new Date(guide?.created_at || order.created_at);

        if (filters.startDate) {
          const start = new Date(filters.startDate);
          start.setHours(0, 0, 0, 0);
          if (itemDate < start) return false;
        }

        if (filters.endDate) {
          const end = new Date(filters.endDate);
          end.setHours(23, 59, 59, 999);
          if (itemDate > end) return false;
        }
      }

      // Pending payment filter
      const pendingPayment = calculatePendingPayment(order);
      if (filters.hasPendingPayment === "yes" && pendingPayment <= 0)
        return false;
      if (filters.hasPendingPayment === "no" && pendingPayment > 0)
        return false;

      // Region filter
      if (filters.region && order.salesRegion !== filters.region) return false;

      // Guide status filter
      if (filters.guideStatus && guide?.status !== filters.guideStatus)
        return false;

      return true;
    });
  }, [envios, filters]);

  const filteredEntregados = useMemo(() => {
    return entregados.filter((item) => {
      const { order, guide } = item;

      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const clientName = order.customer?.fullName?.toLowerCase() || "";
        const phone = order.customer?.phoneNumber || "";
        const orderNumber = order.orderNumber?.toLowerCase() || "";
        if (
          !clientName.includes(searchLower) &&
          !phone.includes(filters.search) &&
          !orderNumber.includes(searchLower)
        ) {
          return false;
        }
      }

      // Courier filter (case-insensitive)
      if (filters.courier) {
        const courierName = (
          guide?.courierName ||
          order.courier ||
          ""
        ).toLowerCase();
        if (!courierName.includes(filters.courier.toLowerCase())) {
          return false;
        }
      }

      // Date range filter
      if (filters.startDate || filters.endDate) {
        const itemDate = new Date(guide?.created_at || order.created_at);

        if (filters.startDate) {
          const start = new Date(filters.startDate);
          start.setHours(0, 0, 0, 0);
          if (itemDate < start) return false;
        }

        if (filters.endDate) {
          const end = new Date(filters.endDate);
          end.setHours(23, 59, 59, 999);
          if (itemDate > end) return false;
        }
      }

      // Pending payment filter
      const pendingPayment = calculatePendingPayment(order);
      if (filters.hasPendingPayment === "yes" && pendingPayment <= 0)
        return false;
      if (filters.hasPendingPayment === "no" && pendingPayment > 0)
        return false;

      // Region filter
      if (filters.region && order.salesRegion !== filters.region) return false;

      // Guide status filter
      if (filters.guideStatus && guide?.status !== filters.guideStatus)
        return false;

      return true;
    });
  }, [entregados, filters]);

  const filteredGuidesList = useMemo(() => {
    return guides.filter((guide) => {
      // Búsqueda por N° Guía o N° Orden
      if (guideSearch) {
        const searchLower = guideSearch.toLowerCase();
        const matchesGuideNumber = guide.guideNumber
          .toLowerCase()
          .includes(searchLower);

        // Buscar si algún orderNumber en el mapa coincide con el término
        const matchesOrderNumber = guide.orderIds.some((id) => {
          const orderNum = orderMap[id]?.toLowerCase() || "";
          return orderNum.includes(searchLower);
        });

        if (!matchesGuideNumber && !matchesOrderNumber) return false;
      }

      // Filtro por estado
      if (guideStatusFilter && guide.status !== guideStatusFilter) {
        return false;
      }

      return true;
    });
  }, [guides, guideSearch, guideStatusFilter, orderMap]);

  const updateFilter = <K extends keyof SeguimientoFilters>(
    key: K,
    value: SeguimientoFilters[K],
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
  };

  // Update tracking field locally
  const updateTrackingField = (
    orderId: string,
    field: keyof (typeof trackingEdits)[string],
    value: string,
  ) => {
    setTrackingEdits((prev) => ({
      ...prev,
      [orderId]: {
        ...prev[orderId],
        [field]: value,
      },
    }));
  };

  // Check if tracking data has changed for an order
  const hasTrackingChanges = (orderId: string): boolean => {
    const current = trackingEdits[orderId];
    const envioItem = envios.find((e) => e.order.id === orderId);
    if (!current || !envioItem) return false;

    const original = {
      externalTrackingNumber:
        (envioItem.order as any).externalTrackingNumber || "",
      shippingCode: (envioItem.order as any).shippingCode || "",
      shippingKey: (envioItem.order as any).shippingKey || "",
      shippingOffice: (envioItem.order as any).shippingOffice || "",
    };

    return (
      current.externalTrackingNumber !== original.externalTrackingNumber ||
      current.shippingCode !== original.shippingCode ||
      current.shippingKey !== original.shippingKey ||
      current.shippingOffice !== original.shippingOffice
    );
  };

  // Save tracking fields for an order - only if changed
  const handleSaveTracking = async (orderId: string) => {
    // Only save if there are actual changes
    if (!hasTrackingChanges(orderId)) return;

    const data = trackingEdits[orderId];
    if (!data) return;

    setSavingOrderId(orderId);
    try {
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`,
        {
          externalTrackingNumber: data.externalTrackingNumber || null,
          shippingCode: data.shippingCode || null,
          shippingKey: data.shippingKey || null,
          shippingOffice: data.shippingOffice || null,
        },
      );
      // Update local state to sync original values (avoids table refresh)
      setEnvios((prev) =>
        prev.map((item) =>
          item.order.id === orderId
            ? {
                ...item,
                order: {
                  ...item.order,
                  externalTrackingNumber: data.externalTrackingNumber || null,
                  shippingCode: data.shippingCode || null,
                  shippingKey: data.shippingKey || null,
                  shippingOffice: data.shippingOffice || null,
                } as any,
              }
            : item,
        ),
      );
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Error al guardar tracking",
      );
    } finally {
      setSavingOrderId(null);
    }
  };

  const handleOpenGuide = (item: EnvioItem) => {
    setSelectedEnvio(item);
    setGuideModalOpen(true);
  };

  const handleOpenOrder = (item: EnvioItem) => {
    setSelectedOrderId(item.order.id);

    // Map guide data to ShippingGuideData format
    if (item.guide) {
      setSelectedGuideData({
        id: item.guide.id,
        guideNumber: item.guide.guideNumber,
        courierName: item.guide.courierName,
        status: item.guide.status,
        chargeType: item.guide.chargeType,
        amountToCollect: item.guide.amountToCollect,
        scheduledDate: item.guide.scheduledDate?.toString() || null,
        deliveryZone: item.guide.deliveryZones
          ? item.guide.deliveryZones[0]
          : "",
        deliveryType: item.guide.deliveryType,
        deliveryAddress: item.guide.deliveryAddress,
        notes: item.guide.notes,
        trackingUrl: item.guide.trackingUrl,
        shippingKey: item.guide.shippingKey,
        shippingOffice: item.guide.shippingOffice,
        shippingProofUrl: item.guide.shippingProofUrl,
        created_at: item.guide.created_at,
        daysSinceCreated: item.daysSinceCreated,
      });
    } else {
      setSelectedGuideData(null);
    }

    setOrderModalOpen(true);
  };

  const getDaysColor = (days: number) => {
    if (days >= 30) return "text-red-600 font-bold";
    if (days >= 25) return "text-amber-600 font-bold";
    if (days >= 16) return "text-orange-500 font-medium";
    return "text-muted-foreground";
  };

  const getDaysRowClass = (days: number) => {
    if (days >= 30)
      return "bg-red-50 dark:bg-red-950/30 border-l-4 border-l-red-500";
    if (days >= 25)
      return "bg-amber-50 dark:bg-amber-950/30 border-l-4 border-l-amber-500";
    return "";
  };

  const handleExportExcel = (dataList: EnvioItem[], tabTitle: string) => {
    if (dataList.length === 0) {
      toast.warning("No hay datos para exportar");
      return;
    }

    const flatData: SeguimientoExportData[] = dataList.map((item) => {
      const { order, guide, daysSinceCreated } = item;
      const pendingPayment = calculatePendingPayment(order);
      const totalPaid = parseFloat(order.grandTotal || "0") - pendingPayment;

      return {
        orderNumber: order.orderNumber,
        trackingLink: `https://www.powip.lat/rastreo/${order.orderNumber}`,
        clientName: order.customer?.fullName || "-",
        phoneNumber: order.customer?.phoneNumber || "-",
        documentType: order.customer?.documentType || "-",
        documentNumber: order.customer?.documentNumber || "-",
        date: order.created_at
          ? new Date(order.created_at).toLocaleDateString("es-PE")
          : "-",
        total: parseFloat(order.grandTotal || "0"),
        advancePayment: totalPaid,
        pendingPayment: pendingPayment,
        status: order.status,
        salesRegion: order.salesRegion,
        province: order.customer?.province || "-",
        city: order.customer?.city || "-",
        district: order.customer?.district || "-",
        zone: order.customer?.zone || "-",
        address: order.customer?.address || "-",
        paymentMethod: "-",
        deliveryType: order.deliveryType || "-",
        courier: guide?.courierName || order.courier || "-",
        guideNumber: guide?.guideNumber || order.guideNumber || "-",
        guideStatus: guide?.status || "-",
        externalTrackingNumber: (order as any).externalTrackingNumber || "-",
        shippingCode: (order as any).shippingCode || "-",
        shippingKey: (order as any).shippingKey || "",
        shippingOffice: (order as any).shippingOffice || "-",
        sellerName: order.sellerName || "-",
        daysSinceCreated: daysSinceCreated,
      };
    });

    exportSeguimientoToExcel(flatData, `seguimiento_${tabTitle}`);
    toast.success(`Exportados ${flatData.length} registros`);
  };

  const handleOpenGuideDetails = (guide: ShippingGuide) => {
    // Map to EnvioItem format for reuse or create a similar modal handler
    // Actually GuideDetailsModal takes selectedSaleForGuide as Sale | null
    // and guide as ShippingGuideData | null.
    // Let's check its props in GuideDetailsModal.
    // In operations it's used like:
    // <GuideDetailsModal open={...} onClose={...} sale={selectedSaleForGuide} guide={selectedGuideData} ... />

    // For this view, we don't necessarily have a single "sale" but many
    setSelectedGuideData({
      id: guide.id,
      guideNumber: guide.guideNumber,
      courierName: guide.courierName,
      status: guide.status,
      chargeType: guide.chargeType,
      amountToCollect: guide.amountToCollect,
      scheduledDate: guide.scheduledDate?.toString() || null,
      deliveryZone: guide.deliveryZones ? guide.deliveryZones[0] : "",
      deliveryType: guide.deliveryType,
      deliveryAddress: guide.deliveryAddress,
      notes: guide.notes,
      trackingUrl: guide.trackingUrl,
      shippingKey: guide.shippingKey,
      shippingOffice: guide.shippingOffice,
      shippingProofUrl: guide.shippingProofUrl,
      created_at: guide.created_at,
      daysSinceCreated: 0, // Not used here
    });
    setSelectedOrderId(guide.orderIds[0] || "");
    setGuideModalOpen(true);
  };

  const handleStatusChange = async (
    guideId: string,
    newStatus: string,
    pendingPayment: number,
  ) => {
    // Validación: No permitir ENTREGADA si hay saldo pendiente
    if (newStatus === "ENTREGADA" && pendingPayment > 0) {
      toast.error("No se puede marcar como ENTREGADA si hay saldo pendiente", {
        description: `Saldo pendiente: S/ ${pendingPayment.toFixed(2)}`,
        duration: 4000,
      });
      return;
    }

    try {
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/${guideId}`,
        { status: newStatus },
      );
      toast.success(`Estado actualizado a ${newStatus}`);
      fetchEnvios();
    } catch (error: any) {
      const message =
        error?.response?.data?.message || "Error al cambiar estado";
      toast.error(message);
    }
  };

  const handleOpenNotes = (guide: ShippingGuide) => {
    setSelectedGuideForNotes({ id: guide.id, notes: guide.notes || "[]" });
    setNotesModalOpen(true);
  };

  const handleOpenPaymentModal = (orderId: string, orderNumber: string) => {
    setSelectedOrderForPayment({ id: orderId, orderNumber });
    setPaymentModalOpen(true);
  };

  const handleWhatsApp = (
    phoneNumber: string,
    orderNumber?: string,
    clientName?: string,
  ) => {
    const phone = phoneNumber.replace(/\D/g, "");
    const cleanPhone = phone.startsWith("51") ? phone : `51${phone}`;

    let message = `Hola${clientName ? ` ${clientName}` : ""}! `;
    if (orderNumber) {
      const trackingUrl = `${process.env.NEXT_PUBLIC_LANDING_URL}/rastreo/${orderNumber}`;
      message += `Te contactamos por tu pedido ${orderNumber}.\n\nPuedes rastrear tu pedido aquí: ${trackingUrl}`;
    }

    window.open(
      `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`,
      "_blank",
    );
  };

  if (!auth) return null;

  return (
    <div className="flex h-screen w-full">
      <main className="flex-1 p-6 space-y-6 overflow-auto">
        <div className="flex flex-col items-center mb-6">
          <HeaderConfig
            title="Seguimiento de Envíos"
            description="Monitoreo de pedidos en tránsito"
          />
        </div>

        <Tabs defaultValue="pedidos" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="pedidos" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Pedidos en Envío
            </TabsTrigger>
            <TabsTrigger value="entregados" className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              Entregados
            </TabsTrigger>
            <TabsTrigger value="guias" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Guías de Envío
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pedidos">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Pedidos En Envío ({filteredEnvios.length})
                </CardTitle>
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExportExcel(filteredEnvios, "pedidos")}
                    disabled={filteredEnvios.length === 0}
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    Exportar Excel
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {/* Filters */}
                <div className="mb-4 p-4 border rounded-lg bg-muted/30">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {/* Search */}
                    <div className="space-y-1 col-span-2">
                      <Label className="text-xs">
                        Buscar (cliente, teléfono, N° orden)
                      </Label>
                      <Input
                        placeholder="Buscar..."
                        value={filters.search || ""}
                        onChange={(e) => updateFilter("search", e.target.value)}
                        icon={Search}
                        iconPosition="left"
                        className="h-8 text-sm"
                      />
                    </div>

                    {/* Courier */}
                    <div className="space-y-1">
                      <Label className="text-xs">Courier</Label>
                      <select
                        className="w-full h-8 text-sm border rounded-md px-2 bg-background text-foreground"
                        value={filters.courier}
                        onChange={(e) =>
                          updateFilter("courier", e.target.value)
                        }
                      >
                        <option value="">Todos</option>
                        {COURIERS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Days Range */}
                    {/* Fecha: Desde */}
                    <div className="space-y-1">
                      <Label className="text-xs">Desde</Label>
                      <Input
                        type="date"
                        value={filters.startDate || ""}
                        onChange={(e) =>
                          updateFilter("startDate", e.target.value)
                        }
                        className="h-8 text-sm"
                      />
                    </div>

                    {/* Fecha: Hasta */}
                    <div className="space-y-1">
                      <Label className="text-xs">Hasta</Label>
                      <Input
                        type="date"
                        value={filters.endDate || ""}
                        onChange={(e) =>
                          updateFilter("endDate", e.target.value)
                        }
                        className="h-8 text-sm"
                      />
                    </div>

                    {/* Pending Payment */}
                    <div className="space-y-1">
                      <Label className="text-xs">Saldo pendiente</Label>
                      <select
                        className="w-full h-8 text-sm border rounded-md px-2 bg-background text-foreground"
                        value={filters.hasPendingPayment}
                        onChange={(e) =>
                          updateFilter(
                            "hasPendingPayment",
                            e.target.value as "" | "yes" | "no",
                          )
                        }
                      >
                        <option value="">Todos</option>
                        <option value="yes">Con saldo</option>
                        <option value="no">Sin saldo</option>
                      </select>
                    </div>

                    {/* Region */}
                    <div className="space-y-1">
                      <Label className="text-xs">Región</Label>
                      <select
                        className="w-full h-8 text-sm border rounded-md px-2 bg-background text-foreground"
                        value={filters.region}
                        onChange={(e) =>
                          updateFilter(
                            "region",
                            e.target.value as "" | "LIMA" | "PROVINCIA",
                          )
                        }
                      >
                        <option value="">Todas</option>
                        <option value="LIMA">Lima</option>
                        <option value="PROVINCIA">Provincia</option>
                      </select>
                    </div>

                    {/* Guide Status */}
                    <div className="space-y-1">
                      <Label className="text-xs">Estado Envío</Label>
                      <select
                        className="w-full h-8 text-sm border rounded-md px-2 bg-background text-foreground"
                        value={filters.guideStatus}
                        onChange={(e) =>
                          updateFilter("guideStatus", e.target.value)
                        }
                      >
                        {GUIDE_STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {Object.values(filters).some((v) => v !== "") && (
                    <div className="mt-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="text-xs"
                      >
                        Limpiar filtros
                      </Button>
                    </div>
                  )}
                </div>

                {/* Table */}
                {loading ? (
                  <div className="text-center py-10 text-muted-foreground">
                    Cargando envíos...
                  </div>
                ) : filteredEnvios.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    No hay pedidos en envío
                  </div>
                ) : (
                  <div className="overflow-x-auto border rounded-md relative scrollbar-thin scrollbar-thumb-muted-foreground/20">
                    <Table className="min-w-[1500px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[110px] min-w-[110px] lg:sticky lg:left-0 lg:z-30 bg-background border-r">
                            N° Orden
                          </TableHead>
                          <TableHead className="w-[160px] min-w-[160px] lg:sticky lg:left-[110px] lg:z-30 bg-background border-r">
                            Cliente
                          </TableHead>
                          <TableHead className="w-[120px] min-w-[120px] lg:sticky lg:left-[270px] lg:z-30 bg-background border-r">
                            Teléfono
                          </TableHead>
                          <TableHead className="w-[100px] min-w-[100px]">
                            Región
                          </TableHead>
                          <TableHead className="w-[120px] min-w-[120px]">
                            Enviado Por
                          </TableHead>
                          <TableHead className="w-[100px] min-w-[100px]">
                            Fecha
                          </TableHead>
                          <TableHead className="w-[120px] min-w-[120px]">
                            Vendedor
                          </TableHead>
                          <TableHead className="w-[100px] min-w-[100px]">
                            Costo Carrier
                          </TableHead>

                          <TableHead className="w-[100px] min-w-[100px]">
                            Días
                          </TableHead>
                          <TableHead className="w-[140px] min-w-[140px]">
                            Estado Envío
                          </TableHead>
                          <TableHead className="w-[120px] min-w-[120px]">
                            Nro Tracking
                          </TableHead>
                          <TableHead className="w-[80px] min-w-[80px]">
                            Código
                          </TableHead>
                          <TableHead className="w-[80px] min-w-[80px]">
                            Clave
                          </TableHead>
                          <TableHead className="w-[130px] min-w-[130px]">
                            Oficina
                          </TableHead>
                          <TableHead className="w-[100px] min-w-[100px] lg:sticky lg:right-[180px] lg:z-30 bg-background border-l">
                            Saldo
                          </TableHead>
                          <TableHead className="w-[60px] min-w-[60px] lg:sticky lg:right-[120px] lg:z-30 bg-background border-l">
                            Pagos
                          </TableHead>
                          <TableHead className="w-[120px] min-w-[120px] lg:sticky lg:right-[60px] lg:z-30 bg-background border-l">
                            Guía
                          </TableHead>
                          <TableHead className="text-right lg:sticky lg:right-0 lg:z-40 bg-background border-l">
                            Acciones
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEnvios.map((item) => {
                          const { order, guide, daysSinceCreated } = item;
                          const pendingPayment = calculatePendingPayment(order);
                          const isProvincia = order.salesRegion === "PROVINCIA";

                          return (
                            <TableRow
                              key={order.id}
                              className={`hover:bg-muted/50 ${getDaysRowClass(daysSinceCreated)} ${isProvincia && daysSinceCreated < 25 ? "bg-amber-50/50 dark:bg-amber-950/20" : ""}`}
                            >
                              <TableCell className="font-medium w-[110px] min-w-[110px] lg:sticky lg:left-0 lg:z-20 bg-background border-r">
                                <div className="flex items-center gap-1">
                                  {daysSinceCreated >= 25 && (
                                    <AlertTriangle
                                      className={`h-4 w-4 ${daysSinceCreated >= 30 ? "text-red-500" : "text-amber-500"}`}
                                    />
                                  )}
                                  {order.orderNumber}
                                </div>
                              </TableCell>
                              <TableCell className="w-[160px] min-w-[160px] lg:sticky lg:left-[110px] lg:z-20 bg-background border-r">
                                <div className="flex items-center gap-1 group relative">
                                  <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                  <span
                                    className="truncate max-w-[130px]"
                                    title={order.customer?.fullName || "-"}
                                  >
                                    {order.customer?.fullName || "-"}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="w-[120px] min-w-[120px] lg:sticky lg:left-[270px] lg:z-20 bg-background border-r">
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1">
                                    <Phone className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                    <span className="text-sm truncate">
                                      {order.customer?.phoneNumber || "-"}
                                    </span>
                                  </div>
                                  {order.customer?.phoneNumber && (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6 bg-green-500 hover:bg-green-600 text-white rounded-full shadow-sm transition-all flex-shrink-0"
                                      onClick={() =>
                                        handleWhatsApp(
                                          order.customer.phoneNumber || "",
                                          order.orderNumber,
                                          order.customer.fullName,
                                        )
                                      }
                                      title="WhatsApp"
                                    >
                                      <MessageCircle className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="w-[100px] min-w-[100px]">
                                <Badge
                                  variant={
                                    isProvincia ? "secondary" : "outline"
                                  }
                                >
                                  {order.salesRegion}
                                </Badge>
                              </TableCell>
                              <TableCell className="w-[120px] min-w-[120px]">
                                <div className="flex items-center gap-1 truncate">
                                  <Truck className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                  <span
                                    className="truncate"
                                    title={
                                      guide?.courierName || order.courier || "-"
                                    }
                                  >
                                    {guide?.courierName || order.courier || "-"}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="w-[100px] min-w-[100px]">
                                {guide?.created_at
                                  ? new Date(
                                      guide.created_at,
                                    ).toLocaleDateString("es-PE")
                                  : "-"}
                              </TableCell>
                              <TableCell className="w-[120px] min-w-[120px]">
                                <span
                                  className="text-xs truncate"
                                  title={order.sellerName || "-"}
                                >
                                  {order.sellerName || "-"}
                                </span>
                              </TableCell>
                              <TableCell className="w-[100px] min-w-[100px]">
                                S/{" "}
                                {Number(order.carrierShippingCost || 0).toFixed(
                                  2,
                                )}
                              </TableCell>
                              <TableCell className="w-[100px] min-w-[100px]">
                                <div className="flex items-center gap-1">
                                  {daysSinceCreated >= 25 && (
                                    <Clock
                                      className={`h-3 w-3 ${daysSinceCreated >= 30 ? "text-red-500" : "text-amber-500"}`}
                                    />
                                  )}
                                  <span
                                    className={getDaysColor(daysSinceCreated)}
                                  >
                                    {daysSinceCreated} días
                                  </span>
                                  {daysSinceCreated >= 30 && (
                                    <Badge className="ml-1 bg-red-600 text-white text-[10px] px-1 py-0">
                                      VENCIDO
                                    </Badge>
                                  )}
                                  {daysSinceCreated >= 25 &&
                                    daysSinceCreated < 30 && (
                                      <Badge className="ml-1 bg-amber-500 text-white text-[10px] px-1 py-0">
                                        PRÓXIMO
                                      </Badge>
                                    )}
                                </div>
                              </TableCell>
                              <TableCell className="w-[140px] min-w-[140px]">
                                <Select
                                  value={guide?.status || "CREADA"}
                                  onValueChange={(val) =>
                                    guide &&
                                    handleStatusChange(
                                      guide.id,
                                      val,
                                      pendingPayment,
                                    )
                                  }
                                  disabled={!guide}
                                >
                                  <SelectTrigger
                                    className={`h-8 w-[130px] text-xs font-semibold ${
                                      (guide?.status &&
                                        GUIDE_STATUS_STYLE[guide.status]) ||
                                      "bg-gray-100 text-gray-800 border-gray-200"
                                    }`}
                                  >
                                    <SelectValue placeholder="Estado" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="CREADA">
                                      Creada
                                    </SelectItem>
                                    <SelectItem value="APROBADA">
                                      Aprobada
                                    </SelectItem>
                                    <SelectItem value="ASIGNADA">
                                      Asignada
                                    </SelectItem>
                                    <SelectItem value="EN_RUTA">
                                      En Ruta
                                    </SelectItem>
                                    <SelectItem value="ENTREGADA">
                                      Entregada
                                    </SelectItem>
                                    <SelectItem value="PARCIAL">
                                      Parcial
                                    </SelectItem>
                                    <SelectItem value="FALLIDA">
                                      Fallida
                                    </SelectItem>
                                    <SelectItem value="CANCELADA">
                                      Cancelada
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              {/* Nro Tracking */}
                              <TableCell className="w-[120px] min-w-[120px]">
                                <div className="relative flex items-center">
                                  <input
                                    type="text"
                                    className={`w-full h-7 px-1.5 text-xs border rounded bg-background transition-all ${
                                      savingOrderId === order.id
                                        ? "opacity-50 border-orange-400 pr-6"
                                        : "focus:border-orange-500"
                                    }`}
                                    placeholder="Nro..."
                                    value={
                                      trackingEdits[order.id]
                                        ?.externalTrackingNumber || ""
                                    }
                                    onChange={(e) =>
                                      updateTrackingField(
                                        order.id,
                                        "externalTrackingNumber",
                                        e.target.value,
                                      )
                                    }
                                    onBlur={() => handleSaveTracking(order.id)}
                                    disabled={savingOrderId === order.id}
                                  />
                                  {savingOrderId === order.id && (
                                    <Loader2 className="absolute right-1.5 h-3 w-3 animate-spin text-orange-500" />
                                  )}
                                </div>
                              </TableCell>
                              {/* Código */}
                              <TableCell className="w-[80px] min-w-[80px]">
                                <div className="relative flex items-center">
                                  <input
                                    type="text"
                                    className={`w-full h-7 px-1.5 text-xs border rounded bg-background transition-all ${
                                      savingOrderId === order.id
                                        ? "opacity-50 border-orange-400 pr-5"
                                        : "focus:border-orange-500"
                                    }`}
                                    placeholder="Código"
                                    value={
                                      trackingEdits[order.id]?.shippingCode ||
                                      ""
                                    }
                                    onChange={(e) =>
                                      updateTrackingField(
                                        order.id,
                                        "shippingCode",
                                        e.target.value,
                                      )
                                    }
                                    onBlur={() => handleSaveTracking(order.id)}
                                    disabled={savingOrderId === order.id}
                                  />
                                </div>
                              </TableCell>
                              {/* Clave */}
                              <TableCell className="w-[100px] min-w-[100px]">
                                <div className="relative flex items-center group">
                                  <input
                                    type={
                                      pendingPayment > 0 &&
                                      !revealedKeys[order.id]
                                        ? "password"
                                        : "text"
                                    }
                                    className={`w-full h-7 px-1.5 pr-7 text-xs border rounded bg-background transition-all ${
                                      pendingPayment > 0
                                        ? "border-red-300 focus:border-red-500 bg-red-50/30"
                                        : "focus:border-orange-500"
                                    } ${
                                      savingOrderId === order.id
                                        ? "opacity-50 border-orange-400"
                                        : ""
                                    }`}
                                    placeholder="Clave"
                                    value={
                                      trackingEdits[order.id]?.shippingKey || ""
                                    }
                                    onChange={(e) =>
                                      updateTrackingField(
                                        order.id,
                                        "shippingKey",
                                        e.target.value,
                                      )
                                    }
                                    onBlur={() => handleSaveTracking(order.id)}
                                    disabled={savingOrderId === order.id}
                                  />
                                  {pendingPayment > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => toggleKeyReveal(order.id)}
                                      className="absolute right-1 text-red-400 hover:text-red-600 focus:outline-none"
                                      title={
                                        revealedKeys[order.id]
                                          ? "Ocultar clave"
                                          : "Revelar clave"
                                      }
                                    >
                                      {revealedKeys[order.id] ? (
                                        <EyeOff className="h-3.5 w-3.5" />
                                      ) : (
                                        <Eye className="h-3.5 w-3.5" />
                                      )}
                                    </button>
                                  )}
                                  {savingOrderId === order.id &&
                                    pendingPayment <= 0 && (
                                      <Loader2 className="absolute right-1 h-3 w-3 animate-spin text-orange-500" />
                                    )}
                                </div>
                              </TableCell>
                              {/* Oficina */}
                              <TableCell className="w-[130px] min-w-[130px]">
                                <div className="relative flex items-center">
                                  <input
                                    type="text"
                                    className={`w-full h-7 px-1.5 text-xs border rounded bg-background transition-all ${
                                      savingOrderId === order.id
                                        ? "opacity-50 border-orange-400 pr-6"
                                        : "focus:border-orange-500"
                                    }`}
                                    placeholder="Oficina..."
                                    value={
                                      trackingEdits[order.id]?.shippingOffice ||
                                      ""
                                    }
                                    onChange={(e) =>
                                      updateTrackingField(
                                        order.id,
                                        "shippingOffice",
                                        e.target.value,
                                      )
                                    }
                                    onBlur={() => handleSaveTracking(order.id)}
                                    disabled={savingOrderId === order.id}
                                  />
                                </div>
                              </TableCell>
                              <TableCell className="w-[100px] min-w-[100px] lg:sticky lg:right-[180px] lg:z-20 bg-background border-l">
                                {pendingPayment > 0 ? (
                                  <Badge className="bg-red-100 text-red-800">
                                    S/ {pendingPayment.toFixed(2)}
                                  </Badge>
                                ) : (
                                  <Badge className="bg-green-100 text-green-800">
                                    Pagado
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="w-[60px] min-w-[60px] lg:sticky lg:right-[120px] lg:z-20 bg-background border-l text-center">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0 bg-white border-amber-200 hover:bg-amber-50 hover:border-amber-300 shadow-sm transition-all mx-auto"
                                  onClick={() =>
                                    handleOpenPaymentModal(
                                      order.id,
                                      order.orderNumber,
                                    )
                                  }
                                  title="Gestionar Pagos"
                                >
                                  <DollarSign className="h-4 w-4 text-amber-600" />
                                </Button>
                              </TableCell>
                              <TableCell className="w-[120px] min-w-[120px] lg:sticky lg:right-[60px] lg:z-20 bg-background border-l">
                                {guide?.guideNumber || order.guideNumber ? (
                                  <Badge
                                    className="bg-green-100 text-green-800 cursor-pointer hover:bg-green-200"
                                    onClick={() => handleOpenGuide(item)}
                                  >
                                    <Truck className="h-3 w-3 mr-1" />
                                    {guide?.guideNumber || order.guideNumber}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">
                                    -
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-right lg:sticky lg:right-0 lg:z-30 bg-background border-l">
                                <div className="flex justify-end items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => handleOpenOrder(item)}
                                    title="Ver Detalle"
                                  >
                                    <Eye className="h-4 w-4 text-muted-foreground" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="relative h-8 w-8 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (guide) handleOpenNotes(guide);
                                    }}
                                    disabled={!guide}
                                    title="Notas de Envío"
                                  >
                                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                    {getNotesCount(guide?.notes) > 0 && (
                                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-bold border-2 border-background">
                                        {getNotesCount(guide?.notes)}
                                      </span>
                                    )}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="entregados">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-600" />
                  Pedidos Entregados ({filteredEntregados.length})
                </CardTitle>
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handleExportExcel(filteredEntregados, "entregados")
                    }
                    disabled={filteredEntregados.length === 0}
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    Exportar Excel
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {/* Filters */}
                <div className="mb-4 p-4 border rounded-lg bg-muted/30">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {/* Search */}
                    <div className="space-y-1 col-span-2">
                      <Label className="text-xs">
                        Buscar (cliente, teléfono, N° orden)
                      </Label>
                      <Input
                        placeholder="Buscar..."
                        value={filters.search || ""}
                        onChange={(e) => updateFilter("search", e.target.value)}
                        icon={Search}
                        iconPosition="left"
                        className="h-8 text-sm"
                      />
                    </div>

                    {/* Courier */}
                    <div className="space-y-1">
                      <Label className="text-xs">Courier</Label>
                      <select
                        className="w-full h-8 text-sm border rounded-md px-2 bg-background text-foreground"
                        value={filters.courier}
                        onChange={(e) =>
                          updateFilter("courier", e.target.value)
                        }
                      >
                        <option value="">Todos</option>
                        {COURIERS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Fecha: Desde */}
                    <div className="space-y-1">
                      <Label className="text-xs">Desde</Label>
                      <Input
                        type="date"
                        value={filters.startDate || ""}
                        onChange={(e) =>
                          updateFilter("startDate", e.target.value)
                        }
                        className="h-8 text-sm"
                      />
                    </div>

                    {/* Fecha: Hasta */}
                    <div className="space-y-1">
                      <Label className="text-xs">Hasta</Label>
                      <Input
                        type="date"
                        value={filters.endDate || ""}
                        onChange={(e) =>
                          updateFilter("endDate", e.target.value)
                        }
                        className="h-8 text-sm"
                      />
                    </div>

                    {/* Pending Payment */}
                    <div className="space-y-1">
                      <Label className="text-xs">Saldo pendiente</Label>
                      <select
                        className="w-full h-8 text-sm border rounded-md px-2 bg-background text-foreground"
                        value={filters.hasPendingPayment}
                        onChange={(e) =>
                          updateFilter(
                            "hasPendingPayment",
                            e.target.value as "" | "yes" | "no",
                          )
                        }
                      >
                        <option value="">Todos</option>
                        <option value="yes">Con saldo</option>
                        <option value="no">Sin saldo</option>
                      </select>
                    </div>

                    {/* Region */}
                    <div className="space-y-1">
                      <Label className="text-xs">Región</Label>
                      <select
                        className="w-full h-8 text-sm border rounded-md px-2 bg-background text-foreground"
                        value={filters.region}
                        onChange={(e) =>
                          updateFilter(
                            "region",
                            e.target.value as "" | "LIMA" | "PROVINCIA",
                          )
                        }
                      >
                        <option value="">Todas</option>
                        <option value="LIMA">Lima</option>
                        <option value="PROVINCIA">Provincia</option>
                      </select>
                    </div>

                    {/* Guide Status */}
                    <div className="space-y-1">
                      <Label className="text-xs">Estado Envío</Label>
                      <select
                        className="w-full h-8 text-sm border rounded-md px-2 bg-background text-foreground"
                        value={filters.guideStatus}
                        onChange={(e) =>
                          updateFilter("guideStatus", e.target.value)
                        }
                      >
                        {GUIDE_STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {Object.values(filters).some((v) => v !== "") && (
                    <div className="mt-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="text-xs"
                      >
                        Limpiar filtros
                      </Button>
                    </div>
                  )}
                </div>

                {loading ? (
                  <div className="text-center py-10 text-muted-foreground">
                    Cargando entregados...
                  </div>
                ) : filteredEntregados.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    No hay pedidos entregados para los filtros seleccionados
                  </div>
                ) : (
                  <div className="overflow-x-auto border rounded-md relative scrollbar-thin scrollbar-thumb-muted-foreground/20">
                    <Table className="min-w-[1500px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[110px] min-w-[110px] lg:sticky lg:left-0 lg:z-30 bg-background border-r">
                            N° Orden
                          </TableHead>
                          <TableHead className="w-[160px] min-w-[160px] lg:sticky lg:left-[110px] lg:z-30 bg-background border-r">
                            Cliente
                          </TableHead>
                          <TableHead className="w-[120px] min-w-[120px] lg:sticky lg:left-[270px] lg:z-30 bg-background border-r">
                            Teléfono
                          </TableHead>
                          <TableHead className="w-[100px] min-w-[100px]">
                            Fecha
                          </TableHead>
                          <TableHead className="w-[120px] min-w-[120px]">
                            Pago
                          </TableHead>
                          <TableHead className="w-[120px] min-w-[120px]">
                            Envío
                          </TableHead>
                          <TableHead className="w-[100px] min-w-[100px]">
                            Total
                          </TableHead>
                          <TableHead className="w-[100px] min-w-[100px]">
                            Adelanto
                          </TableHead>
                          <TableHead className="w-[100px] min-w-[100px]">
                            Por Cobrar
                          </TableHead>
                          <TableHead className="w-[100px] min-w-[100px]">
                            Costo Carrier
                          </TableHead>
                          <TableHead className="w-[100px] min-w-[100px]">
                            Estado
                          </TableHead>
                          <TableHead className="w-[100px] min-w-[100px]">
                            Region
                          </TableHead>
                          <TableHead className="w-[120px] min-w-[120px]">
                            Distrito
                          </TableHead>
                          <TableHead className="w-[150px] min-w-[150px]">
                            Resumen
                          </TableHead>
                          <TableHead className="text-right lg:sticky lg:right-0 lg:z-40 bg-background border-l">
                            Acciones
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEntregados.map((item) => {
                          const { order, guide } = item;
                          const pendingPayment = calculatePendingPayment(order);
                          const isProvincia = order.salesRegion === "PROVINCIA";

                          return (
                            <TableRow
                              key={order.id}
                              className="hover:bg-muted/50"
                            >
                              <TableCell className="font-medium w-[110px] min-w-[110px] lg:sticky lg:left-0 lg:z-20 bg-background border-r">
                                {order.orderNumber}
                              </TableCell>
                              <TableCell className="w-[160px] min-w-[160px] lg:sticky lg:left-[110px] lg:z-20 bg-background border-r">
                                <span
                                  className="truncate max-w-[130px]"
                                  title={order.customer?.fullName || "-"}
                                >
                                  {order.customer?.fullName || "-"}
                                </span>
                              </TableCell>
                              <TableCell className="w-[120px] min-w-[120px] lg:sticky lg:left-[270px] lg:z-20 bg-background border-r">
                                <span className="text-sm">
                                  {order.customer?.phoneNumber || "-"}
                                </span>
                              </TableCell>
                              <TableCell className="w-[100px] min-w-[100px] text-xs">
                                {order.created_at
                                  ? new Date(
                                      order.created_at,
                                    ).toLocaleDateString()
                                  : "-"}
                              </TableCell>
                              <TableCell className="w-[120px] min-w-[120px] text-xs">
                                {order.payments && order.payments.length > 0
                                  ? order.payments
                                      .map((p) => p.paymentMethod)
                                      .filter((v, i, a) => a.indexOf(v) === i)
                                      .join(", ")
                                  : "-"}
                              </TableCell>
                              <TableCell className="w-[120px] min-w-[120px] text-xs">
                                {guide?.courierName || order.courier || "-"}
                              </TableCell>
                              <TableCell className="w-[100px] min-w-[100px] font-medium">
                                S/{" "}
                                {parseFloat(order.grandTotal || "0").toFixed(2)}
                              </TableCell>
                              <TableCell className="w-[100px] min-w-[100px] text-green-600 font-medium">
                                S/{" "}
                                {(
                                  parseFloat(order.grandTotal || "0") -
                                  pendingPayment
                                ).toFixed(2)}
                              </TableCell>
                              <TableCell className="w-[100px] min-w-[100px] text-red-600 font-medium">
                                S/ {pendingPayment.toFixed(2)}
                              </TableCell>
                              <TableCell className="w-[100px] min-w-[100px] font-medium text-blue-600">
                                S/{" "}
                                {Number(order.carrierShippingCost || 0).toFixed(
                                  2,
                                )}
                              </TableCell>
                              <TableCell className="w-[100px] min-w-[100px]">
                                <Badge className="text-[10px]">
                                  {order.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="w-[100px] min-w-[100px]">
                                {order.salesRegion}
                              </TableCell>
                              <TableCell className="w-[120px] min-w-[120px] text-xs">
                                {order.customer?.district || "-"}
                              </TableCell>
                              <TableCell className="w-[100px] min-w-[100px]">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-[10px] w-full"
                                  onClick={() => handleOpenOrder(item)}
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  Ver
                                </Button>
                              </TableCell>
                              <TableCell className="text-right lg:sticky lg:right-0 lg:z-30 bg-background border-l">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-8 w-8 bg-amber-50 hover:bg-amber-100 text-amber-600 border-amber-200"
                                    onClick={() => {
                                      setSelectedOrderForPayment(order);
                                      setPaymentModalOpen(true);
                                    }}
                                    title="Gestión de Pagos"
                                  >
                                    <DollarSign className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-8 w-8"
                                    onClick={() =>
                                      router.push(
                                        `/registrar-venta?orderId=${order.id}`,
                                      )
                                    }
                                    title="Editar"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="guias">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Guías de Envío ({filteredGuidesList.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Filtros de Guías */}
                <div className="mb-4 p-4 border rounded-lg bg-muted/30">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">
                        Buscar (N° Guía o N° Orden)
                      </Label>
                      <div className="relative">
                        <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar..."
                          value={guideSearch}
                          onChange={(e) => setGuideSearch(e.target.value)}
                          className="h-8 pl-8 text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Estado de Guía</Label>
                      <select
                        className="w-full h-8 text-sm border rounded-md px-2 bg-background text-foreground"
                        value={guideStatusFilter}
                        onChange={(e) => setGuideStatusFilter(e.target.value)}
                      >
                        <option value="">Todos</option>
                        {GUIDE_STATUSES.filter((s) => s.value !== "").map(
                          (s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ),
                        )}
                      </select>
                    </div>
                    <div className="flex items-end">
                      {(guideSearch || guideStatusFilter) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setGuideSearch("");
                            setGuideStatusFilter("");
                          }}
                          className="text-xs"
                        >
                          Limpiar filtros
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {loadingGuides ? (
                  <div className="text-center py-10 text-muted-foreground">
                    Cargando guías...
                  </div>
                ) : filteredGuidesList.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    No se encontraron guías
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>N° Guía</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Courier</TableHead>
                        <TableHead>Pedidos</TableHead>
                        <TableHead>Tipo Despacho</TableHead>
                        <TableHead>Zonas</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredGuidesList.map((guide) => (
                        <TableRow
                          key={guide.id}
                          className="hover:bg-muted/50 cursor-pointer"
                          onClick={() => handleOpenGuideDetails(guide)}
                        >
                          <TableCell className="font-bold">
                            {guide.guideNumber}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={`h-6 text-[10px] font-semibold ${
                                GUIDE_STATUS_STYLE[guide.status] ||
                                "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {guide.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{guide.courierName || "-"}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-medium">
                                {guide.orderIds.length} órdenes
                              </span>
                              <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                                {guide.orderIds
                                  .map(
                                    (id) => orderMap[id] || id.substring(0, 8),
                                  )
                                  .join(", ")}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {guide.deliveryType}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {guide.deliveryZones.map((z) => (
                                <Badge
                                  key={z}
                                  variant="secondary"
                                  className="text-[9px] h-4 px-1"
                                >
                                  {z}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            {new Date(guide.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell
                            className="text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8 bg-green-500 hover:bg-green-600 text-white border-green-600"
                              onClick={() =>
                                handleWhatsApp(
                                  guide.phoneNumber || "",
                                  guide.guideNumber,
                                  guide.clientName || "",
                                )
                              }
                              title="WhatsApp"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleOpenGuideDetails(guide)}
                            >
                              <Eye className="h-4 w-4" />
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
        </Tabs>

        <CustomerServiceModal
          open={orderModalOpen}
          onClose={() => {
            setOrderModalOpen(false);
            setSelectedOrderId(null);
            setSelectedGuideData(null);
          }}
          orderId={selectedOrderId || ""}
          shippingGuide={selectedGuideData}
          onOrderUpdated={() => fetchEnvios()}
          hideCallManagement={true}
        />

        <GuideDetailsModal
          open={guideModalOpen}
          onClose={() => {
            setGuideModalOpen(false);
            setSelectedEnvio(null);
            setSelectedGuideData(null);
            fetchEnvios();
            fetchGuides();
          }}
          orderId={selectedOrderId || selectedEnvio?.order.id || ""}
          onGuideUpdated={() => {
            fetchEnvios();
            fetchGuides();
          }}
        />

        <ShippingNotesModal
          open={notesModalOpen}
          onClose={() => setNotesModalOpen(false)}
          guideId={selectedGuideForNotes?.id || ""}
          initialNotes={selectedGuideForNotes?.notes || "[]"}
          onNoteAdded={() => {
            fetchEnvios();
            fetchGuides();
          }}
        />

        <PaymentVerificationModal
          open={paymentModalOpen}
          onClose={() => setPaymentModalOpen(false)}
          orderId={selectedOrderForPayment?.id || ""}
          orderNumber={selectedOrderForPayment?.orderNumber || ""}
          onPaymentUpdated={() => {
            fetchEnvios();
            fetchGuides();
          }}
          canApprove={true}
        />
      </main>
    </div>
  );
}
