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
  deliveryZones: string[];  // Array de zonas cubiertas
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
  const [chargeType, setChargeType] = useState<"PREPAGADO" | "CONTRA_ENTREGA" | "CORTESIA">("CONTRA_ENTREGA");
  const [notes, setNotes] = useState("");
  
  // Fecha de hoy formateada
  const todayFormatted = new Date().toLocaleDateString("es-PE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // ⚡ CAMBIO PRINCIPAL: Agrupar pedidos por dispatchType en lugar de por zona
  const ordersByDispatchType = useMemo(() => {
    const groups: Record<"MOTO" | "COURIER", { orders: SelectedOrder[]; zones: Set<string> }> = {
      MOTO: { orders: [], zones: new Set() },
      COURIER: { orders: [], zones: new Set() },
    };

    selectedOrders.forEach(order => {
      const zone = order.zone || "SIN_ZONA";
      const dispatchType = getDeliveryType(zone === "SIN_ZONA" ? "LIMA_CENTRO" : zone);
      
      groups[dispatchType].orders.push(order);
      groups[dispatchType].zones.add(zone === "SIN_ZONA" ? "LIMA_CENTRO" : zone);
    });

    // Filtrar grupos vacíos
    return Object.entries(groups)
      .filter(([, group]) => group.orders.length > 0)
      .reduce((acc, [type, group]) => {
        acc[type as "MOTO" | "COURIER"] = group;
        return acc;
      }, {} as Record<string, { orders: SelectedOrder[]; zones: Set<string> }>);
  }, [selectedOrders]);

  // Obtener tipos de despacho únicos
  const uniqueDispatchTypes = useMemo(() => Object.keys(ordersByDispatchType), [ordersByDispatchType]);
  const hasMultipleDispatchTypes = uniqueDispatchTypes.length > 1;

  // Calcular monto total por grupo (para display)
  const getGroupTotal = (dispatchType: string) => {
    const group = ordersByDispatchType[dispatchType];
    return group?.orders.reduce((acc, o) => acc + o.pendingPayment, 0) || 0;
  };

  const handleSubmit = async () => {
    // Crear una guía por cada dispatchType (no por zona)
    const guidesData: CreateGuideData[] = uniqueDispatchTypes.map(dispatchType => {
      const group = ordersByDispatchType[dispatchType];
      const groupTotal = group.orders.reduce((acc, o) => acc + o.pendingPayment, 0);

      return {
        storeId,
        orderIds: group.orders.map(o => o.id),
        deliveryZones: Array.from(group.zones),  // Todas las zonas cubiertas
        deliveryType: dispatchType as "MOTO" | "COURIER",
        chargeType,
        amountToCollect: chargeType === "CONTRA_ENTREGA" ? groupTotal : undefined,
        notes: notes || undefined,
      };
    });

    await onConfirm(guidesData);
  };

  const handleClose = () => {
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
            {hasMultipleDispatchTypes ? (
              <span className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                Se crearán 2 guías: una para MOTO (Lima) y otra para COURIER (Provincias/Aledañas)
              </span>
            ) : (
              `Se creará una guía con ${selectedOrders.length} pedido(s) seleccionado(s)`
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Alerta de múltiples tipos de despacho */}
          {hasMultipleDispatchTypes && (
            <div className="border border-amber-200 bg-amber-50 rounded-lg p-3">
              <h4 className="font-medium text-amber-800 mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Pedidos con diferentes tipos de despacho
              </h4>
              <p className="text-sm text-amber-700 mb-2">
                Los pedidos incluyen zonas de MOTO (Lima urbano) y COURIER (zonas aledañas/provincias).
                Se creará una guía independiente para cada tipo.
              </p>
              <div className="flex flex-wrap gap-2">
                {uniqueDispatchTypes.map(type => (
                  <Badge
                    key={type}
                    className={type === "MOTO" ? "bg-blue-100 text-blue-800" : "bg-orange-100 text-orange-800"}
                  >
                    {type === "MOTO" ? "🏍️ MOTO" : "📦 COURIER"}: {ordersByDispatchType[type].orders.length} pedido(s)
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Resumen de pedidos agrupados por dispatchType */}
          <div className="border rounded-lg p-3 bg-muted/30">
            <h4 className="font-medium mb-2">Pedidos incluidos:</h4>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {uniqueDispatchTypes.map(dispatchType => {
                const group = ordersByDispatchType[dispatchType];
                return (
                  <div key={dispatchType}>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={dispatchType === "MOTO" ? "bg-blue-100 text-blue-800" : "bg-orange-100 text-orange-800"}>
                        {dispatchType === "MOTO" ? "🏍️ MOTO" : "📦 COURIER"}
                      </Badge>
                      <div className="flex flex-wrap gap-1">
                        {Array.from(group.zones).map(zone => (
                          <Badge key={zone} variant="outline" className="text-xs">
                            {ZONE_LABELS[zone] || zone}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1 pl-2">
                      {group.orders.map(order => (
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
                    {/* Subtotal por grupo */}
                    {getGroupTotal(dispatchType) > 0 && (
                      <div className="mt-2 pt-2 border-t flex justify-between text-sm font-medium pl-2">
                        <span>Subtotal {dispatchType === "MOTO" ? "MOTO" : "COURIER"}:</span>
                        <span className="text-red-600">S/{getGroupTotal(dispatchType).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Fecha de hoy (solo display) */}
          <div className="space-y-2">
            <Label>Fecha de creación</Label>
            <Input
              value={todayFormatted}
              disabled
              className="capitalize"
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
                {hasMultipleDispatchTypes
                  ? `Generar ${uniqueDispatchTypes.length} Guías`
                  : "Generar Guía"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

