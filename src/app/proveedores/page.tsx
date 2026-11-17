"use client";

import { useAuth } from "@/contexts/AuthContext";
import SuppliersView from "@/components/compras/SuppliersView";

// FEAT-24 H3-E — Compras › Proveedores (los de compras, con RUC y condición de pago).
export default function ProveedoresPage() {
  const { auth } = useAuth();
  return <SuppliersView key={`${auth?.company?.id ?? ""}:${auth?.user?.id ?? ""}`} />;
}
