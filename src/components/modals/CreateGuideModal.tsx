"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PackagePlus, Loader2, AlertTriangle } from "lucide-react";

interface SelectedOrder {
  id: string;
  orderNumber: string;
  clientName: string;
  address: string;
  district: string;
  total: number;
  pendingPayment: number;
  zone?: string;
}

interface CreateGuideModalProps {
  open: boolean;
  onClose: () => void;
  selectedOrders: SelectedOrder[];
  storeId: string;
  onConfirm: (guidesData: CreateGuideData[]) => Promise<void>;
  isLoading?: boolean;
}

export interface CreateGuideData {
  storeId: string;
  orderIds: string[];
  deliveryZone: string;
  deliveryType: "MOTO" | "COURIER";
  scheduledDate?: string;
  chargeType?: "PREPAGADO" | "CONTRA_ENTREGA" | "CORTESIA";
  amountToCollect?: number;
  notes?: string;
}

const CHARGE_TYPE_OPTIONS = [
  { value: "PREPAGADO", label: "Prepagado (ya pagó)" },
  { value: "CONTRA_ENTREGA", label: "Contra entrega" },
  { value: "CORTESIA", label: "Cortesía" },
];

const ZONE_COLORS: Record<string, string> = {
  LIMA_NORTE: "bg-blue-100 text-blue-800",
  CALLAO: "bg-yellow-100 text-yellow-800",
  LIMA_CENTRO: "bg-green-100 text-green-800",
  LIMA_SUR: "bg-purple-100 text-purple-800",
  LIMA_ESTE: "bg-orange-100 text-orange-800",
  ZONAS_ALEDANAS: "bg-gray-100 text-gray-800",
  PROVINCIAS: "bg-red-100 text-red-800",
};

const ZONE_LABELS: Record<string, string> = {
  LIMA_NORTE: "🟦 Lima Norte",
  CALLAO: "🟨 Callao",
  LIMA_CENTRO: "🟩 Lima Centro",
  LIMA_SUR: "🟪 Lima Sur",
  LIMA_ESTE: "🟧 Lima Este",
  ZONAS_ALEDANAS: "⛰️ Zonas Aledañas",
  PROVINCIAS: "🧭 Provincias",
};

// Determinar tipo de despacho según zona
const getDeliveryType = (zone: string): "MOTO" | "COURIER" => {
  if (zone === "ZONAS_ALEDANAS" || zone === "PROVINCIAS") {
    return "COURIER";
  }
  return "MOTO";
};

