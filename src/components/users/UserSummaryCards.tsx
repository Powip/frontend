"use client";

import { Skeleton } from "@/components/ui/skeleton";
import type { UserSummary } from "@/services/userListing";

interface UserSummaryCardsProps {
  summary: UserSummary | null;
  loading: boolean;
}

const CARDS: Array<{ key: keyof UserSummary; label: string; hint: string; accent: string }> = [
  { key: "total", label: "Total", hint: "Usuarios de la empresa", accent: "border-t-violet-600" },
  { key: "active", label: "Activos", hint: "Cuentas habilitadas", accent: "border-t-teal-600" },
  { key: "inactive", label: "Inactivos", hint: "Cuentas deshabilitadas", accent: "border-t-slate-400" },
  { key: "withoutRole", label: "Sin rol", hint: "Sin rol asignado", accent: "border-t-amber-500" },
];

export function UserSummaryCards({ summary, loading }: UserSummaryCardsProps) {
  return (
    <ul aria-label="Resumen de usuarios" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {CARDS.map((card) => (
        <li
          key={card.key}
          className={`rounded-lg border border-t-4 bg-card px-4 py-3 ${card.accent}`}
        >
          <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
          {loading ? (
            <Skeleton className="mt-1 h-7 w-12" />
          ) : (
            <p className="text-2xl font-bold">{summary ? summary[card.key] : "—"}</p>
          )}
          <p className="text-[11px] text-muted-foreground">{card.hint}</p>
        </li>
      ))}
    </ul>
  );
}
