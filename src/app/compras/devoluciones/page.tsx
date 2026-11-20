"use client";

import { useAuth } from "@/contexts/AuthContext";
import SupplierReturnsView from "@/components/compras/SupplierReturnsView";

// FEAT-24 H3-E — Compras › Devoluciones a proveedor.
export default function DevolucionesProveedorPage() {
  const { auth } = useAuth();
  return <SupplierReturnsView key={`${auth?.company?.id ?? ""}:${auth?.user?.id ?? ""}`} />;
}
