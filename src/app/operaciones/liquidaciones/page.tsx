"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useOperationsRole, OPS_PERMISSIONS } from "@/contexts/OperationsRoleContext";
import { CourierSettlementWorkspace } from "./_components/CourierSettlementWorkspace";

export default function LiquidacionesPage() {
  const { auth, hasPermission } = useAuth();
  const { can } = useOperationsRole();
  const companyId = auth?.company?.id;
  const actorId = auth?.user?.id;
  if (!hasPermission("VIEW_FINANCES") && !can(OPS_PERMISSIONS.MANAGE_LIQUIDACIONES)) return <div className="rounded-xl border p-10 text-center"><h1 className="text-xl font-semibold">No tienes acceso a Liquidaciones</h1><p className="mt-2 text-muted-foreground">Necesitas el permiso de Finanzas de tu empresa para consultar y registrar liquidaciones.</p></div>;
  if (!companyId || !actorId) return <p role="status">Selecciona una empresa para consultar sus liquidaciones.</p>;
  return <CourierSettlementWorkspace key={`${companyId}:${actorId}`} companyId={companyId} actorId={actorId} />;
}
