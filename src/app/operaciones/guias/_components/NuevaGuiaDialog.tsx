"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Loader2, PackagePlus, FolderInput, Search, Lock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useOperationsRole, OPS_PERMISSIONS } from "@/contexts/OperationsRoleContext";
import { OrderHeader } from "@/interfaces/IOrder";
import { DELIVERY_ZONES } from "@/constants/operationsDomain";
import { getPedidosTab } from "@/utils/domain/operations-pedidos-tabs";
import { getPendingPayment } from "@/app/centro-envios/components/shipmentUtils";
import CreateGuideModal, { CreateGuideData } from "@/components/modals/CreateGuideModal";
import AddToExistingGuideModal from "@/components/modals/AddToExistingGuideModal";
import GuideDetailsModal from "@/components/modals/GuideDetailsModal";

/* -----------------------------------------------------------------------
   "+ Nueva guía" — antes era una pestaña propia ("Armar Guía"), el mockup
   v6 la sacó de ahí: ahora el único lugar donde se arma una guía es
   Pedidos › Por Despachar, y este botón del header abre el mismo picker
   como diálogo en vez de pestaña, para seguir teniendo una entrada directa
   desde Guías & Courier sin duplicar el flujo de armado.
------------------------------------------------------------------------ */

const ZONE_MAP = new Map(DELIVERY_ZONES.map((z) => [z.value, z]));

function suggestedDispatch(zone?: string | null): string {
  if (zone === "ZONAS_ALEDANAS" || zone === "PROVINCIAS") return "📦 Courier";
  return "🏍️ Moto";
}

