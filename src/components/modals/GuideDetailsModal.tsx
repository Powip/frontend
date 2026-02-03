"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Package,
  Truck,
  User,
  Calendar,
  MapPin,
  Loader2,
  ExternalLink,
  MessageSquare,
  Phone,
  ChevronDown,
  ChevronRight,
  DollarSign,
  ShoppingBag,
  Printer,
  FileText,
  Camera,
  ImageIcon,
  CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import axios from "axios";
import { toast } from "sonner";

export interface ShippingGuide {
  id: string;
  guideNumber: string;
  storeId: string;
  courierId?: string | null;
  courierName?: string | null;
  courierPhone?: string | null;
  orderIds: string[];
  status:
    | "CREADA"
    | "APROBADA"
    | "ASIGNADA"
    | "EN_RUTA"
    | "ENTREGADA"
    | "PARCIAL"
    | "FALLIDA"
    | "CANCELADA";
  chargeType?: "PREPAGADO" | "CONTRA_ENTREGA" | "CORTESIA" | null;
  amountToCollect?: number | null;
  scheduledDate?: string | null;
  deliveryZones?: string[];
  deliveryType?: "MOTO" | "COURIER";
  deliveryAddress?: string | null;
  shippingKey?: string | null;
  shippingOffice?: string | null;
  shippingProofUrl?: string | null;
  notes?: string | null;
  trackingUrl?: string | null;
  externalCarrierId?: string | null;
  externalGuideReference?: string | null;
  created_at: string;
  updated_at: string;
}

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  grandTotal: number;
  customer: {
    fullName: string;
    phoneNumber: string;
    district?: string;
    address?: string;
  };
  payments: Array<{
    amount: number;
    status: string;
  }>;
  items: Array<{
    productName: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    attributes?: Record<string, string>;
  }>;
  // Campos de tracking por pedido
  externalTrackingNumber?: string | null;
  shippingKey?: string | null;
  trackingUrl?: string | null;
  shippingOffice?: string | null;
  shippingCode?: string | null;
}

interface GuideDetailsModalProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  defaultCourier?: string | null;
  onGuideUpdated?: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  CREADA: "bg-gray-100 text-gray-800",
  APROBADA: "bg-teal-100 text-teal-800",
  ASIGNADA: "bg-blue-100 text-blue-800",
  EN_RUTA: "bg-amber-100 text-amber-800",
  ENTREGADA: "bg-green-100 text-green-800",
  PARCIAL: "bg-orange-100 text-orange-800",
  FALLIDA: "bg-red-100 text-red-800",
  CANCELADA: "bg-red-100 text-red-800",
};

const ZONE_LABELS: Record<string, string> = {
  LIMA_NORTE: "Lima Norte",
  CALLAO: "Callao",
  LIMA_CENTRO: "Lima Centro",
  LIMA_SUR: "Lima Sur",
  LIMA_ESTE: "Lima Este",
  ZONAS_ALEDANAS: "Zonas Aledañas",
  PROVINCIAS: "Provincias",
};

const ORDER_STATUS_COLORS: Record<string, string> = {
  PENDIENTE: "bg-gray-100 text-gray-800",
  PREPARADO: "bg-yellow-100 text-yellow-800",
  LLAMADO: "bg-blue-100 text-blue-800",
  ASIGNADO_A_GUIA: "bg-purple-100 text-purple-800",
  EN_ENVIO: "bg-amber-100 text-amber-800",
  ENTREGADO: "bg-green-100 text-green-800",
  ANULADO: "bg-red-100 text-red-800",
};

const CHARGE_TYPE_LABELS: Record<string, string> = {
  PREPAGADO: "Prepagado",
  CONTRA_ENTREGA: "Contra entrega",
  CORTESIA: "Cortesía",
};

const COURIERS = [
  "Motorizado Propio",
  "Shalom",
  "Olva Courier",
  "Marvisur",
  "Flores",
];

const COURIER_NORMALIZE_MAP: Record<string, string> = {
  MOTORIZADO_PROPIO: "Motorizado Propio",
  "Motorizado Propio": "Motorizado Propio",
  SHALOM: "Shalom",
  Shalom: "Shalom",
  OLVA_COURIER: "Olva Courier",
  "Olva Courier": "Olva Courier",
  MARVISUR: "Marvisur",
  Marvisur: "Marvisur",
  FLORES: "Flores",
  Flores: "Flores",
};

