"use client";

import Link from "next/link";
import { isSuperadmin } from "@/config/permissions.config";
import { useAuth } from "@/contexts/AuthContext";
import { firstChargePreview, formatLimaDate, limaToday } from "@/lib/flowMigration";
import { MIGRATION_ROUTE } from "@/lib/subscriptionGate";

const HAS_PLAN = new Set(["ACTIVE", "PENDING_RENEWAL"]);

/**
 * Aviso de la migración a Flow (FEAT-25): solo para el dueño, mientras su empresa está en AVISO.
 * No se puede cerrar; desaparece cuando migra (el estado pasa a OK).
 */
export default function FlowMigrationBanner() {
  const { auth } = useAuth();
  const access = auth?.access;
  if (!access || access.state !== "AVISO" || !access.owner || !access.deadline) return null;
  if (isSuperadmin(auth?.user?.email)) return null;

  const subscription = auth?.subscription;
  const hasPaidDays =
    !!subscription && HAS_PLAN.has(subscription.status) && firstChargePreview(subscription.endDate, limaToday()) !== null;
  const message =
    `Registra tu tarjeta hasta el ${formatLimaDate(access.deadline)} para seguir usando Powip.` +
    (hasPaidDays ? " Hoy no te cobramos nada: el primer cobro es cuando vence lo que ya pagaste." : "");

  return (
    <div
      role="status"
      className="flex flex-col gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between"
    >
      <p>{message}</p>
      <Link
        href={MIGRATION_ROUTE}
        className="shrink-0 self-start rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 sm:self-auto"
      >
        Pasarme a Flow
      </Link>
    </div>
  );
}
