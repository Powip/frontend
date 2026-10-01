"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search, X, ChevronDown, ChevronUp, Filter } from "lucide-react";
import { OrderStatus } from "@/interfaces/IOrder";
import { getStatusLabel } from "@/utils/domain/orders-status-flow";

export interface SalesFilters {
  dateFrom: string;
  dateTo: string;
  search: string;
  paymentMethod: string;
  hasPendingBalance: "" | "yes" | "no";
  region: "" | "LIMA" | "PROVINCIA";
  deliveryType: "" | "RETIRO_TIENDA" | "DOMICILIO";
  courier: string;
  zone: string;
  hasGuide: "" | "yes" | "no";
  source: "" | "shopify" | "google_sheets" | "manual";
  status: OrderStatus | "";
  salesChannel: string;
  /** Clave de producto (ver getProductFilterKey) — "" = todos. */
  product: string;
}

export const emptySalesFilters: SalesFilters = {
  dateFrom: "",
  dateTo: "",
  search: "",
  paymentMethod: "",
  hasPendingBalance: "",
  region: "",
  deliveryType: "",
  courier: "",
  zone: "",
  hasGuide: "",
  source: "",
  status: "",
  salesChannel: "",
  product: "",
};

/** Ítem mínimo para filtrar por producto — lo cumplen OrderItem (Ventas) y SaleItem (Pedidos). */
export interface FilterableOrderItem {
  productVariantId?: string | null;
  sku?: string | null;
  productName: string;
  attributes?: Record<string, string> | null;
}

export interface ProductFilterOption {
  value: string;
  label: string;
}

/**
 * Identificador inequívoco del producto de un ítem: el `productVariantId`
 * (el nombre no sirve — es un snapshot editable y dos variantes comparten
 * nombre). Solo si falta se usa el SKU, con prefijo para que nunca choque
 * con un id. Sin ninguno de los dos el ítem no es filtrable.
 */
export function getProductFilterKey(item: FilterableOrderItem): string | null {
  if (item.productVariantId) return item.productVariantId;
  if (item.sku) return `sku:${item.sku}`;
  return null;
}

/** Unidades del producto (clave de getProductFilterKey) en una orden: suma de quantity de sus ítems. */
export function countProductUnits(
  items: (FilterableOrderItem & { quantity: number })[] | null | undefined,
  productKey: string,
): number {
  return (items ?? [])
    .filter((it) => getProductFilterKey(it) === productKey)
    .reduce((sum, it) => sum + Number(it.quantity || 0), 0);
}

