"use client";
import Link from "next/link";
import { Phone } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAgentes } from "@/hooks/useAgentes";
import { useCcKpis } from "@/hooks/useCcKpis";
import { useCrmPlan } from "@/hooks/useCrmPlan";

/** Subestados de la pestaña COD de Gestión CC que aún esperan llamada (los mismos que cuenta esa pestaña). */
const PENDING_COD = ["por_confirmar", "contactado", "no_contesta"] as const;

/** «Milagros y Diego», «Ana, Luis y 2 más». */
export function codTeamText(names: string[]): string {
  const first = names.map((n) => n.trim().split(/\s+/)[0]).filter(Boolean);
  if (first.length <= 2) return first.join(" y ");
  return `${first.slice(0, 2).join(", ")} y ${first.length - 2} más`;
}

/**
 * Mockup 152 (B5): los pedidos contra entrega no se cierran en el chat; van a Gestión CC.
 * Solo lee la API de Gestión CC de ms-ventas (KPIs COD y agentes). Oculto en cuentas «Solo CRM».
 */
export default function CodNote({ storeIds }: { storeIds: string[] }) {
  const { auth } = useAuth();
  const plan = useCrmPlan().data;
  const solo = plan?.accountType === "solo";
  const scope = solo ? [] : storeIds;
  const kpis = useCcKpis("cod", scope).data;
  const agents = useAgentes(scope, auth?.company?.id ?? null).data;
  if (solo || !kpis) return null;
  const n = PENDING_COD.reduce((sum, k) => sum + (typeof kpis[k] === "number" ? kpis[k] : 0), 0);
  if (n <= 0) return null;
  const team = codTeamText((agents ?? []).filter((a) => a.ccActivo).map((a) => a.nombre || a.email || ""));
  return (
    <div
      data-testid="cod-note"
      className="flex items-center gap-2 rounded-[10px] border border-teal-600/25 bg-teal-600/[0.09] px-2.5 py-2 text-[12.5px]"
    >
      <Phone className="h-4 w-4 flex-none text-teal-600" aria-hidden />
      <span className="min-w-0 flex-1">
        <b>
          {n} {n === 1 ? "pedido COD va" : "pedidos COD van"}
        </b>{" "}
        a Gestión CC{team ? ` con ${team}` : ""}
      </span>
      <Link href="/atencion-cliente" className="flex-none text-[12.5px] font-semibold text-primary hover:underline">
        Ver
      </Link>
    </div>
  );
}
