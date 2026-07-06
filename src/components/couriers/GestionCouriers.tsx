"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Plus,
  Edit,
  Trash2,
  ChevronDown,
  Truck,
  Store,
  PackageCheck,
  Phone,
  Mail,
  Search,
  Loader2,
  DollarSign,
  LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchCouriers,
  fetchCourierGuides,
  createCourier,
  updateCourier,
  deleteCourier,
  Courier,
  ShippingGuide,
  CourierSettlementModel,
} from "@/services/courierService";
import GuideDetailsModal from "@/components/modals/GuideDetailsModal";

// ---- Settlement model config ----

interface SettlementConfig {
  label: string;
  description: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
}

const SETTLEMENT_CONFIG: Record<CourierSettlementModel, SettlementConfig> = {
  [CourierSettlementModel.COURIER_COLLECTS_AND_SETTLES]: {
    label: "Courier cobra",
    description: "El courier cobra al cliente y rinde al negocio",
    icon: Truck,
    iconBg: "bg-amber-100 dark:bg-amber-900/40",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  [CourierSettlementModel.BUSINESS_COLLECTS]: {
    label: "Negocio cobra",
    description: "El cliente paga al negocio. El negocio paga el flete al courier",
    icon: Store,
    iconBg: "bg-blue-100 dark:bg-blue-900/40",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  [CourierSettlementModel.PREPAID_SHIPPING]: {
    label: "Prepagado",
    description: "El envío fue pagado al momento de crear la guía",
    icon: PackageCheck,
    iconBg: "bg-purple-100 dark:bg-purple-900/40",
    iconColor: "text-purple-600 dark:text-purple-400",
  },
};

// ---- Guide status config ----

const GUIDE_STATUS_MAP: Record<string, { label: string; cls: string }> = {
  CREADA: { label: "Creada", cls: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300" },
  ASIGNADA: { label: "Asignada", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" },
  EN_RUTA: { label: "En ruta", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" },
  ENTREGADA: { label: "Entregada", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" },
  FALLIDA: { label: "Fallida", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" },
  CANCELADA: { label: "Cancelada", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" },
};

// ---- Component ----

export default function GestionCouriers() {
  const { auth } = useAuth();
  const companyId = auth?.company?.id;

  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [courierGuides, setCourierGuides] = useState<Record<string, ShippingGuide[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadingGuides, setLoadingGuides] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("all");

  const [courierModalOpen, setCourierModalOpen] = useState(false);
  const [editingCourier, setEditingCourier] = useState<Courier | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [selectedGuideId, setSelectedGuideId] = useState<string | null>(null);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);

  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [settlementModel, setSettlementModel] = useState<CourierSettlementModel>(
    CourierSettlementModel.COURIER_COLLECTS_AND_SETTLES,
  );

  const loadCouriers = useCallback(async () => {
    if (!companyId) return;
    setIsLoading(true);
    try {
      const data = await fetchCouriers(companyId);
      setCouriers(data);
    } catch {
      toast.error("Error al cargar couriers");
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (companyId) loadCouriers();
  }, [companyId, loadCouriers]);

  const loadGuides = useCallback(async (courierId: string) => {
    setLoadingGuides((prev) => ({ ...prev, [courierId]: true }));
    try {
      const guides = await fetchCourierGuides(courierId);
      setCourierGuides((prev) => ({ ...prev, [courierId]: guides }));
    } catch {
      toast.error("Error al cargar guías del courier");
    } finally {
      setLoadingGuides((prev) => ({ ...prev, [courierId]: false }));
    }
  }, []);

  const toggleExpand = (courierId: string) => {
    if (expandedId === courierId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(courierId);
    if (!courierGuides[courierId]) {
      loadGuides(courierId);
    }
  };

  const handleOpenModal = (courier?: Courier) => {
    if (courier) {
      setEditingCourier(courier);
      setForm({ name: courier.name, phone: courier.phone ?? "", email: courier.email ?? "" });
      setSettlementModel(
        courier.settlementModel ?? CourierSettlementModel.COURIER_COLLECTS_AND_SETTLES,
      );
    } else {
      setEditingCourier(null);
      setForm({ name: "", phone: "", email: "" });
      setSettlementModel(CourierSettlementModel.COURIER_COLLECTS_AND_SETTLES);
    }
    setCourierModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) { toast.error("El nombre es requerido"); return; }
    if (!companyId) return;
    setIsSaving(true);
    try {
      if (editingCourier) {
        await updateCourier(editingCourier.id, { ...form, settlementModel });
        toast.success("Courier actualizado");
      } else {
        await createCourier({ ...form, companyId, settlementModel });
        toast.success("Courier creado");
      }
      setCourierModalOpen(false);
      loadCouriers();
    } catch {
      toast.error("Error al guardar courier");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (courier: Courier) => {
    if (!confirm(`¿Desactivar al courier "${courier.name}"?`)) return;
    try {
      await deleteCourier(courier.id);
      toast.success("Courier desactivado");
      loadCouriers();
    } catch {
      toast.error("Error al desactivar courier");
    }
  };

  const filtered = couriers.filter((c) => {
    const matchName = c.name.toLowerCase().includes(search.toLowerCase());
    const matchEstado =
      estadoFilter === "all" ||
      (estadoFilter === "activo" ? c.isActive : !c.isActive);
    return matchName && matchEstado;
  });

  return (
    <div className="space-y-5">
      {/* TOOLBAR */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-[15px] font-bold text-foreground">
            <Truck className="h-4 w-4 text-muted-foreground" />
            Repartidores / Couriers
          </div>
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-border rounded-lg px-3 py-2 min-w-[200px] shadow-sm">
            <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar courier..."
              className="border-none outline-none bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground flex-1"
            />
          </div>
          <Select value={estadoFilter} onValueChange={setEstadoFilter}>
            <SelectTrigger className="w-[160px] h-9 text-[12px] bg-white dark:bg-slate-900 shadow-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="activo">Activos</SelectItem>
              <SelectItem value="inactivo">Inactivos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => handleOpenModal()}
          className="bg-[#027778] hover:bg-[#016667] text-white gap-2 h-9 text-[12px] font-semibold shadow-sm"
        >
          <Plus className="h-3.5 w-3.5" />
          Nuevo Courier
        </Button>
      </div>

      {/* GRID */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-[13px]">Cargando couriers...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-[13px] text-muted-foreground">
          {search || estadoFilter !== "all"
            ? "Sin resultados para el filtro actual"
            : "No hay couriers registrados."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((courier) => {
            const isExpanded = expandedId === courier.id;
            const guides = courierGuides[courier.id] ?? [];
            const config = courier.settlementModel
              ? SETTLEMENT_CONFIG[courier.settlementModel]
              : null;
            const AvatarIcon = config?.icon ?? Truck;

            return (
              <div
                key={courier.id}
                className={`bg-white dark:bg-slate-900 border rounded-xl overflow-hidden transition-all duration-200 ${
                  isExpanded
                    ? "border-[#027778] shadow-[0_4px_18px_rgba(2,119,120,0.12)]"
                    : "border-border hover:border-[#027778] hover:shadow-[0_4px_18px_rgba(2,119,120,0.08)]"
                } ${!courier.isActive ? "opacity-70" : ""}`}
              >
                {/* HEAD */}
                <div className="p-4 flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      config
                        ? config.iconBg
                        : "bg-slate-100 dark:bg-slate-800"
                    }`}
                  >
                    <AvatarIcon
                      className={`h-5 w-5 ${
                        config ? config.iconColor : "text-slate-500 dark:text-slate-400"
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14px] font-bold text-foreground">
                        {courier.name}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          courier.isActive
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                            : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {courier.isActive ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                      ID: {courier.id.slice(0, 8)}
                    </div>
                    {courier.phone && (
                      <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {courier.phone}
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-[9px] text-muted-foreground mb-0.5 uppercase tracking-wider">
                      Tipo cobro
                    </div>
                    <div className="text-[11px] font-semibold text-foreground">
                      {config ? config.label : "—"}
                    </div>
                    {courier.email && (
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1 justify-end max-w-[100px] truncate">
                        <Mail className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{courier.email}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* METRICS */}
                <div className="grid grid-cols-3 border-t border-b border-border dark:border-slate-800 divide-x divide-border dark:divide-slate-800">
                  <div className="py-2.5 text-center">
                    <div className="text-[15px] font-bold text-muted-foreground">—</div>
                    <div className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">
                      COD Pendiente
                    </div>
                  </div>
                  <div className="py-2.5 text-center">
                    <div className="text-[15px] font-bold text-foreground">
                      {courierGuides[courier.id] !== undefined ? guides.length : "—"}
                    </div>
                    <div className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">
                      Guías activas
                    </div>
                  </div>
                  <div className="py-2.5 text-center">
                    <div className="text-[15px] font-bold text-muted-foreground">—</div>
                    <div className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">
                      Tasa entrega
                    </div>
                  </div>
                </div>

                {/* ACTIONS */}
                <div className="px-4 py-2.5 flex items-center justify-between">
                  <div className="flex gap-2">
                    <button
                      onClick={() => toast.info("Próximamente disponible")}
                      className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-md bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                    >
                      <DollarSign className="h-3 w-3" />
                      Tarifas
                    </button>
                    <button
                      onClick={() => handleOpenModal(courier)}
                      className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-md bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-border hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Edit className="h-3 w-3" />
                      Editar
                    </button>
                    {courier.isActive && (
                      <button
                        onClick={() => handleDelete(courier)}
                        className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-md bg-white dark:bg-slate-900 text-red-500 dark:text-red-400 border border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => toggleExpand(courier.id)}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-[#027778] transition-colors"
                  >
                    Ver guías
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                    />
                  </button>
                </div>

                {/* EXPANDED — guides */}
                {isExpanded && (
                  <div className="border-t border-border dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <div className="px-4 py-2.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Guías asignadas
                      </span>
                    </div>
                    {loadingGuides[courier.id] ? (
                      <div className="flex items-center gap-2 px-4 pb-4 text-[12px] text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Cargando guías...
                      </div>
                    ) : guides.length === 0 ? (
                      <p className="px-4 pb-4 text-[12px] text-muted-foreground italic">
                        Sin guías registradas para este courier.
                      </p>
                    ) : (
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border dark:border-slate-700">
                            <th className="text-left px-4 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Nº Guía
                            </th>
                            <th className="text-left px-4 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Fecha
                            </th>
                            <th className="text-left px-4 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Estado
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {guides.map((guide) => {
                            const statusInfo =
                              GUIDE_STATUS_MAP[guide.status] ?? {
                                label: guide.status,
                                cls: "bg-slate-100 text-slate-600",
                              };
                            return (
                              <tr
                                key={guide.id}
                                className="border-t border-border/50 dark:border-slate-700/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                                onClick={() => {
                                  setSelectedGuideId(guide.id);
                                  setIsGuideModalOpen(true);
                                }}
                              >
                                <td className="px-4 py-2 text-[12px] font-medium text-[#027778]">
                                  {guide.guideNumber}
                                </td>
                                <td className="px-4 py-2 text-[12px] text-muted-foreground">
                                  {new Date(guide.created_at).toLocaleDateString("es-PE")}
                                </td>
                                <td className="px-4 py-2">
                                  <span
                                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${statusInfo.cls}`}
                                  >
                                    {statusInfo.label}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL CRUD */}
      <Dialog open={courierModalOpen} onOpenChange={setCourierModalOpen}>
        <DialogContent className="max-w-[520px] p-0 rounded-xl overflow-hidden">
          <DialogHeader className="p-5 pb-4 border-b">
            <DialogTitle className="text-[16px] font-bold flex items-center gap-2">
              <Truck className="h-4 w-4 text-[#027778]" />
              {editingCourier ? "Editar Courier" : "Nuevo Courier"}
            </DialogTitle>
            {!editingCourier && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Se agregará a la lista de repartidores activos
              </p>
            )}
          </DialogHeader>

          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Nombre <span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Shalom, Indriver 4..."
                className="h-10 text-[13px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Teléfono
                </Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="999 000 111"
                  className="h-10 text-[13px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Email
                </Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="courier@empresa.com"
                  className="h-10 text-[13px]"
                />
              </div>
            </div>

            {/* Settlement model chips */}
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Modelo de cobro
              </Label>
              <div className="flex flex-col gap-2">
                {(Object.values(CourierSettlementModel) as CourierSettlementModel[]).map((value) => {
                  const cfg = SETTLEMENT_CONFIG[value];
                  const Icon = cfg.icon;
                  const isSelected = settlementModel === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSettlementModel(value)}
                      className={`flex items-start gap-3 px-4 py-3 rounded-lg border-[1.5px] text-left transition-all ${
                        isSelected
                          ? "border-[#027778] bg-[#027778]/5 dark:bg-[#027778]/10"
                          : "border-border hover:border-[#027778]/50 bg-white dark:bg-slate-900"
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.iconBg}`}
                      >
                        <Icon className={`h-4 w-4 ${cfg.iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-[13px] font-semibold ${
                            isSelected ? "text-[#027778]" : "text-foreground"
                          }`}
                        >
                          {cfg.label}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                          {cfg.description}
                        </div>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-1 transition-colors ${
                          isSelected
                            ? "border-[#027778] bg-[#027778]"
                            : "border-border"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-lg p-3 text-[11px] text-emerald-700 dark:text-emerald-400 leading-relaxed">
              💡 Después de crear el courier podés configurar sus tarifas por zona en{" "}
              <strong>Administración → Tarifas y Costos</strong>
            </div>
          </div>

          <DialogFooter className="p-4 px-5 border-t bg-muted/30 flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setCourierModalOpen(false)}
              disabled={isSaving}
              className="h-9 text-[13px]"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-[#027778] hover:bg-[#016667] text-white h-9 text-[13px] font-semibold"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Guardando...
                </>
              ) : editingCourier ? (
                "Guardar cambios"
              ) : (
                "Crear courier"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GUIDE MODAL */}
      <GuideDetailsModal
        open={isGuideModalOpen}
        onClose={() => {
          setIsGuideModalOpen(false);
          setSelectedGuideId(null);
        }}
        guideId={selectedGuideId || undefined}
        onGuideUpdated={() => {
          if (expandedId) {
            const id = expandedId;
            setLoadingGuides((prev) => ({ ...prev, [id]: true }));
            fetchCourierGuides(id)
              .then((guides) =>
                setCourierGuides((prev) => ({ ...prev, [id]: guides }))
              )
              .catch(() => toast.error("Error al recargar guías"))
              .finally(() =>
                setLoadingGuides((prev) => ({ ...prev, [id]: false }))
              );
          }
        }}
        isCourierView={true}
      />
    </div>
  );
}