const normalizeCourier = (courier?: string | null): string => {
  if (!courier) return "";
  return COURIER_NORMALIZE_MAP[courier] || courier;
};

export default function GuideDetailsModal({
  open,
  onClose,
  orderId,
  defaultCourier,
  onGuideUpdated,
}: GuideDetailsModalProps) {
  const [guide, setGuide] = useState<ShippingGuide | null>(null);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [selectedCourier, setSelectedCourier] = useState("");
  const [ordersDetails, setOrdersDetails] = useState<OrderDetail[]>([]);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  // Estado para tracking por pedido (key = orderId)
  const [orderTrackingFields, setOrderTrackingFields] = useState<
    Record<
      string,
      {
        externalTrackingNumber: string;
        shippingKey: string;
        trackingUrl: string;
        shippingOffice: string;
        shippingCode: string;
      }
    >
  >({});
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);
  // Upload de foto de entrega
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open && orderId) {
      fetchGuide();
    }
  }, [open, orderId]);

  const fetchGuide = async () => {
    setLoading(true);
    try {
      const res = await axios.get<ShippingGuide | null>(
        `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/order/${orderId}`,
      );
      setGuide(res.data);

      if (res.data?.courierName) {
        setSelectedCourier(normalizeCourier(res.data.courierName));
      } else if (defaultCourier) {
        setSelectedCourier(normalizeCourier(defaultCourier));
      }

      // Fetch order details for all orders in the guide
      if (res.data?.orderIds?.length) {
        const ordersPromises = res.data.orderIds.map((id) =>
          axios.get<OrderDetail>(
            `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${id}`,
          ),
        );
        const ordersResponses = await Promise.all(ordersPromises);
        const orders = ordersResponses.map((r) => r.data);
        setOrdersDetails(orders);

        // Inicializar tracking fields por cada pedido
        const trackingByOrder: Record<
          string,
          {
            externalTrackingNumber: string;
            shippingKey: string;
            trackingUrl: string;
            shippingOffice: string;
            shippingCode: string;
          }
        > = {};
        orders.forEach((order) => {
          trackingByOrder[order.id] = {
            externalTrackingNumber: order.externalTrackingNumber || "",
            shippingKey: order.shippingKey || "",
            trackingUrl: order.trackingUrl || "",
            shippingOffice: order.shippingOffice || "",
            shippingCode: order.shippingCode || "",
          };
        });
        setOrderTrackingFields(trackingByOrder);
      }
    } catch (error) {
      console.error("Error fetching guide:", error);
      setGuide(null);
    } finally {
      setLoading(false);
    }
  };

  // Guardar tracking de un pedido individual
  const handleSaveOrderTracking = async (orderId: string) => {
    const trackingData = orderTrackingFields[orderId];
    if (!trackingData) return;

    setSavingOrderId(orderId);
    try {
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`,
        {
          externalTrackingNumber: trackingData.externalTrackingNumber || null,
          shippingKey: trackingData.shippingKey || null,
          trackingUrl: trackingData.trackingUrl || null,
          shippingOffice: trackingData.shippingOffice || null,
          shippingCode: trackingData.shippingCode || null,
        },
      );
      toast.success("Datos de tracking guardados");
      onGuideUpdated?.();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Error al guardar tracking",
      );
    } finally {
      setSavingOrderId(null);
    }
  };

  // Actualizar campo de tracking para un pedido
  const updateOrderTrackingField = (
    orderId: string,
    field: keyof (typeof orderTrackingFields)[string],
    value: string,
  ) => {
    setOrderTrackingFields((prev) => ({
      ...prev,
      [orderId]: {
        ...prev[orderId],
        [field]: value,
      },
    }));
  };

  const handleAssignCourier = async () => {
    if (!guide || !selectedCourier) return;

    setAssigning(true);
    try {
      // Solo asignar courier a la guía, NO cambiar estado de órdenes
      // El estado de las órdenes cambiará cuando se APRUEBE la guía
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/${guide.id}/assign-courier`,
        {
          courierId: null,
          courierName: selectedCourier,
        },
      );

      toast.success(`Courier ${selectedCourier} asignado a la guía`);
      fetchGuide();
      onGuideUpdated?.();
    } catch (error: any) {
      const message =
        error?.response?.data?.message || "Error asignando courier";
      toast.error(message);
    } finally {
      setAssigning(false);
    }
  };

  // Aprobar guía (cambiar status de CREADA a APROBADA) y pasar órdenes a EN_ENVIO
  const handleApproveGuide = async () => {
    if (!guide) return;

    // Verificar que hay courier realmente asignado (no solo seleccionado)
    if (!guide.courierName) {
      toast.error("Debes asignar un courier antes de aprobar la guía");
      return;
    }

    setAssigning(true);
    try {
      // 1. Aprobar la guía
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/${guide.id}`,
        {
          status: "APROBADA",
          courierName: guide.courierName,
        },
      );

      // 2. Cambiar estado de todas las órdenes a EN_ENVIO
      for (const orderId of guide.orderIds) {
        await axios.patch(
          `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`,
          {
            status: "EN_ENVIO",
            courier: guide.courierName,
          },
        );
      }

      toast.success(
        `Guía aprobada y ${guide.orderIds.length} pedido(s) despachados`,
      );
      fetchGuide();
      onGuideUpdated?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Error al aprobar guía");
    } finally {
      setAssigning(false);
    }
  };

  // Subir foto de prueba de entrega
  const handleUploadProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !guide) return;

    // Validar tipo de archivo
    if (!file.type.startsWith("image/")) {
      toast.error("Solo se permiten imágenes");
      return;
    }

    // Validar tamaño (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen no debe superar 5MB");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/${guide.id}/upload-proof`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );

      toast.success("Foto de entrega subida correctamente");
      fetchGuide();
      onGuideUpdated?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Error al subir la foto");
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = "";
    }
  };

  const handleClose = () => {
    setGuide(null);
    setSelectedCourier("");
    setOrdersDetails([]);
    setExpandedOrders(new Set());
    setOrderTrackingFields({});
    onClose();
  };

  const toggleOrderExpand = (orderId: string) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  // Calcular totales
  const totalCobranza = ordersDetails.reduce((sum, order) => {
    const paid =
      order.payments
        ?.filter((p) => p.status === "PAID")
        .reduce((s, p) => s + Number(p.amount), 0) || 0;
    const pending = Number(order.grandTotal) - paid;
    return sum + Math.max(pending, 0);
  }, 0);

  // Imprimir guía
  const handlePrintGuide = () => {
    if (!guide) return;

    const content = `
      <html>
      <head>
        <title>Guía ${guide.guideNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
          .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 15px; }
          .header h1 { margin: 0; font-size: 18px; }
          .header p { margin: 5px 0 0; color: #666; }
          .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px; padding: 10px; background: #f5f5f5; }
          .info-item { }
          .info-item .label { font-size: 10px; color: #666; }
          .info-item .value { font-weight: bold; }
          .orders { margin-top: 15px; }
          .orders h3 { font-size: 14px; margin-bottom: 10px; }
          .order { border: 1px solid #ddd; margin-bottom: 10px; padding: 10px; }
          .order-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
          .order-header .number { font-weight: bold; }
          .order-header .status { padding: 2px 8px; background: #eee; border-radius: 4px; font-size: 10px; }
          .customer { color: #666; font-size: 11px; margin-bottom: 8px; }
          .items { border-top: 1px dashed #ddd; padding-top: 8px; }
          .item { display: flex; justify-content: space-between; padding: 3px 0; }
          .item-name { flex: 1; }
          .total { text-align: right; font-weight: bold; margin-top: 8px; }
          .pending { color: red; }
          @media print { body { padding: 10px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${guide.guideNumber}</h1>
          <p>Fecha: ${new Date(guide.created_at).toLocaleDateString("es-PE")} | Estado: ${guide.status}</p>
        </div>
        <div class="info-grid">
          <div class="info-item">
            <div class="label">Zona</div>
            <div class="value">${guide.deliveryZones?.join(", ") || "-"}</div>
          </div>
          <div class="info-item">
            <div class="label">Courier</div>
            <div class="value">${guide.courierName || "-"}</div>
          </div>
          <div class="info-item">
            <div class="label">Total Pedidos</div>
            <div class="value">${guide.orderIds.length}</div>
          </div>
          <div class="info-item">
            <div class="label">Cobranza Total</div>
            <div class="value pending">S/${totalCobranza.toFixed(2)}</div>
          </div>
        </div>
        <div class="orders">
          <h3>Pedidos</h3>
          ${ordersDetails
            .map((order) => {
              const paid =
                order.payments
                  ?.filter((p) => p.status === "PAID")
                  .reduce((s, p) => s + Number(p.amount), 0) || 0;
              const pending = Math.max(Number(order.grandTotal) - paid, 0);
              return `
              <div class="order">
                <div class="order-header">
                  <span class="number">${order.orderNumber}</span>
                  <span class="status">${order.status}</span>
                </div>
                <div class="customer">
                  ${order.customer.fullName} | ${order.customer.phoneNumber}<br/>
                  ${order.customer.district || ""} - ${order.customer.address || ""}
                </div>
                <div class="items">
                  ${
                    order.items
                      ?.map(
                        (item) => `
                    <div class="item">
                      <span class="item-name">${item.productName} (x${item.quantity})</span>
                      <span>S/${(Number(item.unitPrice) * item.quantity).toFixed(2)}</span>
                    </div>
                  `,
                      )
                      .join("") || ""
                  }
                </div>
                <div class="total">
                  Total: S/${Number(order.grandTotal).toFixed(2)}
                  ${pending > 0 ? `<span class="pending"> | Cobrar: S/${pending.toFixed(2)}</span>` : ""}
                </div>
              </div>
            `;
            })
            .join("")}
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(content);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  // Imprimir comprobantes de envío
  const handlePrintReceipts = async () => {
    if (ordersDetails.length === 0) {
      toast.warning("No hay pedidos para imprimir");
      return;
    }

    toast.info(`Preparando ${ordersDetails.length} comprobante(s) de envío...`);

    // Generar todos los comprobantes
    for (const order of ordersDetails) {
      const content = `
        <html>
        <head>
          <title>Comprobante ${order.orderNumber}</title>
          <style>
            body { font-family: Arial; padding: 15px; font-size: 11px; max-width: 280px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
            .header h2 { margin: 0 0 5px; font-size: 14px; }
            .section { margin-bottom: 10px; }
            .section-title { font-weight: bold; font-size: 10px; text-transform: uppercase; margin-bottom: 5px; }
            .row { display: flex; justify-content: space-between; padding: 2px 0; }
            .items { border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 8px 0; }
            .item { margin-bottom: 5px; }
            .totals { font-weight: bold; }
            .pending { color: red; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>COMPROBANTE DE ENVÍO</h2>
            <p>${order.orderNumber}</p>
          </div>
          <div class="section">
            <div class="section-title">Cliente</div>
            <p>${order.customer.fullName}</p>
            <p>${order.customer.phoneNumber}</p>
            <p>${order.customer.district || ""} - ${order.customer.address || ""}</p>
          </div>
          <div class="section items">
            <div class="section-title">Productos</div>
            ${
              order.items
                ?.map(
                  (item) => `
              <div class="item">
                <div class="row">
                  <span>${item.productName}</span>
                  <span>x${item.quantity}</span>
                </div>
                <div class="row" style="color: #666; font-size: 10px;">
                  <span>${item.sku}</span>
                  <span>S/${Number(item.unitPrice).toFixed(2)}</span>
                </div>
              </div>
            `,
                )
                .join("") || ""
            }
          </div>
          <div class="section totals">
            <div class="row">
              <span>TOTAL:</span>
              <span>S/${Number(order.grandTotal).toFixed(2)}</span>
            </div>
            ${(() => {
              const paid =
                order.payments
                  ?.filter((p) => p.status === "PAID")
                  .reduce((s, p) => s + Number(p.amount), 0) || 0;
              const pending = Math.max(Number(order.grandTotal) - paid, 0);
              return pending > 0
                ? `
                <div class="row pending">
                  <span>A COBRAR:</span>
                  <span>S/${pending.toFixed(2)}</span>
                </div>
              `
                : "";
            })()}
          </div>
          <div style="text-align: center; margin-top: 15px; font-size: 10px; color: #666;">
            Guía: ${guide?.guideNumber || "-"}<br/>
            Courier: ${guide?.courierName || "-"}
          </div>
        </body>
        </html>
      `;

      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(content);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Detalles de Guía
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : guide ? (
          <div className="space-y-4 py-4">
            {/* Header con número y estado */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold">{guide.guideNumber}</p>
                <p className="text-sm text-muted-foreground">
                  Creada:{" "}
                  {new Date(guide.created_at).toLocaleDateString("es-PE")}
                </p>
              </div>
              <Badge className={STATUS_COLORS[guide.status]}>
                {guide.status.replace("_", " ")}
              </Badge>
            </div>

            {/* Resumen de la guía en grilla */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-muted/30 rounded-lg">
              {/* Zona y Tipo */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Zona
                </p>
                <div className="flex flex-wrap gap-1">
                  {guide.deliveryType && (
                    <Badge
                      className={
                        guide.deliveryType === "MOTO"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-orange-100 text-orange-800"
                      }
                    >
                      {guide.deliveryType === "MOTO" ? "🏍️" : "📦"}{" "}
                      {guide.deliveryType}
                    </Badge>
                  )}
                  {guide.deliveryZones?.map((zone) => (
                    <Badge key={zone} variant="outline" className="text-xs">
                      {ZONE_LABELS[zone] || zone}
                    </Badge>
                  ))}
                  {(!guide.deliveryZones || guide.deliveryZones.length === 0) &&
                    !guide.deliveryType &&
                    "-"}
                </div>
              </div>

              {/* Fecha programada */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Fecha
                </p>
                <p className="font-medium">
                  {guide.scheduledDate
                    ? new Date(guide.scheduledDate).toLocaleDateString("es-PE")
                    : guide.created_at
                      ? new Date(guide.created_at).toLocaleDateString("es-PE")
                      : "-"}
                </p>
              </div>

              {/* Total pedidos */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <ShoppingBag className="h-3 w-3" /> Pedidos
                </p>
                <p className="font-medium">{guide.orderIds.length}</p>
              </div>

              {/* Cobranza total */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <DollarSign className="h-3 w-3" /> Cobranza
                </p>
                <p className="font-medium text-red-600">
                  S/{totalCobranza.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Cobro */}
            {guide.chargeType && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Tipo de cobro:</span>
                <Badge variant="outline">
                  {CHARGE_TYPE_LABELS[guide.chargeType]}
                </Badge>
              </div>
            )}

            {/* Courier asignado */}
            <div className="border rounded-lg p-3 space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Truck className="h-4 w-4" />
                Courier / Repartidor
              </Label>
              {guide.courierName ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{guide.courierName}</p>
                      {guide.courierPhone && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {guide.courierPhone}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-green-600 border-green-600"
                  >
                    Asignado
                  </Badge>
                </div>
              ) : (
                <div className="flex gap-2">
                  <select
                    className="flex-1 border rounded-md px-3 py-2 bg-background text-foreground"
                    value={selectedCourier}
                    onChange={(e) => setSelectedCourier(e.target.value)}
                  >
                    <option value="">Seleccionar courier...</option>
                    {COURIERS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <Button
                    onClick={handleAssignCourier}
                    disabled={!selectedCourier || assigning}
                    size="sm"
                  >
                    {assigning ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Asignar"
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Lista de pedidos con detalles */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-3 py-2 border-b">
                <h4 className="font-medium flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Pedidos ({ordersDetails.length})
                </h4>
              </div>
              <div className="divide-y max-h-[300px] overflow-y-auto">
                {ordersDetails.map((order) => {
                  const isExpanded = expandedOrders.has(order.id);
                  const paid =
                    order.payments
                      ?.filter((p) => p.status === "PAID")
                      .reduce((s, p) => s + Number(p.amount), 0) || 0;
                  const pending = Math.max(Number(order.grandTotal) - paid, 0);

                  return (
                    <div key={order.id} className="bg-background">
                      {/* Header del pedido */}
                      <div
                        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-muted/30"
                        onClick={() => toggleOrderExpand(order.id)}
                      >
                        <div className="flex items-center gap-3">
                          <button className="text-muted-foreground">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                          <div>
                            <p className="font-medium">{order.orderNumber}</p>
                            <p className="text-sm text-muted-foreground">
                              {order.customer.fullName} •{" "}
                              {order.customer.district || "-"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-medium">
                              S/{Number(order.grandTotal).toFixed(2)}
                            </p>
                            {pending > 0 && (
                              <p className="text-xs text-red-600">
                                Cobrar: S/{pending.toFixed(2)}
                              </p>
                            )}
                          </div>
                          <Badge
                            className={
                              ORDER_STATUS_COLORS[order.status] || "bg-gray-100"
                            }
                          >
                            {order.status.replace("_", " ")}
                          </Badge>
                        </div>
                      </div>

                      {/* Items del pedido (expandible) */}
                      {isExpanded && (
                        <div className="px-3 pb-3 pl-10 space-y-2 bg-muted/20">
                          <p className="text-xs font-medium text-muted-foreground pt-2">
                            Items ({order.items?.length || 0}):
                          </p>
                          {order.items?.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex justify-between items-center text-sm bg-background rounded px-2 py-1.5"
                            >
                              <div className="flex-1">
                                <p className="font-medium">
                                  {item.productName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {item.sku}
                                  {item.attributes &&
                                    Object.entries(item.attributes).map(
                                      ([k, v]) => ` • ${k}: ${v}`,
                                    )}
                                </p>
                              </div>
                              <div className="text-right">
                                <p>x{item.quantity}</p>
                                <p className="text-muted-foreground">
                                  S/{Number(item.unitPrice).toFixed(2)}
                                </p>
                              </div>
                            </div>
                          ))}
                          {/* Info cliente */}
                          <div className="text-xs text-muted-foreground pt-1 border-t">
                            <p>
                              <Phone className="h-3 w-3 inline mr-1" />
                              {order.customer.phoneNumber}
                            </p>
                            {order.customer.address && (
                              <p>
                                <MapPin className="h-3 w-3 inline mr-1" />
                                {order.customer.address}
                              </p>
                            )}
                          </div>

                          {/* Tracking del pedido */}
                          <div className="pt-2 border-t mt-2">
                            <p className="text-xs font-medium text-orange-700 mb-2 flex items-center gap-1">
                              📦 Datos de Tracking
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">
                                  Nro. Guía Courier
                                </label>
                                <input
                                  type="text"
                                  className="w-full border rounded px-2 py-1 text-xs bg-background"
                                  placeholder="Ej: OLV-123456"
                                  value={
                                    orderTrackingFields[order.id]
                                      ?.externalTrackingNumber || ""
                                  }
                                  onChange={(e) =>
                                    updateOrderTrackingField(
                                      order.id,
                                      "externalTrackingNumber",
                                      e.target.value,
                                    )
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">
                                  Clave de Envío
                                </label>
                                <input
                                  type="text"
                                  className="w-full border rounded px-2 py-1 text-xs bg-background"
                                  placeholder="Ej: ABC123"
                                  value={
                                    orderTrackingFields[order.id]
                                      ?.shippingKey || ""
                                  }
                                  onChange={(e) =>
                                    updateOrderTrackingField(
                                      order.id,
                                      "shippingKey",
                                      e.target.value,
                                    )
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">
                                  URL Tracking
                                </label>
                                <input
                                  type="text"
                                  className="w-full border rounded px-2 py-1 text-xs bg-background"
                                  placeholder="https://..."
                                  value={
                                    orderTrackingFields[order.id]
                                      ?.trackingUrl || ""
                                  }
                                  onChange={(e) =>
                                    updateOrderTrackingField(
                                      order.id,
                                      "trackingUrl",
                                      e.target.value,
                                    )
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">
                                  Oficina de Retiro
                                </label>
                                <input
                                  type="text"
                                  className="w-full border rounded px-2 py-1 text-xs bg-background"
                                  placeholder="Ej: Olva Lima Centro"
                                  value={
                                    orderTrackingFields[order.id]
                                      ?.shippingOffice || ""
                                  }
                                  onChange={(e) =>
                                    updateOrderTrackingField(
                                      order.id,
                                      "shippingOffice",
                                      e.target.value,
                                    )
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">
                                  Código
                                </label>
                                <input
                                  type="text"
                                  className="w-full border rounded px-2 py-1 text-xs bg-background"
                                  placeholder="Ej: COD-001"
                                  value={
                                    orderTrackingFields[order.id]
                                      ?.shippingCode || ""
                                  }
                                  onChange={(e) =>
                                    updateOrderTrackingField(
                                      order.id,
                                      "shippingCode",
                                      e.target.value,
                                    )
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            </div>
                            <Button
                              size="sm"
                              className="mt-2 w-full bg-orange-600 hover:bg-orange-700 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveOrderTracking(order.id);
                              }}
                              disabled={savingOrderId === order.id}
                            >
                              {savingOrderId === order.id ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              ) : null}
                              Guardar Tracking
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {ordersDetails.length === 0 && (
                  <div className="px-3 py-4 text-center text-muted-foreground text-sm">
                    No hay pedidos en esta guía
                  </div>
                )}
              </div>
            </div>

            {/* Prueba de entrega */}
            <div className="border rounded-lg p-3 space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Camera className="h-4 w-4" />
                Prueba de Entrega
              </Label>

              {guide.shippingProofUrl ? (
                <div className="space-y-2">
                  <div className="relative group">
                    <img
                      src={guide.shippingProofUrl}
                      alt="Prueba de entrega"
                      className="w-full max-h-[200px] object-contain rounded-lg border bg-muted/20"
                    />
                    <a
                      href={guide.shippingProofUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Ver imagen completa"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Foto de confirmación cargada</span>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-4 text-center">
                  <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Sin foto de confirmación
                  </p>
                  {[
                    "APROBADA",
                    "ASIGNADA",
                    "EN_RUTA",
                    "ENTREGADA",
                    "PARCIAL",
                  ].includes(guide.status) && (
                    <label className="inline-flex items-center gap-2 cursor-pointer bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90">
                      {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                      {uploading ? "Subiendo..." : "Subir Foto"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleUploadProof}
                        disabled={uploading}
                      />
                    </label>
                  )}
                </div>
              )}
            </div>

            {/* Notas */}
            {guide.notes && (
              <div className="border-t pt-3 space-y-2">
                <p className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground">
                  <MessageSquare className="h-4 w-4" /> Notas / Historial:
                </p>
                <div className="space-y-3 max-h-[150px] overflow-y-auto pr-2">
                  {(() => {
                    try {
                      const notes = JSON.parse(guide.notes || "[]");
                      if (!Array.isArray(notes))
                        return <p className="text-sm">{guide.notes}</p>;

                      return notes.map((note: any, idx: number) => (
                        <div
                          key={idx}
                          className="bg-muted/50 rounded-lg p-2 text-sm border border-muted"
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-semibold text-xs text-primary">
                              {note.user}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {note.date
                                ? format(
                                    new Date(note.date),
                                    "dd/MM/yy HH:mm",
                                    { locale: es },
                                  )
                                : "-"}
                            </span>
                          </div>
                          <p className="text-sm leading-relaxed">{note.text}</p>
                        </div>
                      ));
                    } catch (e) {
                      return <p className="text-sm">{guide.notes}</p>;
                    }
                  })()}
                </div>
              </div>
            )}

            {/* Tracking URL */}
            {guide.trackingUrl && (
              <a
                href={guide.trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                Ver tracking
              </a>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            No se encontró información de la guía
          </div>
        )}

        <DialogFooter className="flex flex-col gap-2">
          {/* Texto informativo encima de todos los botones */}
          {guide &&
            (guide.status === "CREADA" || guide.status === "ASIGNADA") &&
            !guide.courierName && (
              <p className="text-sm text-amber-600 flex items-center gap-1 w-full justify-center">
                ⚠️ Primero asigna un courier usando el botón &quot;Asignar&quot;
                antes de aprobar la guía
              </p>
            )}

          {/* Botones en fila */}
          <div className="flex flex-wrap gap-2 justify-end w-full">
            {guide &&
              (guide.status === "CREADA" || guide.status === "ASIGNADA") && (
                <Button
                  onClick={handleApproveGuide}
                  disabled={assigning || !guide.courierName}
                  className="bg-teal-600 hover:bg-teal-700"
                >
                  {assigning ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  ✓ Aprobar Guía
                </Button>
              )}
            {guide && (
              <>
                <Button variant="outline" onClick={handlePrintGuide}>
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir Guía
                </Button>
                <Button variant="outline" onClick={handlePrintReceipts}>
                  <FileText className="h-4 w-4 mr-2" />
                  Imprimir etiqueta de envío
                </Button>
              </>
            )}
            <Button variant="outline" onClick={handleClose}>
              Cerrar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
