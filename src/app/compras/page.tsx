"use client";

import { use } from "react";
import { useAuth } from "@/contexts/AuthContext";
import PurchaseOrdersView from "@/components/compras/PurchaseOrdersView";

// FEAT-24 H3-E — Compras › Órdenes de compra. La compra directa con IMEI/serie
// sigue en /registrar-compra (enlazada desde aquí).
// FEAT-24 H13: `?oc=<id>` abre el detalle de esa OC (enlaces del pedido sugerido).
export default function ComprasPage({ searchParams }: { searchParams: Promise<{ oc?: string | string[] }> }) {
  const { auth } = useAuth();
  const { oc } = use(searchParams);
  const initialOrderId = typeof oc === "string" && oc.trim() !== "" ? oc.trim() : undefined;
  return <PurchaseOrdersView key={`${auth?.company?.id ?? ""}:${auth?.user?.id ?? ""}`} initialOrderId={initialOrderId} />;
}
