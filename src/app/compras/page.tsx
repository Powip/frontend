"use client";

import { useAuth } from "@/contexts/AuthContext";
import PurchaseOrdersView from "@/components/compras/PurchaseOrdersView";

// FEAT-24 H3-E — Compras › Órdenes de compra. La compra directa con IMEI/serie
// sigue en /registrar-compra (enlazada desde aquí).
export default function ComprasPage() {
  const { auth } = useAuth();
  return <PurchaseOrdersView key={`${auth?.company?.id ?? ""}:${auth?.user?.id ?? ""}`} />;
}
