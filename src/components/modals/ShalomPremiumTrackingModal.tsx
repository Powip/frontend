"use client";

import { useEffect, useState, useCallback } from "react";
import {
  X,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  ExternalLink,
  MapPin,
  ClipboardList,
  FileText,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { OrderHeader } from "@/interfaces/IOrder";
import {
  trackShalomShipment,
  getShalomTicketPdfUrl,
  generateShalomTicketPdf,
} from "@/services/shalomService";
import { useAuth } from "@/contexts/AuthContext";

interface ShippingGuide {
  id: string;
  guideNumber: string;
  notes?: string | null;
  created_at: string;
}

interface ShalomPremiumTrackingModalProps {
  open: boolean;
  onClose: () => void;
  order: OrderHeader | null;
  guide?: ShippingGuide | null;
}

export default function ShalomPremiumTrackingModal({
  open,
  onClose,
  order,
  guide,
}: ShalomPremiumTrackingModalProps) {
  const { auth } = useAuth();
  const [trackingEvents, setTrackingEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [dynamicPdfUrl, setDynamicPdfUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);

  const loadPdf = useCallback(async () => {
    // ✅ Validar que existan los campos correctos
    if (
      !auth?.accessToken ||
      !order?.externalTrackingNumber ||
      !order?.shippingKey
    ) {
      console.warn("⚠️ No hay datos de Shalom para generar PDF:", {
        hasToken: !!auth?.accessToken,
        hasTracking: !!order?.externalTrackingNumber,
        hasKey: !!order?.shippingKey,
      });
      return;
    }

    setLoadingPdf(true);
    setDynamicPdfUrl(null);

    try {
      console.log("📄 Generando PDF con:", {
        externalTrackingNumber: order.externalTrackingNumber,
        shippingKey: order.shippingKey,
      });

      // ✅ Usar shippingKey en lugar de shippingCode
      const blob = await generateShalomTicketPdf(
        auth.accessToken,
        order.externalTrackingNumber,
        order.shippingKey,
      );

      const url = URL.createObjectURL(blob);
      setDynamicPdfUrl(url);

      console.log("✅ PDF generado exitosamente");
    } catch (error: any) {
      console.error("❌ Error loading PDF:", error);
      console.error("❌ Error details:", error.response?.data);
    } finally {
      setLoadingPdf(false);
    }
  }, [auth?.accessToken, order?.externalTrackingNumber, order?.shippingKey]);

  useEffect(() => {
    if (
      open &&
      order?.externalTrackingNumber &&
      order?.shippingKey &&
      auth?.accessToken
    ) {
      loadPdf();
    }
    return () => {
      if (dynamicPdfUrl) {
        URL.revokeObjectURL(dynamicPdfUrl);
      }
    };
  }, [
    open,
    order?.externalTrackingNumber,
    order?.shippingKey,
    auth?.accessToken,
    loadPdf,
    dynamicPdfUrl,
  ]);

  const loadTracking = useCallback(async () => {
    // ✅ Validar que existan los campos correctos
    if (
      !auth?.accessToken ||
      !auth?.company?.id ||
      !order?.externalTrackingNumber ||
      !order?.shippingKey
    ) {
      console.warn("⚠️ No hay datos de Shalom para tracking:", {
        hasToken: !!auth?.accessToken,
        hasCompanyId: !!auth?.company?.id,
        hasTracking: !!order?.externalTrackingNumber,
        hasKey: !!order?.shippingKey,
      });
      return;
    }

    setLoading(true);

    try {
      console.log("🔍 Rastreando con:", {
        companyId: auth.company.id,
        externalTrackingNumber: order.externalTrackingNumber,
        shippingKey: order.shippingKey,
      });

      // ✅ Usar shippingKey en lugar de shippingCode
      const data = await trackShalomShipment(
        auth.accessToken,
        auth.company.id,
        order.externalTrackingNumber,
        order.shippingKey,
      );

      console.log("✅ Shalom tracking data:", data);

      // ✅ Adaptar según la estructura de respuesta
      if (data && Array.isArray(data.tracking)) {
        setTrackingEvents(data.tracking);
      } else if (data && Array.isArray(data.eventos)) {
        setTrackingEvents(data.eventos);
      } else if (data && Array.isArray(data)) {
        setTrackingEvents(data);
      } else {
        console.warn("⚠️ Estructura de tracking desconocida:", data);
        setTrackingEvents([]);
      }
    } catch (error: any) {
      console.error("❌ Error loading tracking:", error);
      console.error("❌ Error details:", error.response?.data);
    } finally {
      setLoading(false);
    }
  }, [
    auth?.accessToken,
    auth?.company?.id,
    order?.externalTrackingNumber,
    order?.shippingKey,
  ]);

  useEffect(() => {
    if (
      open &&
      order?.externalTrackingNumber &&
      order?.shippingKey &&
      auth?.accessToken &&
      auth?.company?.id
    ) {
      loadTracking();
    }
  }, [
    open,
    order?.externalTrackingNumber,
    order?.shippingKey,
    auth?.accessToken,
    auth?.company?.id,
    loadTracking,
  ]);

  if (!order) return null;

  // Use shalomExternalStatus if available (from Shalom API), otherwise fallback to order.status
  const currentStatus = (order as any).shalomExternalStatus || order.status;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-7xl h-[90vh] flex flex-col p-0 overflow-hidden bg-slate-50 dark:bg-slate-950 border-none">
        <DialogHeader className="p-6 bg-white dark:bg-slate-900 border-b dark:border-slate-800 shrink-0">
          <div className="flex justify-between items-center">
            <div>
              <DialogTitle className="text-xl font-bold text-slate-800 dark:text-slate-100">
                Seguimiento del Envío
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Orden #{order.orderNumber} • {order.customer?.fullName}
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">
                  Estado Shalom
                </span>
                <Badge
                  className={
                    order.shalomStatus === "ENTREGADO"
                      ? "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-950/50 border-green-200 dark:border-green-900/50"
                      : order.shalomStatus === "EN_TRANSITO"
                        ? "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/50 border-blue-200 dark:border-blue-900/50"
                        : order.shalomStatus === "PENDIENTE" ||
                            order.shalomStatus === "EXITOSO"
                          ? "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-950/50 border-green-200 dark:border-green-900/50"
                          : order.shalomStatus === "FALLIDO"
                            ? "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50 border-red-200 dark:border-red-900/50"
                            : "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/50 border-amber-200 dark:border-amber-900/50"
                  }
                >
                  {order.shalomStatus || "Sin estado"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-8 px-4">
            <div className="relative flex justify-between">
              <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 dark:bg-slate-800 -translate-y-1/2 z-0" />
              <div
                className="absolute top-1/2 left-0 h-0.5 bg-green-500 -translate-y-1/2 z-0 transition-all"
                style={{
                  width:
                    order.shalomStatus === "ENTREGADO"
                      ? "100%"
                      : order.shalomStatus === "EN_TRANSITO"
                        ? "50%"
                        : order.shalomStatus === "PENDIENTE" ||
                            order.shalomStatus === "EXITOSO"
                          ? "33%"
                          : "0%",
                }}
              />

              <div className="relative z-10 flex flex-col items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                    order.shalomStatus === "PENDIENTE" ||
                    order.shalomStatus === "EXITOSO" ||
                    order.shalomStatus === "EN_TRANSITO" ||
                    order.shalomStatus === "ENTREGADO"
                      ? "bg-green-500 border-green-500 text-white"
                      : "bg-white dark:bg-slate-900 border-green-500 text-green-500 ring-4 ring-green-50 dark:ring-green-900/20"
                  }`}
                >
                  <Clock className="h-4 w-4" />
                </div>
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                  Registrado
                </span>
              </div>

              <div className="relative z-10 flex flex-col items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                    order.shalomStatus === "EN_TRANSITO" ||
                    order.shalomStatus === "ENTREGADO"
                      ? "bg-green-500 border-green-500 text-white"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500"
                  }`}
                >
                  <Truck className="h-4 w-4" />
                </div>
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                  En Camino
                </span>
              </div>

              <div className="relative z-10 flex flex-col items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                    order.shalomStatus === "ENTREGADO"
                      ? "bg-green-500 border-green-500 text-white"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500"
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                  Entregado
                </span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: Events & Products */}
          <div className="w-[45%] border-r dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900">
            <ScrollArea className="flex-1">
              <div className="p-6 space-y-8">
                {/* Tracking Events */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg">
                      <ExternalLink className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                      Progreso del Envío
                    </h3>
                  </div>

                  <div className="space-y-6 relative ml-4">
                    <div className="absolute left-[-17px] top-2 bottom-2 w-0.5 bg-slate-100 dark:bg-slate-800" />

                    {loading ? (
                      <p className="text-xs text-muted-foreground animate-pulse">
                        Cargando eventos...
                      </p>
                    ) : trackingEvents.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">
                        No hay eventos registrados en Shalom todavía.
                      </p>
                    ) : (
                      trackingEvents.map((event, idx) => (
                        <div key={idx} className="relative flex flex-col gap-1">
                          <div
                            className={`absolute left-[-22px] top-1 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${idx === 0 ? "bg-blue-500 shadow-sm shadow-blue-200 dark:shadow-none" : "bg-slate-300 dark:bg-slate-700"}`}
                          />
                          <span
                            className={`text-xs font-bold ${idx === 0 ? "text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400"}`}
                          >
                            {event.estado || "Procesando"}
                          </span>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500">
                            <Clock className="h-3 w-3" />
                            <span>
                              {event.fecha} {event.hora}
                            </span>
                            <span>•</span>
                            <MapPin className="h-3 w-3" />
                            <span>{event.ubicacion || "Agencia"}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <Separator />

                {/* Products */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-lg">
                      <ClipboardList className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                      Productos de envío
                    </h3>
                  </div>

                  <div className="space-y-3">
                    {order.items?.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-xl border dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-white dark:bg-slate-800 border dark:border-slate-700 flex items-center justify-center">
                            <Package className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-700 dark:text-slate-200 line-clamp-1">
                              {item.productName}
                            </p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">
                              SKU: {item.sku || "N/A"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                            x{item.quantity}
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">
                            PEN {item.unitPrice}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>

          {/* Right Panel: PDF & Key */}
          <div className="flex-1 flex flex-col relative">
            <div className="flex-1 bg-slate-200 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
              {loadingPdf ? (
                <div className="flex flex-col items-center gap-3 text-blue-500 animate-pulse">
                  <Clock className="h-8 w-8 animate-spin" />
                  <p className="text-xs font-bold uppercase tracking-widest">
                    Generando Ticket...
                  </p>
                </div>
              ) : dynamicPdfUrl ? (
                <iframe
                  src={dynamicPdfUrl}
                  className="w-full h-full border-none shadow-inner opacity-90 dark:opacity-75"
                  title="Ticket Shalom"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-slate-400 dark:text-slate-600">
                  <FileText className="h-12 w-12 opacity-20" />
                  <p className="text-xs font-medium italic">
                    Documento de agencia no disponible
                  </p>
                </div>
              )}
            </div>

            {/* Floating Key Card */}
            <div className="absolute bottom-6 right-6 w-64 p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 ring-1 ring-black/5">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">
                    Detalle del Courier
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[8px] h-4 bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-900/50 uppercase font-black"
                  >
                    Shalom
                  </Badge>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-slate-400 dark:text-slate-500">
                      Clave de Seguridad
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-sm font-black text-slate-800 dark:text-slate-100 tracking-widest font-mono">
                        {showKey ? order.shippingKey || "SIN CLAVE" : "****"}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
                        onClick={() => setShowKey(!showKey)}
                      >
                        {showKey ? (
                          <EyeOff className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                        ) : (
                          <Eye className="h-3.5 w-3.5 text-blue-500" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] text-slate-400 dark:text-slate-500">
                      N° Guía
                    </span>
                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                      {order.shippingCode || "-"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
