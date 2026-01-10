"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search, X, ChevronDown, ChevronUp, Filter } from "lucide-react";

export interface SalesFilters {
  date: string;
  search: string;
  paymentMethod: string;
  hasPendingBalance: "" | "yes" | "no";
  region: "" | "LIMA" | "PROVINCIA";
  deliveryType: "" | "RETIRO_TIENDA" | "DOMICILIO";
  courier: string;
  zone: string;
  hasGuide: "" | "yes" | "no";
}

export const emptySalesFilters: SalesFilters = {
  date: "",
  search: "",
  paymentMethod: "",
  hasPendingBalance: "",
  region: "",
  deliveryType: "",
  courier: "",
  zone: "",
  hasGuide: "",
};

interface SalesTableFiltersProps {
  filters: SalesFilters;
  onFiltersChange: (filters: SalesFilters) => void;
  showRegionFilter?: boolean;
  showCourierFilter?: boolean;
  showZoneFilter?: boolean;
  showGuideFilter?: boolean;
  availableCouriers?: string[];
}

const PAYMENT_METHODS = [
  { value: "", label: "Todos" },
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
  { value: "TARJETA_DEBITO", label: "Tarjeta Débito" },
  { value: "MERCADO_PAGO", label: "Mercado Pago" },
];

const PENDING_BALANCE_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "yes", label: "Con saldo" },
  { value: "no", label: "Sin saldo" },
];

const REGION_OPTIONS = [
  { value: "", label: "Todas" },
  { value: "LIMA", label: "Lima" },
  { value: "PROVINCIA", label: "Provincia" },
];

const DELIVERY_TYPE_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "RETIRO_TIENDA", label: "Retiro en tienda" },
  { value: "DOMICILIO", label: "Domicilio" },
];

const ZONE_OPTIONS = [
  { value: "", label: "Todas las zonas" },
  { value: "LIMA_NORTE", label: "🟦 Lima Norte" },
  { value: "CALLAO", label: "🟨 Callao" },
  { value: "LIMA_CENTRO", label: "🟩 Lima Centro" },
  { value: "LIMA_SUR", label: "🟪Lima Sur" },
  { value: "LIMA_ESTE", label: "🟧 Lima Este" },
  { value: "ZONAS_ALEDANAS", label: "⛰️ Zonas Aledañas" },
  { value: "PROVINCIAS", label: "🧭 Provincias" },
];

const GUIDE_OPTIONS = [
  { value: "", label: "Todas" },
  { value: "yes", label: "Con guía" },
  { value: "no", label: "Sin guía" },
];

