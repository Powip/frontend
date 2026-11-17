"use client";

import { usePathname, useRouter } from "next/navigation";
import { Building2, ClipboardList, Undo2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatMoney,
  MASK,
  PURCHASE_STATUS_CLASS,
  PURCHASE_STATUS_LABEL,
  RETURN_STATUS_CLASS,
  RETURN_STATUS_LABEL,
} from "@/lib/purchaseOrders";
import { cn } from "@/lib/utils";
import type { PurchaseOrderStatus, SupplierReturnStatus } from "@/services/purchasesService";

// FEAT-24 H3-E — piezas comunes de Compras: pestañas, etiquetas de estado y
// montos que se ocultan («••••») cuando la API no los manda al rol.

/** `<select>` nativo con el estilo de los campos (igual que Tiendas y almacenes). */
export const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

/** Pestañas del grupo Compras (mockup: Órdenes de compra, Proveedores, Devoluciones a proveedor). */
export const PURCHASE_TABS = [
  { value: "/compras", label: "Órdenes de compra", icon: ClipboardList },
  { value: "/proveedores", label: "Proveedores", icon: Building2 },
  { value: "/compras/devoluciones", label: "Devoluciones a proveedor", icon: Undo2 },
] as const;

export function PurchasesNav() {
  const pathname = usePathname() ?? "/compras";
  const router = useRouter();
  const current = PURCHASE_TABS.find((tab) => tab.value === pathname)?.value ?? "/compras";
  return (
    <Tabs value={current} onValueChange={(next) => router.push(next)}>
      <TabsList className="flex-wrap">
        {PURCHASE_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-2">
              <Icon className="h-4 w-4" aria-hidden="true" />
              {tab.label}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}

export function PurchaseStatusBadge({ status }: { status: PurchaseOrderStatus }) {
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", PURCHASE_STATUS_CLASS[status])}>
      {PURCHASE_STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function ReturnStatusBadge({ status }: { status: SupplierReturnStatus }) {
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", RETURN_STATUS_CLASS[status])}>
      {RETURN_STATUS_LABEL[status] ?? status}
    </span>
  );
}

/** Monto o costo: «••••» si la API omitió la clave (el rol no ve costos). */
export function Money({ value, decimals = 2, className }: { value: number | null | undefined; decimals?: 2 | 4; className?: string }) {
  const text = formatMoney(value, decimals);
  if (text === MASK)
    return (
      <span className={cn("tabular-nums text-muted-foreground", className)} title="Tu rol no ve costos" aria-label="Costo oculto">
        {MASK}
      </span>
    );
  return <span className={cn("tabular-nums", className)}>{text}</span>;
}
