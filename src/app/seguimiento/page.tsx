"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Eye, Search, Package, Phone, User, Truck, FileText } from "lucide-react";

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

import { OrderHeader } from "@/interfaces/IOrder";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast } from "sonner";
import ProvinciaShipmentModal from "@/components/modals/ProvinciaShipmentModal";
import { useRouter } from "next/navigation";


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
  deliveryZone: string;
  deliveryType: string;
  deliveryAddress?: string | null;
  notes?: string | null;
  trackingUrl?: string | null;
  externalCarrierId?: string | null;
  externalGuideReference?: string | null;
  shippingKey?: string | null;
  shippingOffice?: string | null;
  shippingProofUrl?: string | null;
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
  daysRange: "" | "0-7" | "8-15" | "16-30" | "30+";
  hasPendingPayment: "" | "yes" | "no";
  region: "" | "LIMA" | "PROVINCIA";
  guideStatus: string;
}

const emptyFilters: SeguimientoFilters = {
  search: "",
  courier: "",
  daysRange: "",
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

const DAYS_RANGES = [
  { value: "", label: "Todos" },
  { value: "0-7", label: "0-7 días" },
  { value: "8-15", label: "8-15 días" },
  { value: "16-30", label: "16-30 días" },
  { value: "30+", label: "Más de 30 días" },
];

const GUIDE_STATUSES = [
  { value: "", label: "Todos" },
  { value: "CREADA", label: "Creada" },
  { value: "ASIGNADA", label: "Asignada" },
  { value: "EN_RUTA", label: "En Ruta" },
  { value: "ENTREGADA", label: "Entregada" },
  { value: "PARCIAL", label: "Parcial" },
  { value: "FALLIDA", label: "Fallida" },
  { value: "CANCELADA", label: "Cancelada" },
];

/* -----------------------------------------
   Helper functions
----------------------------------------- */
const calculatePendingPayment = (order: OrderHeader): number => {
  if (!order) return 0;
  const grandTotal = parseFloat(order.grandTotal) || 0;
  if (!order.payments) return grandTotal;
  const totalPaid = order.payments
    .filter(p => p && p.status === "PAID")
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
  const [envios, setEnvios] = useState<EnvioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<SeguimientoFilters>(emptyFilters);
  
  // Modal state
  const [selectedEnvio, setSelectedEnvio] = useState<EnvioItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  
  // Notes Modal state
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [selectedGuideForNotes, setSelectedGuideForNotes] = useState<{ id: string; notes: string } | null>(null);

  const {auth ,selectedStoreId } = useAuth();


  const router = useRouter();

  useEffect(() => {
    if (!auth) router.push("/login");
  }, [auth, router]);
    

  // Fetch orders with EN_ENVIO status
  const fetchEnvios = useCallback(async () => {
    if (!selectedStoreId) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const ordersRes = await axios.get<OrderHeader[]>(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/store/${selectedStoreId}`
      );

      const orders = ordersRes.data.filter(o => o.status === "EN_ENVIO");
      
      const envioItems: EnvioItem[] = await Promise.all(
        orders.map(async (order) => {
          let guide: ShippingGuide | null = null;
          let daysSinceCreated = 0;

          if (order.guideNumber) {
            try {
              const guideRes = await axios.get<ShippingGuide>(
                `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/order/${order.id}`
              );
              guide = guideRes.data;
              
              if (guide?.created_at) {
                const createdDate = new Date(guide.created_at);
                const today = new Date();
                const diffTime = Math.abs(today.getTime() - createdDate.getTime());
                daysSinceCreated = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              }
            } catch (error) {
              console.error(`Error fetching guide for order ${order.id}:`, error);
            }
          }

          return { order, guide, daysSinceCreated };
        })
      );

      setEnvios(envioItems);

      // Actualizar modal si está abierto (usando actualización funcional para evitar loop)
      setSelectedEnvio((prev) => {
        if (!prev) return null;
        const updated = envioItems.find(item => item.order.id === prev.order.id);
        return updated || prev;
      });
    } catch (error) {
      console.error("Error fetching envios:", error);
      toast.error("Error al cargar los envíos");
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    fetchEnvios();
  }, [selectedStoreId, fetchEnvios]);

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
        if (!clientName.includes(searchLower) && !phone.includes(filters.search) && !orderNumber.includes(searchLower)) {
          return false;
        }
      }

      // Courier filter (case-insensitive)
      if (filters.courier) {
        const courierName = (guide?.courierName || order.courier || "").toLowerCase();
        if (!courierName.includes(filters.courier.toLowerCase())) {
          return false;
        }
      }

      // Days range filter
      if (filters.daysRange) {
        if (filters.daysRange === "0-7" && daysSinceCreated > 7) return false;
        if (filters.daysRange === "8-15" && (daysSinceCreated < 8 || daysSinceCreated > 15)) return false;
        if (filters.daysRange === "16-30" && (daysSinceCreated < 16 || daysSinceCreated > 30)) return false;
        if (filters.daysRange === "30+" && daysSinceCreated <= 30) return false;
      }

      // Pending payment filter
      const pendingPayment = calculatePendingPayment(order);
      if (filters.hasPendingPayment === "yes" && pendingPayment <= 0) return false;
      if (filters.hasPendingPayment === "no" && pendingPayment > 0) return false;

      // Region filter
      if (filters.region && order.salesRegion !== filters.region) return false;

      // Guide status filter
      if (filters.guideStatus && guide?.status !== filters.guideStatus) return false;

      return true;
    });
  }, [envios, filters]);

  const updateFilter = <K extends keyof SeguimientoFilters>(key: K, value: SeguimientoFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
  };

  const handleRowClick = (item: EnvioItem) => {
    setSelectedEnvio(item);
    setModalOpen(true);
  };

  const getDaysColor = (days: number) => {
    return "text-red-600 font-bold";
  };

  const handleStatusChange = async (guideId: string, newStatus: string, pendingPayment: number) => {
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
        { status: newStatus }
      );
      toast.success(`Estado actualizado a ${newStatus}`);
      fetchEnvios();
    } catch (error: any) {
      const message = error?.response?.data?.message || "Error al cambiar estado";
      toast.error(message);
    }
  };

  const handleOpenNotes = (guide: ShippingGuide) => {
    setSelectedGuideForNotes({ id: guide.id, notes: guide.notes || "[]" });
    setNotesModalOpen(true);
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Pedidos En Envío ({filteredEnvios.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="mb-4 p-4 border rounded-lg bg-muted/30">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {/* Search */}
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Buscar (cliente, teléfono, N° orden)</Label>
                  <Input
                    placeholder="Buscar..."
                    value={filters.search}
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
                    onChange={(e) => updateFilter("courier", e.target.value)}
                  >
                    <option value="">Todos</option>
                    {COURIERS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Days Range */}
                <div className="space-y-1">
                  <Label className="text-xs">Días transcurridos</Label>
                  <select
                    className="w-full h-8 text-sm border rounded-md px-2 bg-background text-foreground"
                    value={filters.daysRange}
                    onChange={(e) => updateFilter("daysRange", e.target.value as SeguimientoFilters["daysRange"])}
                  >
                    {DAYS_RANGES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>

                {/* Pending Payment */}
                <div className="space-y-1">
                  <Label className="text-xs">Saldo pendiente</Label>
                  <select
                    className="w-full h-8 text-sm border rounded-md px-2 bg-background text-foreground"
                    value={filters.hasPendingPayment}
                    onChange={(e) => updateFilter("hasPendingPayment", e.target.value as "" | "yes" | "no")}
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
                    onChange={(e) => updateFilter("region", e.target.value as "" | "LIMA" | "PROVINCIA")}
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
                    onChange={(e) => updateFilter("guideStatus", e.target.value)}
                  >
                    {GUIDE_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {Object.values(filters).some(v => v !== "") && (
                <div className="mt-3">
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs">
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° Orden</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Región</TableHead>
                    <TableHead>Enviado Por</TableHead>
                    <TableHead>Días</TableHead>
                    <TableHead>Estado Envío</TableHead>
                    <TableHead>Saldo</TableHead>
                    <TableHead>Guía</TableHead>
                    <TableHead>Resumen</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
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
                        className={`hover:bg-muted/50 ${isProvincia ? "bg-amber-50/50 dark:bg-amber-950/20" : ""}`}
                      >
                        <TableCell className="font-medium">{order.orderNumber}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3 text-muted-foreground" />
                            {order.customer?.fullName || "-"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {order.customer?.phoneNumber || "-"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={isProvincia ? "secondary" : "outline"}>
                            {order.salesRegion}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Truck className="h-3 w-3 text-muted-foreground" />
                            {guide?.courierName || order.courier || "-"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={getDaysColor(daysSinceCreated)}>
                            {daysSinceCreated} días
                          </span>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={guide?.status || "CREADA"}
                            onValueChange={(val) => guide && handleStatusChange(guide.id, val, pendingPayment)}
                            disabled={!guide}
                          >
                            <SelectTrigger className={`h-8 w-[130px] text-xs font-semibold ${
                              guide?.status === "ENTREGADA" ? "bg-green-100 text-green-800 border-green-200" : 
                              guide?.status === "EN_RUTA" ? "bg-blue-100 text-blue-800 border-blue-200" :
                              guide?.status === "FALLIDA" || guide?.status === "CANCELADA" ? "bg-red-100 text-red-800 border-red-200" :
                              "bg-gray-100 text-gray-800 border-gray-200"
                            }`}>
                              <SelectValue placeholder="Estado" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="CREADA">Creada</SelectItem>
                              <SelectItem value="ASIGNADA">Asignada</SelectItem>
                              <SelectItem value="EN_RUTA">En Ruta</SelectItem>
                              <SelectItem value="ENTREGADA">Entregada</SelectItem>
                              <SelectItem value="PARCIAL">Parcial</SelectItem>
                              <SelectItem value="FALLIDA">Fallida</SelectItem>
                              <SelectItem value="CANCELADA">Cancelada</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
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
                        <TableCell>
                          {guide?.guideNumber || order.guideNumber || "-"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1"
                            onClick={() => handleRowClick(item)}
                          >
                            <FileText className="h-4 w-4" />
                            Ver
                          </Button>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="relative h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (guide) handleOpenNotes(guide);
                              }}
                              disabled={!guide}
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
            )}
          </CardContent>
        </Card>

        {/* Modal for shipment details */}
        <ProvinciaShipmentModal
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelectedEnvio(null);
          }}
          envioItem={selectedEnvio}
          onUpdate={fetchEnvios}
        />

        {/* Notes Modal */}
        {selectedGuideForNotes && (
          <ShippingNotesModal
            open={notesModalOpen}
            onClose={() => {
              setNotesModalOpen(false);
              setSelectedGuideForNotes(null);
            }}
            guideId={selectedGuideForNotes.id}
            initialNotes={selectedGuideForNotes.notes}
            onNoteAdded={fetchEnvios}
          />
        )}
      </main>
    </div>
  );
}
