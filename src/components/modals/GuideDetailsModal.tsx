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
import { Package, Truck, User, Calendar, MapPin, Loader2, ExternalLink } from "lucide-react";
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

export default function GuideDetailsModal({
  open,
  onClose,
  orderId,
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
      if (res.data?.courierName) {
        setSelectedCourier(res.data.courierName);
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
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/${guide.id}/assign-courier`,
        {
          courierId: null, // Por ahora no tenemos ID de courier
          courierName: selectedCourier,
        }
      );
      toast.success(`Courier ${selectedCourier} asignado a la guía`);
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
                Courier / Repartidor
              </Label>
              {guide.courierName ? (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
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
              <div className="border-t pt-3">
                <p className="text-sm text-muted-foreground">Notas:</p>
                <p className="text-sm">{guide.notes}</p>
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
          {guide && guide.status === "ASIGNADA" && (
            <Button
              onClick={handleStartDelivery}
              disabled={assigning}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {assigning ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Truck className="h-4 w-4 mr-2" />
              )}
              Iniciar Reparto
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
