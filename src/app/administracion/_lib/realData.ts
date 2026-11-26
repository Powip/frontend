/**
 * Solo para el registro manual de publicidad (`pauta/ManualAdvertisingPage.tsx`), que se guarda en el navegador, no
 * entra en ningún cálculo (FEAT-34, D2) y se retira en la Fase 3. El resto del módulo usa `ventas.ts` y `canales.ts`.
 */

import { canalDePedido } from "./canales";
import { type PedidoAdmin, soloVentas } from "./ventas";

export interface CanalReal {
  id: string;
  nombre: string;
  grupo: "ecommerce" | "marketplace";
}

/** Canales del registro manual (lista histórica; los cálculos usan los canales de los pedidos). */
export const CANALES_REALES: CanalReal[] = [
  { id: "WHATSAPP", nombre: "WhatsApp", grupo: "ecommerce" },
  { id: "INSTAGRAM", nombre: "Instagram", grupo: "ecommerce" },
  { id: "FACEBOOK", nombre: "Facebook", grupo: "ecommerce" },
  { id: "TIENDA_FISICA", nombre: "Tienda física", grupo: "ecommerce" },
  { id: "MARKETPLACE", nombre: "Marketplace", grupo: "marketplace" },
  { id: "MERCADOLIBRE", nombre: "Mercado Libre", grupo: "marketplace" },
  { id: "OTRO", nombre: "Otro", grupo: "ecommerce" },
];

export interface VentaProductoReal {
  sku: string;
  nombre: string;
  ventas: number;
  unidades: number;
}

/** Ventas por producto de un canal, desde las líneas de las ventas entregadas. */
export function ventasPorProductoEnCanal(orders: PedidoAdmin[], canal: string): VentaProductoReal[] {
  const map: Record<string, VentaProductoReal> = {};
  for (const o of soloVentas(orders)) {
    if (canalDePedido(o) !== canal) continue;
    for (const item of o.items ?? []) {
      if (item.lineKind === "SERVICE") continue;
      const sku = item.sku || item.productVariantId || "SIN-SKU";
      if (!map[sku]) map[sku] = { sku, nombre: item.productName || sku, ventas: 0, unidades: 0 };
      map[sku].ventas += Number(item.subtotal || 0);
      map[sku].unidades += Number(item.quantity || 0);
    }
  }
  return Object.values(map).sort((a, b) => b.ventas - a.ventas);
}
