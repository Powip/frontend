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
import { Package, Truck, User, Calendar, MapPin, Loader2, ExternalLink, MessageSquare } from "lucide-react";
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
  orderIds: string[];
  status: "CREADA" | "ASIGNADA" | "EN_RUTA" | "ENTREGADA" | "PARCIAL" | "FALLIDA" | "CANCELADA";
  chargeType?: "PREPAGADO" | "CONTRA_ENTREGA" | "CORTESIA" | null;
  amountToCollect?: number | null;
  scheduledDate?: string | null;
  deliveryZone?: string | null;
  deliveryAddress?: string | null;
  notes?: string | null;
  trackingUrl?: string | null;
  externalCarrierId?: string | null;
  externalGuideReference?: string | null;
  created_at: string;
  updated_at: string;
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
  ASIGNADA: "bg-blue-100 text-blue-800",
  EN_RUTA: "bg-amber-100 text-amber-800",
  ENTREGADA: "bg-green-100 text-green-800",
  PARCIAL: "bg-orange-100 text-orange-800",
  FALLIDA: "bg-red-100 text-red-800",
  CANCELADA: "bg-red-100 text-red-800",
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

// Mapa para normalizar nombres de courier de la BD al formato de display
const COURIER_NORMALIZE_MAP: Record<string, string> = {
  "MOTORIZADO_PROPIO": "Motorizado Propio",
  "Motorizado Propio": "Motorizado Propio",
  "SHALOM": "Shalom",
  "Shalom": "Shalom",
  "OLVA_COURIER": "Olva Courier",
  "Olva Courier": "Olva Courier",
  "MARVISUR": "Marvisur",
  "Marvisur": "Marvisur",
  "FLORES": "Flores",
  "Flores": "Flores",
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

  useEffect(() => {
    if (open && orderId) {
      fetchGuide();
    }
  }, [open, orderId]);

  const fetchGuide = async () => {
    setLoading(true);
    try {
      const res = await axios.get<ShippingGuide | null>(
        `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/order/${orderId}`
      );
      setGuide(res.data);
      // Prioridad: courierName de la guía > defaultCourier del pedido
      if (res.data?.courierName) {
        setSelectedCourier(normalizeCourier(res.data.courierName));
      } else if (defaultCourier) {
        setSelectedCourier(normalizeCourier(defaultCourier));
      }
    } catch (error) {
      console.error("Error fetching guide:", error);
      setGuide(null);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignCourier = async () => {
    if (!guide || !selectedCourier) return;

    setAssigning(true);
    try {
      // 1. Asignar courier a la guía en ms-courier
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/${guide.id}/assign-courier`,
        {
          courierId: null, // Por ahora no tenemos ID de courier
          courierName: selectedCourier,
        }
      );

      // 2. Actualizar todas las órdenes de la guía a EN_ENVIO y asignar courier
      for (const orderId of guide.orderIds) {
        await axios.patch(
          `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`,
          {
            status: "EN_ENVIO",
            courier: selectedCourier,
          }
        );
      }

      toast.success(`Courier ${selectedCourier} asignado y ${guide.orderIds.length} pedido(s) despachados`);
      fetchGuide();
      onGuideUpdated?.();
    } catch (error: any) {
      const message = error?.response?.data?.message || "Error asignando courier";
      toast.error(message);
    } finally {
      setAssigning(false);
    }
  };

  const handleStartDelivery = async () => {
    if (!guide) return;

    setAssigning(true);
    try {
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/${guide.id}/start`
      );
      toast.success("Reparto iniciado");
      fetchGuide();
      onGuideUpdated?.();
    } catch (error: any) {
      const message = error?.response?.data?.message || "Error iniciando reparto";
      toast.error(message);
    } finally {
      setAssigning(false);
    }
  };

  const handleClose = () => {
    setGuide(null);
    setSelectedCourier("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
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
                  Creada: {new Date(guide.created_at).toLocaleDateString("es-AR")}
                </p>
              </div>
              <Badge className={STATUS_COLORS[guide.status]}>
                {guide.status.replace("_", " ")}
              </Badge>
            </div>

            {/* Info de la guía */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {guide.deliveryZone && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{guide.deliveryZone}</span>
                </div>
              )}
              {guide.scheduledDate && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{new Date(guide.scheduledDate).toLocaleDateString("es-AR")}</span>
                </div>
              )}
              {guide.chargeType && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Cobro:</span>
                  <span>{CHARGE_TYPE_LABELS[guide.chargeType]}</span>
                </div>
              )}
              {guide.amountToCollect && guide.amountToCollect > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">A cobrar:</span>
                  <span className="font-medium text-red-600">
                    S/{Number(guide.amountToCollect).toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            {/* Pedidos incluidos */}
            <div className="border rounded-lg p-3 bg-muted/30">
              <h4 className="font-medium mb-2">
                Pedidos ({guide.orderIds.length})
              </h4>
              <p className="text-sm text-muted-foreground">
                {guide.orderIds.length} pedido(s) en esta guía
              </p>
            </div>

            {/* Courier */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Courier / Repartidor:
              </Label>
              {guide.courierName ? (
                <div className="flex items-center gap-2">
                  <span className="font-medium">{guide.courierName}</span>
                  <Badge variant="outline" className="text-green-600 border-green-600">
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

            {/* Notas */}
            {guide.notes && (
              <div className="border-t pt-3 space-y-2">
                <p className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground">
                  <MessageSquare className="h-4 w-4" /> Notas / Historial:
                </p>
                <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2">
                  {(() => {
                    try {
                      const notes = JSON.parse(guide.notes || "[]");
                      if (!Array.isArray(notes)) return <p className="text-sm">{guide.notes}</p>;
                      
                      return notes.map((note: any, idx: number) => (
                        <div key={idx} className="bg-muted/50 rounded-lg p-2 text-sm border border-muted">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-semibold text-xs text-primary">{note.user}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {note.date ? format(new Date(note.date), "dd/MM/yy HH:mm", { locale: es }) : "-"}
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

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