export function SalesTableFilters({
  filters,
  onFiltersChange,
  showRegionFilter = true,
  showCourierFilter = false,
  showZoneFilter = false,
  showGuideFilter = false,
  availableCouriers = [],
}: SalesTableFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateFilter = <K extends keyof SalesFilters>(
    key: K,
    value: SalesFilters[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange(emptySalesFilters);
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== "");
  const activeFiltersCount = Object.values(filters).filter((v) => v !== "").length;

  return (
    <div className="mb-4">
      {/* Toggle Button */}
      <div className="flex items-center gap-2 mb-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="h-8"
        >
          <Filter className="h-4 w-4 mr-2" />
          Filtros
          {activeFiltersCount > 0 && (
            <span className="ml-2 bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs">
              {activeFiltersCount}
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 ml-2" />
          ) : (
            <ChevronDown className="h-4 w-4 ml-2" />
          )}
        </Button>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-8 text-xs text-muted-foreground"
          >
            <X className="h-3 w-3 mr-1" />
            Limpiar
          </Button>
        )}
      </div>

      {/* Collapsible Filters */}
      {isExpanded && (
        <div className="p-4 border rounded-lg bg-muted/30 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Búsqueda */}
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

            {/* Fecha */}
            <div className="space-y-1">
              <Label className="text-xs">Fecha</Label>
              <Input
                type="date"
                value={filters.date}
                onChange={(e) => updateFilter("date", e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            {/* Método de pago */}
            <div className="space-y-1">
              <Label className="text-xs">Método de pago</Label>
              <select
                className="w-full h-8 text-sm border rounded-md px-2 bg-background text-foreground"
                value={filters.paymentMethod}
                onChange={(e) => updateFilter("paymentMethod", e.target.value)}
              >
                {PAYMENT_METHODS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Saldo pendiente */}
            <div className="space-y-1">
              <Label className="text-xs">Saldo pendiente</Label>
              <select
                className="w-full h-8 text-sm border rounded-md px-2 bg-background text-foreground"
                value={filters.hasPendingBalance}
                onChange={(e) =>
                  updateFilter("hasPendingBalance", e.target.value as "" | "yes" | "no")
                }
              >
                {PENDING_BALANCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Región */}
            {showRegionFilter && (
              <div className="space-y-1">
                <Label className="text-xs">Región</Label>
                <select
                  className="w-full h-8 text-sm border rounded-md px-2 bg-background text-foreground"
                  value={filters.region}
                  onChange={(e) =>
                    updateFilter("region", e.target.value as "" | "LIMA" | "PROVINCIA")
                  }
                >
                  {REGION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Tipo de envío */}
            <div className="space-y-1">
              <Label className="text-xs">Tipo de envío</Label>
              <select
                className="w-full h-8 text-sm border rounded-md px-2 bg-background text-foreground"
                value={filters.deliveryType}
                onChange={(e) =>
                  updateFilter(
                    "deliveryType",
                    e.target.value as "" | "RETIRO_TIENDA" | "DOMICILIO"
                  )
                }
              >
                {DELIVERY_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Courier / Enviado Por */}
            {showCourierFilter && (
              <div className="space-y-1">
                <Label className="text-xs">Enviado Por</Label>
                <select
                  className="w-full h-8 text-sm border rounded-md px-2 bg-background text-foreground"
                  value={filters.courier}
                  onChange={(e) => updateFilter("courier", e.target.value)}
                >
                  <option value="">Todos</option>
                  <option value="Motorizado Propio">Motorizado Propio</option>
                  <option value="Shalom">Shalom</option>
                  <option value="Olva Courier">Olva Courier</option>
                  <option value="Marvisur">Marvisur</option>
                  <option value="Flores">Flores</option>
                </select>
              </div>
            )}

            {/* Zona de reparto */}
            {showZoneFilter && (
              <div className="space-y-1">
                <Label className="text-xs">Zona de reparto</Label>
                <select
                  className="w-full h-8 text-sm border rounded-md px-2 bg-background text-foreground"
                  value={filters.zone}
                  onChange={(e) => updateFilter("zone", e.target.value)}
                >
                  {ZONE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Guía de envío */}
            {showGuideFilter && (
              <div className="space-y-1">
                <Label className="text-xs">Guía</Label>
                <select
                  className="w-full h-8 text-sm border rounded-md px-2 bg-background text-foreground"
                  value={filters.hasGuide}
                  onChange={(e) =>
                    updateFilter("hasGuide", e.target.value as "" | "yes" | "no")
                  }
                >
                  {GUIDE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to apply filters to sales data
export function applyFilters<T extends {
  orderNumber: string;
  clientName: string;
  phoneNumber: string;
  date: string;
  paymentMethod: string;
  pendingPayment: number;
  salesRegion: "LIMA" | "PROVINCIA";
  deliveryType: string;
  courier?: string | null;
  zone?: string;
  guideNumber?: string | null;
}>(data: T[], filters: SalesFilters): T[] {
  return data.filter((item) => {
    // Search filter (cliente, teléfono, N° orden)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesSearch =
        item.clientName.toLowerCase().includes(searchLower) ||
        item.phoneNumber.includes(filters.search) ||
        item.orderNumber.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    // Date filter (single date)
    if (filters.date) {
      const itemDate = parseDate(item.date);
      const [y, m, d] = filters.date.split("-").map(Number);
      const filterDate = new Date(y, m - 1, d);

      if (
        itemDate.getFullYear() !== filterDate.getFullYear() ||
        itemDate.getMonth() !== filterDate.getMonth() ||
        itemDate.getDate() !== filterDate.getDate()
      ) {
        return false;
      }
    }

    // Payment method filter
    if (filters.paymentMethod && item.paymentMethod !== filters.paymentMethod) {
      return false;
    }

    // Pending balance filter
    if (filters.hasPendingBalance === "yes" && item.pendingPayment <= 0) {
      return false;
    }
    if (filters.hasPendingBalance === "no" && item.pendingPayment > 0) {
      return false;
    }

    // Region filter
    if (filters.region && item.salesRegion !== filters.region) {
      return false;
    }

    // Delivery type filter
    if (filters.deliveryType) {
      const normalizedDeliveryType = item.deliveryType.replace(" ", "_").toUpperCase();
      if (normalizedDeliveryType !== filters.deliveryType) {
        return false;
      }
    }

    // Courier filter
    if (filters.courier && item.courier !== filters.courier) {
      return false;
    }

    // Zone filter
    if (filters.zone && item.zone !== filters.zone) {
      return false;
    }

    // Guide filter
    if (filters.hasGuide === "yes" && !item.guideNumber) {
      return false;
    }
    if (filters.hasGuide === "no" && item.guideNumber) {
      return false;
    }

    return true;
  });
}

// Parse date in format DD/MM/YYYY to Date object
function parseDate(dateStr: string): Date {
  const [day, month, year] = dateStr.split("/").map(Number);
  return new Date(year, month - 1, day);
}
