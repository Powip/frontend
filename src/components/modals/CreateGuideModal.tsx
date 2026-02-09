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
import { PackagePlus, Loader2, AlertTriangle, Truck } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { fetchCouriers, Courier } from "@/services/courierService";

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
  deliveryZones: string[]; // Array de zonas cubiertas
  deliveryType: "MOTO" | "COURIER";
  scheduledDate?: string;
  chargeType?: "PREPAGADO" | "CONTRA_ENTREGA" | "CORTESIA";
  amountToCollect?: number;
  notes?: string;
  courierId?: string;
  courierName?: string;
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
  const { auth } = useAuth();
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [selectedCourierId, setSelectedCourierId] = useState<string>("");
  const [deliveryType, setDeliveryType] = useState<"MOTO" | "COURIER">(
    "COURIER",
  );

  const [chargeType, setChargeType] = useState<
    "PREPAGADO" | "CONTRA_ENTREGA" | "CORTESIA"
  >("CONTRA_ENTREGA");
  const [notes, setNotes] = useState("");

  // Fecha de hoy formateada
  const todayFormatted = new Date().toLocaleDateString("es-PE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Cargar couriers
  useState(() => {
    if (auth?.company?.id) {
      fetchCouriers(auth.company.id).then(setCouriers).catch(console.error);
    }
  });

  const totalAmount = useMemo(() => {
    return selectedOrders.reduce((acc, o) => acc + o.pendingPayment, 0);
  }, [selectedOrders]);

  const handleSubmit = async () => {
    let courierId: string | undefined = undefined;
    let courierName: string | undefined = undefined;

    if (selectedCourierId === "MOTORIZADO_PROPIO") {
      courierName = "Motorizado Propio";
    } else if (selectedCourierId === "OTROS") {
      courierName = "Otros";
    } else {
      const selected = couriers.find((c) => c.id === selectedCourierId);
      if (selected) {
        courierId = selected.id;
        courierName = selected.name;
      }
    }

    const guideData: CreateGuideData = {
      storeId,
      orderIds: selectedOrders.map((o) => o.id),
      deliveryZones: Array.from(
        new Set(selectedOrders.map((o) => o.zone || "SIN_ZONA")),
      ),
      deliveryType,
      chargeType,
      amountToCollect:
        chargeType === "CONTRA_ENTREGA" ? totalAmount : undefined,
      notes: notes || undefined,
      courierId,
      courierName,
    };

    await onConfirm([guideData]);
  };

  const handleClose = () => {
    setChargeType("CONTRA_ENTREGA");
    setNotes("");
    setSelectedCourierId("");
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
            {`Se creará una guía para ${selectedOrders.length} pedido(s)`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-4">
            {/* Selector de Courier */}
            <div className="space-y-2">
              <Label>Courier / Método de Envío</Label>
              <Select
                value={selectedCourierId}
                onValueChange={(v) => {
                  setSelectedCourierId(v);
                  if (v === "MOTORIZADO_PROPIO") {
                    setDeliveryType("MOTO");
                  } else {
                    setDeliveryType("COURIER");
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar courier" />
                </SelectTrigger>
                <SelectContent>
                  {couriers.map((courier) => (
                    <SelectItem key={courier.id} value={courier.id}>
                      {courier.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="MOTORIZADO_PROPIO">
                    Motorizado Propio
                  </SelectItem>
                  <SelectItem value="OTROS">Otros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Resumen de pedidos (Lista simple) */}
          <div className="border rounded-lg p-3 bg-muted/30">
            <h4 className="font-medium mb-2">
              Pedidos a incluir ({selectedOrders.length}):
            </h4>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
              {selectedOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex justify-between items-center text-sm border-b pb-2 last:border-0"
                >
                  <div>
                    <span className="font-medium">{order.orderNumber}</span>
                    <span className="text-muted-foreground ml-2">
                      {order.clientName}
                    </span>
                    <Badge variant="outline" className="ml-2 text-xs">
                      {ZONE_LABELS[order.zone || ""] ||
                        order.zone ||
                        "Sin Zona"}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <span className="text-muted-foreground text-xs block">
                      {order.district}
                    </span>
                    {order.pendingPayment > 0 && (
                      <span className="text-red-600 font-medium">
                        Pendiente: S/{order.pendingPayment.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {totalAmount > 0 && (
              <div className="mt-3 pt-2 border-t flex justify-between font-semibold">
                <span>Total a cobrar:</span>
                <span className="text-red-600">S/{totalAmount.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Fecha de hoy (solo display) */}
          <div className="space-y-2">
            <Label>Fecha de creación</Label>
            <Input value={todayFormatted} disabled className="capitalize" />
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
            disabled={
              isLoading || selectedOrders.length === 0 || !selectedCourierId
            }
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
                Generar Guía
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
