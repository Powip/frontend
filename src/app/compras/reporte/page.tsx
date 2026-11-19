"use client";

import { useAuth } from "@/contexts/AuthContext";
import PurchasesReportView from "@/components/compras/PurchasesReportView";

// FEAT-24 H10 — Compras › Reporte de compras.
export default function ReporteComprasPage() {
  const { auth } = useAuth();
  return <PurchasesReportView key={`${auth?.company?.id ?? ""}:${auth?.user?.id ?? ""}`} />;
}
