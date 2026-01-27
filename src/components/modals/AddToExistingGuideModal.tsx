"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  PackagePlus,
  Search,
  Info,
  AlertTriangle,
} from "lucide-react";
import axios from "axios";
import { Input } from "@/components/ui/input";

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

interface ShippingGuide {
  id: string;
  guideNumber: string;
  status: string;
  deliveryType: string;
  deliveryZones: string[];
  orderIds: string[];
  created_at: string;
  courierName?: string | null;
}

interface AddToExistingGuideModalProps {
  open: boolean;
  onClose: () => void;
  selectedOrders: SelectedOrder[];
  storeId: string;
  onConfirm: (guideId: string, guideNumber: string) => Promise<void>;
  isLoading?: boolean;
}

// Mapeo simple de zona a tipo de despacho (MOTO/COURIER)
const getDispatchTypeFromZone = (zone: string): string => {
  if (zone === "ZONAS_ALEDANAS" || zone === "PROVINCIAS") {
    return "COURIER";
  }
  return "MOTO";
};

export default function AddToExistingGuideModal({
  open,
  onClose,
  selectedOrders,
  storeId,
  onConfirm,
  isLoading = false,
}: AddToExistingGuideModalProps) {
  const [guides, setGuides] = useState<ShippingGuide[]>([]);
  const [loadingGuides, setLoadingGuides] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedGuideId, setSelectedGuideId] = useState<string | null>(null);

  // 1. Determinar el dispatchType de los pedidos seleccionados
  const ordersDispatchType = useMemo(() => {
    if (selectedOrders.length === 0) return null;
    const types = new Set(
      selectedOrders.map((o) =>
        getDispatchTypeFromZone(o.zone || "LIMA_CENTRO"),
      ),
    );
    return types.size === 1 ? Array.from(types)[0] : "MIXED";
  }, [selectedOrders]);

  // 2. Fetch de guías habilitadas
  useEffect(() => {
    if (open && storeId) {
      const fetchGuides = async () => {
        setLoadingGuides(true);
        try {
          // Buscamos guías con estado CREADA o ASIGNADA por ahora
          // Podríamos hacer dos llamadas o filtrar en el frontend
          const res = await axios.get<ShippingGuide[]>(
            `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/store/${storeId}`,
          );

          // Solo guías activas que no estén terminadas ni canceladas
          const activeGuides = res.data.filter(
            (g) =>
              g.status === "CREADA" ||
              g.status === "ASIGNADA" ||
              g.status === "EN_RUTA",
          );

          setGuides(activeGuides);
        } catch (error) {
          console.error("Error fetching guides:", error);
        } finally {
          setLoadingGuides(false);
        }
      };
      fetchGuides();
    }
  }, [open, storeId]);

  // 3. Filtrar guías por compatibilidad y búsqueda
  const filteredGuides = useMemo(() => {
    return guides.filter((guide) => {
      // Compatibilidad de tipo de despacho
      const isCompatible = guide.deliveryType === ordersDispatchType;

      // Búsqueda por número de guía o courier
      const matchesSearch =
        guide.guideNumber.toLowerCase().includes(search.toLowerCase()) ||
        (guide.courierName?.toLowerCase() || "").includes(search.toLowerCase());

      return isCompatible && matchesSearch;
    });
  }, [guides, ordersDispatchType, search]);

  const handleConfirm = async () => {
    if (!selectedGuideId) return;
    const guide = guides.find((g) => g.id === selectedGuideId);
    if (guide) {
      await onConfirm(guide.id, guide.guideNumber);
    }
  };

  const isMixed = ordersDispatchType === "MIXED";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5" />
            Agregar a Guía Existente
          </DialogTitle>
          <DialogDescription>
            Selecciona una guía compatible para añadir {selectedOrders.length}{" "}
            pedido(s).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isMixed && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md flex items-start gap-2 text-sm">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <p>
                Los pedidos seleccionados tienen diferentes tipos de despacho
                (MOTO y COURIER). Por favor selecciona solo pedidos compatibles
                entre sí.
              </p>
            </div>
          )}

          {!isMixed && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 p-3 rounded-md flex items-start gap-2 text-sm">
              <Info className="h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-medium">
                  Tipo de despacho requerido: {ordersDispatchType}
                </p>
                <p className="mt-1">
                  Solo se muestran guías de tipo{" "}
                  {ordersDispatchType === "MOTO" ? "🏍️ MOTO" : "📦 COURIER"}.
                </p>
              </div>
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por N° Guía o Courier..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={isMixed}
            />
          </div>

          <div className="border rounded-md max-h-[300px] overflow-y-auto">
            {loadingGuides ? (
              <div className="p-8 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-2">
                  Cargando guías...
                </p>
              </div>
            ) : filteredGuides.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {isMixed
                  ? "Corrige la selección de pedidos"
                  : "No se encontraron guías compatibles"}
              </div>
            ) : (
              <div className="divide-y">
                {filteredGuides.map((guide) => (
                  <div
                    key={guide.id}
                    className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors flex items-center justify-between ${
                      selectedGuideId === guide.id
                        ? "bg-primary/5 border-l-4 border-l-primary"
                        : ""
                    }`}
                    onClick={() => setSelectedGuideId(guide.id)}
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">
                          {guide.guideNumber}
                        </span>
                        <Badge variant="outline" className="text-[10px] h-4">
                          {guide.status}
                        </Badge>
                        <Badge
                          className={
                            guide.deliveryType === "MOTO"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-orange-100 text-orange-800"
                          }
                        >
                          {guide.deliveryType}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {guide.courierName || "Sin courier asignado"} •{" "}
                        {new Date(guide.created_at).toLocaleDateString()}
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {guide.deliveryZones.map((z) => (
                          <Badge
                            key={z}
                            variant="secondary"
                            className="text-[9px] h-3 px-1"
                          >
                            {z}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-medium">
                        {guide.orderIds.length} pedidos
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || !selectedGuideId || isMixed}
            className="bg-teal-600 hover:bg-teal-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Agregando...
              </>
            ) : (
              "Agregar a esta guía"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