export default function CreateGuideModal({
  open,
  onClose,
  selectedOrders,
  storeId,
  onConfirm,
  isLoading = false,
}: CreateGuideModalProps) {
  const [scheduledDate, setScheduledDate] = useState("");
  const [chargeType, setChargeType] = useState<"PREPAGADO" | "CONTRA_ENTREGA" | "CORTESIA">("CONTRA_ENTREGA");
  const [notes, setNotes] = useState("");

  // Agrupar pedidos por zona
  const ordersByZone = useMemo(() => {
    const groups: Record<string, SelectedOrder[]> = {};

    selectedOrders.forEach(order => {
      const zone = order.zone || "SIN_ZONA";
      if (!groups[zone]) {
        groups[zone] = [];
      }
      groups[zone].push(order);
    });

    return groups;
  }, [selectedOrders]);

  // Obtener zonas únicas
  const uniqueZones = useMemo(() => Object.keys(ordersByZone), [ordersByZone]);
  const hasMultipleZones = uniqueZones.length > 1;

  // Calcular monto total a cobrar
  const totalToCollect = selectedOrders.reduce(
    (acc, order) => acc + order.pendingPayment,
    0
  );

  const handleSubmit = async () => {
    // Crear una guía por cada zona
    const guidesData: CreateGuideData[] = uniqueZones.map(zone => {
      const ordersInZone = ordersByZone[zone];
      const zoneTotal = ordersInZone.reduce((acc, o) => acc + o.pendingPayment, 0);

      return {
        storeId,
        orderIds: ordersInZone.map(o => o.id),
        deliveryZone: zone === "SIN_ZONA" ? "LIMA_CENTRO" : zone,
        deliveryType: getDeliveryType(zone === "SIN_ZONA" ? "LIMA_CENTRO" : zone),
        scheduledDate: scheduledDate || undefined,
        chargeType,
        amountToCollect: chargeType === "CONTRA_ENTREGA" ? zoneTotal : undefined,
        notes: notes || undefined,
      };
    });

    await onConfirm(guidesData);
  };

  const handleClose = () => {
    setScheduledDate("");
    setChargeType("CONTRA_ENTREGA");
    setNotes("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5" />
            Generar Guía de Envío
          </DialogTitle>
          <DialogDescription>
            {hasMultipleZones ? (
              <span className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                Se crearán {uniqueZones.length} guías (una para cada zona detectada)
              </span>
            ) : (
              `Se creará una guía con ${selectedOrders.length} pedido(s) seleccionado(s)`
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Alerta de múltiples zonas */}
          {hasMultipleZones && (
            <div className="border border-amber-200 bg-amber-50 rounded-lg p-3">
              <h4 className="font-medium text-amber-800 mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Pedidos en múltiples zonas
              </h4>
              <p className="text-sm text-amber-700 mb-2">
                Los pedidos seleccionados pertenecen a {uniqueZones.length} zonas diferentes.
                Se creará una guía independiente para cada zona.
              </p>
              <div className="flex flex-wrap gap-2">
                {uniqueZones.map(zone => (
                  <Badge
                    key={zone}
                    className={ZONE_COLORS[zone] || "bg-muted text-muted-foreground"}
                  >
                    {ZONE_LABELS[zone] || zone}: {ordersByZone[zone].length} pedido(s)
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Resumen de pedidos agrupados por zona */}
          <div className="border rounded-lg p-3 bg-muted/30">
            <h4 className="font-medium mb-2">Pedidos incluidos:</h4>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {uniqueZones.map(zone => (
                <div key={zone}>
                  {hasMultipleZones && (
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={ZONE_COLORS[zone] || "bg-muted"}>
                        {ZONE_LABELS[zone] || zone}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {getDeliveryType(zone) === "MOTO" ? "🏍️ Moto" : "📦 Courier"}
                      </span>
                    </div>
                  )}
                  <div className="space-y-1 pl-2">
                    {ordersByZone[zone].map(order => (
                      <div
                        key={order.id}
                        className="flex justify-between items-center text-sm border-b pb-1 last:border-0"
                      >
                        <div>
                          <span className="font-medium">{order.orderNumber}</span>
                          <span className="text-muted-foreground ml-2">
                            {order.clientName}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-muted-foreground text-xs">
                            {order.district}
                          </span>
                          {order.pendingPayment > 0 && (
                            <span className="ml-2 text-red-600">
                              S/{order.pendingPayment.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {totalToCollect > 0 && (
              <div className="mt-2 pt-2 border-t flex justify-between font-medium">
                <span>Total a cobrar:</span>
                <span className="text-red-600">S/{totalToCollect.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Fecha programada */}
          <div className="space-y-2">
            <Label htmlFor="scheduledDate">Fecha de envío programada</Label>
            <Input
              id="scheduledDate"
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
            />
          </div>

          {/* Tipo de cobro */}
          <div className="space-y-2">
            <Label htmlFor="chargeType">Tipo de cobro</Label>
            <select
              id="chargeType"
              className="w-full border rounded-md px-3 py-2 bg-background text-foreground"
              value={chargeType}
              onChange={(e) =>
                setChargeType(e.target.value as typeof chargeType)
              }
            >
              {CHARGE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas adicionales</Label>
            <Textarea
              id="notes"
              placeholder="Instrucciones especiales, referencias, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || selectedOrders.length === 0}
            className="bg-teal-600 hover:bg-teal-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <PackagePlus className="h-4 w-4 mr-2" />
                {hasMultipleZones
                  ? `Generar ${uniqueZones.length} Guías`
                  : "Generar Guía"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

