"use client";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCrmAccess, useCrmPlan } from "@/hooks/useCrmPlan";

/**
 * «Solo ventas por chat» de Comercial › Ventas (mockup 152). Solo para cuentas con CRM.
 * En cuentas «Solo CRM» el filtro va fijo y la casilla no se muestra.
 */
export function useChatSalesFilter() {
  const { auth } = useAuth();
  const hasCrm = useCrmAccess(!!auth?.company?.id).data?.allowed === true;
  const accountType = useCrmPlan(hasCrm).data?.accountType;
  const [checked, setChecked] = useState(false);
  const solo = hasCrm && accountType === "solo";
  return { hasCrm, solo, checked, setChecked, active: solo || (hasCrm && checked) };
}