function money(n: number): string {
  return `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function NuevaGuiaDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { selectedStoreId } = useAuth();
  const { can } = useOperationsRole();
  const canDispatch = can(OPS_PERMISSIONS.DISPATCH);

  const [orders, setOrders] = useState<OrderHeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [zoneFilter, setZoneFilter] = useState<string>("ALL");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [detailsGuideId, setDetailsGuideId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const load = async () => {
    if (!selectedStoreId) return;
    setLoading(true);
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/store/${selectedStoreId}`,
      );
      setOrders(res.data ?? []);
    } catch {
      toast.error("No se pudieron cargar los pedidos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedStoreId]);

  // Elegibles para armar guía: confirmados/listos para despachar, con
  // entrega a domicilio y que TODAVÍA no tengan una guía asignada.
  const eligible = useMemo(() => {
    return orders.filter(
      (o) => o.deliveryType === "DOMICILIO" && !o.guideNumber && getPedidosTab(o) === "despachar",
    );
  }, [orders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return eligible.filter((o) => {
      if (zoneFilter !== "ALL" && o.customer?.zone !== zoneFilter) return false;
      if (!q) return true;
      return (
        o.orderNumber?.toLowerCase().includes(q) ||
        o.customer?.fullName?.toLowerCase().includes(q) ||
        o.customer?.district?.toLowerCase().includes(q)
      );
    });
  }, [eligible, search, zoneFilter]);

  const selectedOrders = useMemo(
    () =>
      orders
        .filter((o) => selectedIds.has(o.id))
        .map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          clientName: o.customer?.fullName ?? "-",
          address: o.customer?.address ?? "-",
          district: o.customer?.district ?? "-",
          total: Number(o.grandTotal || 0),
          pendingPayment: getPendingPayment(o),
          zone: o.customer?.zone,
        })),
    [orders, selectedIds],
  );

  const totalPending = selectedOrders.reduce((acc, o) => acc + o.pendingPayment, 0);

  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(filtered.map((o) => o.id)) : new Set());
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleCreateGuide = async (guidesData: CreateGuideData[]) => {
    setSubmitting(true);
    try {
      let lastGuideId: string | null = null;
      for (const guideData of guidesData) {
        const res = await axios.post(
          `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides`,
          guideData,
        );
        const guideNumber = res.data.guideNumber;
        lastGuideId = res.data.id;
        for (const orderId of guideData.orderIds) {
          await axios.patch(`${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`, {
            guideNumber,
            status: "ASIGNADO_A_GUIA",
            courier: guideData.courierName,
            courierId: guideData.courierId || null,
          });
        }
      }
      toast.success("Guía generada correctamente");
      setCreateModalOpen(false);
      setSelectedIds(new Set());
      await load();
      if (lastGuideId) {
        setDetailsGuideId(lastGuideId);
        setDetailsOpen(true);
      }
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } } };
      toast.error(axiosError?.response?.data?.message || "Error generando la guía");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddToExisting = async (guideId: string, guideNumber: string) => {
    setSubmitting(true);
    try {
      const orderIds = selectedOrders.map((o) => o.id);
      // NOTA: no existe hoy en el resto del código un endpoint documentado
      // "orders/add" (solo se confirmó /orders/remove, ver GuideDetailsModal).
      // Se infiere por simetría con ese endpoint — VERIFICAR con backend
      // antes de confiar en este flujo en producción.
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/${guideId}/orders/add`,
        { orderIds },
      );
      for (const orderId of orderIds) {
        await axios.patch(`${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`, {
          guideNumber,
          status: "ASIGNADO_A_GUIA",
        });
      }
      toast.success(`Pedidos agregados a la guía ${guideNumber}`);
      setAddModalOpen(false);
      setSelectedIds(new Set());
      await load();
      setDetailsGuideId(guideId);
      setDetailsOpen(true);
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } } };
      toast.error(axiosError?.response?.data?.message || "Error agregando pedidos a la guía");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackagePlus className="h-5 w-5 text-teal-600" />
              Nueva guía de envío
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando pedidos listos para armar guía…
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[220px] flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por orden, cliente o distrito…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Select value={zoneFilter} onValueChange={setZoneFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Zona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todas las zonas</SelectItem>
                    {DELIVERY_ZONES.map((z) => (
                      <SelectItem key={z.value} value={z.value}>
                        {z.emoji} {z.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!canDispatch && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" /> Sin permiso para despachar
                </span>
              )}

              {selectedIds.size > 0 && (
                <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                  <b>{selectedIds.size}</b> pedido(s) seleccionados · Por cobrar:{" "}
                  <b className="text-red-600">{money(totalPending)}</b>
                </div>
              )}

              <div className="max-h-[42vh] overflow-y-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/60">
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300"
                          checked={filtered.length > 0 && filtered.every((o) => selectedIds.has(o.id))}
                          onChange={(e) => toggleAll(e.target.checked)}
                        />
                      </th>
                      <th className="px-3 py-2">Pedido</th>
                      <th className="px-3 py-2">Cliente</th>
                      <th className="px-3 py-2">Zona</th>
                      <th className="px-3 py-2">Distrito</th>
                      <th className="px-3 py-2">Despacho sugerido</th>
                      <th className="px-3 py-2 text-right">Por cobrar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-muted-foreground">
                          No hay pedidos confirmados esperando guía.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((o) => (
                        <tr
                          key={o.id}
                          className="cursor-pointer border-t hover:bg-muted/30"
                          onClick={() => toggleOne(o.id, !selectedIds.has(o.id))}
                        >
                          <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-gray-300"
                              checked={selectedIds.has(o.id)}
                              onChange={(e) => toggleOne(o.id, e.target.checked)}
                            />
                          </td>
                          <td className="px-3 py-2 font-semibold">{o.orderNumber}</td>
                          <td className="px-3 py-2">{o.customer?.fullName}</td>
                          <td className="px-3 py-2">
                            {o.customer?.zone ? (
                              <Badge variant="outline" className="text-[10px]">
                                {ZONE_MAP.get(o.customer.zone)?.emoji} {ZONE_MAP.get(o.customer.zone)?.label}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">Sin zona</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{o.customer?.district || "-"}</td>
                          <td className="px-3 py-2 text-xs">{suggestedDispatch(o.customer?.zone)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{money(getPendingPayment(o))}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  disabled={selectedIds.size === 0 || !canDispatch}
                  onClick={() => setAddModalOpen(true)}
                  className="gap-1.5"
                >
                  <FolderInput className="h-4 w-4" />
                  Agregar a guía existente
                </Button>
                <Button
                  disabled={selectedIds.size === 0 || !canDispatch}
                  onClick={() => setCreateModalOpen(true)}
                  className="gap-1.5 bg-teal-600 hover:bg-teal-700"
                >
                  <PackagePlus className="h-4 w-4" />
                  Generar guía ({selectedIds.size})
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <CreateGuideModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        selectedOrders={selectedOrders}
        storeId={selectedStoreId || ""}
        onConfirm={handleCreateGuide}
        isLoading={submitting}
      />

      <AddToExistingGuideModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        selectedOrders={selectedOrders}
        storeId={selectedStoreId || ""}
        onConfirm={handleAddToExisting}
        isLoading={submitting}
      />

      <GuideDetailsModal
        open={detailsOpen}
        onClose={() => {
          setDetailsOpen(false);
          onOpenChange(false);
        }}
        guideId={detailsGuideId || undefined}
        onGuideUpdated={load}
      />
    </>
  );
}