function productOptionLabel(item: FilterableOrderItem): string {
  const attrs = Object.values(item.attributes ?? {}).filter(Boolean).join(" / ");
  return [
    item.productName,
    attrs ? `(${attrs})` : "",
    item.sku ? `· SKU ${item.sku}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Opciones del filtro "Producto" a partir de los ítems de las órdenes de la
 * vista (antes de aplicar los demás filtros, así la opción elegida no
 * desaparece al combinarla). Si dos claves distintas quedan con el mismo
 * texto, se les agrega un sufijo del id para poder distinguirlas.
 */
export function buildProductFilterOptions(
  orders: { items?: FilterableOrderItem[] | null }[],
): ProductFilterOption[] {
  const labels = new Map<string, string>();
  for (const order of orders) {
    for (const item of order.items ?? []) {
      const key = getProductFilterKey(item);
      if (key && !labels.has(key)) labels.set(key, productOptionLabel(item));
    }
  }

  const labelCount = new Map<string, number>();
  for (const label of labels.values()) {
    labelCount.set(label, (labelCount.get(label) ?? 0) + 1);
  }

  return Array.from(labels, ([value, label]) => ({
    value,
    label: (labelCount.get(label) ?? 0) > 1 ? `${label} [${value.slice(-6)}]` : label,
  })).sort((a, b) => a.label.localeCompare(b.label, "es"));
}

interface SalesTableFiltersProps {
  filters: SalesFilters;
  onFiltersChange: (filters: SalesFilters) => void;
  showRegionFilter?: boolean;
  showCourierFilter?: boolean;
  showZoneFilter?: boolean;
  showGuideFilter?: boolean;
  showSourceFilter?: boolean;
  showStatusFilter?: boolean;
  showChannelFilter?: boolean;
  showProductFilter?: boolean;
  availableCouriers?: string[];
  /** Estados reales presentes en la vista actual — evita ofrecer opciones que no matchean nada. */
  availableStatuses?: OrderStatus[];
  /** Canales de venta de la empresa (Configuración › Tiendas) + los que ya aparecen en los datos. */
  availableChannels?: string[];
  /** Productos presentes en la vista actual (ver buildProductFilterOptions). */
  availableProducts?: ProductFilterOption[];
}

/** "TIENDA_FISICA" → "TIENDA FISICA" — mismo criterio que el <select> de Canal de venta en Registrar Venta. */
function channelLabel(channel: string): string {
  return channel.replace(/_/g, " ");
}

// Debe reflejar exactamente las opciones reales de PaymentVerificationModal
// (donde se registran los pagos) — si difieren, el filtro nunca matchea nada.
export const PAYMENT_METHODS = [
  { value: "", label: "Todos" },
  { value: "YAPE", label: "Yape" },
  { value: "PLIN", label: "Plin" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "CONTRA_ENTREGA", label: "Contra Entrega" },
  { value: "BCP", label: "BCP" },
  { value: "BANCO_NACION", label: "Banco de la Nación" },
  { value: "MERCADO_PAGO", label: "Mercado Pago" },
  { value: "POS", label: "POS" },
];

export const PENDING_BALANCE_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "yes", label: "Con saldo" },
  { value: "no", label: "Sin saldo" },
];

export const REGION_OPTIONS = [
  { value: "", label: "Todas" },
  { value: "LIMA", label: "Lima" },
  { value: "PROVINCIA", label: "Provincia" },
];

export const DELIVERY_TYPE_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "RETIRO_TIENDA", label: "Retiro en tienda" },
  { value: "DOMICILIO", label: "Domicilio" },
];

export const ZONE_OPTIONS = [
  { value: "", label: "Todas las zonas" },
  { value: "LIMA_NORTE", label: "🟦 Lima Norte" },
  { value: "CALLAO", label: "🟨 Callao" },
  { value: "LIMA_CENTRO", label: "🟩 Lima Centro" },
  { value: "LIMA_SUR", label: "🟪Lima Sur" },
  { value: "LIMA_ESTE", label: "🟧 Lima Este" },
  { value: "ZONAS_ALEDANAS", label: "⛰️ Zonas Aledañas" },
  { value: "PROVINCIAS", label: "🧭 Provincias" },
];

export const GUIDE_OPTIONS = [
  { value: "", label: "Todas" },
  { value: "yes", label: "Con guía" },
  { value: "no", label: "Sin guía" },
];

export const SOURCE_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "manual", label: "Powip" },
  { value: "shopify", label: "Shopify" },
  { value: "google_sheets", label: "Google Sheets" },
];

export function SalesTableFilters({
  filters,
  onFiltersChange,
  showRegionFilter = true,
  showCourierFilter = false,
  showZoneFilter = false,
  showGuideFilter = false,
  showSourceFilter = true,
  showStatusFilter = false,
  showChannelFilter = false,
  showProductFilter = false,
  availableCouriers = [],
  availableStatuses = [],
  availableChannels = [],
  availableProducts = [],
}: SalesTableFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const productSelectId = useId();

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
            <span className="ml-2 bg-violet-600 text-white rounded-full px-2 py-0.5 text-xs">
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

            {/* Fecha Desde */}
            <div className="space-y-1">
              <Label className="text-xs">Fecha Desde</Label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => updateFilter("dateFrom", e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            {/* Fecha Hasta */}
            <div className="space-y-1">
              <Label className="text-xs">Fecha Hasta</Label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => updateFilter("dateTo", e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            {/* Producto */}
            {showProductFilter && (
              <div className="space-y-1 col-span-2">
                <Label htmlFor={productSelectId} className="text-xs">
                  Producto
                </Label>
                <select
                  id={productSelectId}
                  className="w-full h-8 text-sm border rounded-md px-2 bg-background text-foreground"
                  value={filters.product}
                  onChange={(e) => updateFilter("product", e.target.value)}
                >
                  <option value="">Todos</option>
                  {availableProducts.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

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

            {/* Estado */}
            {showStatusFilter && (
              <div className="space-y-1">
                <Label className="text-xs">Estado</Label>
                <select
                  className="w-full h-8 text-sm border rounded-md px-2 bg-background text-foreground"
                  value={filters.status}
                  onChange={(e) =>
                    updateFilter("status", e.target.value as OrderStatus | "")
                  }
                >
                  <option value="">Todos</option>
                  {availableStatuses.map((s) => (
                    <option key={s} value={s}>
                      {getStatusLabel(s)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Canal de venta */}
            {showChannelFilter && (
              <div className="space-y-1">
                <Label className="text-xs">Canal de venta</Label>
                <select
                  className="w-full h-8 text-sm border rounded-md px-2 bg-background text-foreground"
                  value={filters.salesChannel}
                  onChange={(e) => updateFilter("salesChannel", e.target.value)}
                >
                  <option value="">Todos</option>
                  {availableChannels.map((c) => (
                    <option key={c} value={c}>
                      {channelLabel(c)}
                    </option>
                  ))}
                </select>
              </div>
            )}

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

            {/* Courier */}
            {showCourierFilter && (
              <div className="space-y-1">
                <Label className="text-xs">Courier</Label>
                <select
                  className="w-full h-8 text-sm border rounded-md px-2 bg-background text-foreground"
                  value={filters.courier}
                  onChange={(e) => updateFilter("courier", e.target.value)}
                >
                  <option value="">Todos</option>
                  {availableCouriers.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
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

            {/* Origen (Manual / Shopify) */}
            {showSourceFilter && (
              <div className="space-y-1">
                <Label className="text-xs">Origen</Label>
                <select
                  className="w-full h-8 text-sm border rounded-md px-2 bg-background text-foreground"
                  value={filters.source}
                  onChange={(e) =>
                    updateFilter("source", e.target.value as "" | "shopify" | "google_sheets" | "manual")
                  }
                >
                  {SOURCE_OPTIONS.map((opt) => (
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
  externalSource?: string | null;
  status?: OrderStatus;
  salesChannel?: string | null;
  items?: FilterableOrderItem[] | null;
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

    // Date range filter (from - to)
    if (filters.dateFrom || filters.dateTo) {
      const itemDate = parseDate(item.date);

      if (filters.dateFrom) {
        const [y, m, d] = filters.dateFrom.split("-").map(Number);
        const fromDate = new Date(y, m - 1, d);
        fromDate.setHours(0, 0, 0, 0);
        itemDate.setHours(0, 0, 0, 0);
        if (itemDate < fromDate) return false;
      }

      if (filters.dateTo) {
        const [y, m, d] = filters.dateTo.split("-").map(Number);
        const toDate = new Date(y, m - 1, d);
        toDate.setHours(23, 59, 59, 999);
        itemDate.setHours(0, 0, 0, 0);
        if (itemDate > toDate) return false;
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

    // Status filter
    if (filters.status && item.status !== filters.status) {
      return false;
    }

    // Sales channel filter
    if (filters.salesChannel && item.salesChannel !== filters.salesChannel) {
      return false;
    }

    // Product filter — la orden entra si alguno de sus ítems es el producto
    if (
      filters.product &&
      !(item.items ?? []).some((it) => getProductFilterKey(it) === filters.product)
    ) {
      return false;
    }

    // Guide filter
    if (filters.hasGuide === "yes" && !item.guideNumber) {
      return false;
    }
    if (filters.hasGuide === "no" && item.guideNumber) {
      return false;
    }

    // Source filter (Powip / Shopify / Google Sheets)
    if (filters.source) {
      const itemSource = item.externalSource?.toLowerCase();

      if (filters.source === "shopify") {
        return itemSource === "shopify";
      }
      if (filters.source === "google_sheets") {
        return itemSource === "google_sheets";
      }
      if (filters.source === "manual") {
        return !itemSource || itemSource === "" || itemSource === "manual";
      }
    }

    return true;
  });
}

// Parse date in format DD/MM/YYYY to Date object
function parseDate(dateStr: string): Date {
  const [day, month, year] = dateStr.split("/").map(Number);
  return new Date(year, month - 1, day);
}
