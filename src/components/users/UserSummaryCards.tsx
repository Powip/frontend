"use client";

import { Skeleton } from "@/components/ui/skeleton";
import type { UserSummary } from "@/services/userListing";

interface UserSummaryCardsProps {
  summary: UserSummary | null;
  loading: boolean;
}

type CardValue = (summary: UserSummary) => number | null;

const CARDS: Array<{ id: string; label: string; accent: string; value: CardValue; unavailableHint?: string }> = [
  { id: "total", label: "Total usuarios", accent: "border-t-[#4C2FB5]", value: (s) => s.total },
  {
    id: "active-now",
    label: "Activos ahora",
    accent: "border-t-[#027778]",
    value: () => null,
    unavailableHint: "Dato todavía no disponible",
  },
  { id: "inactive", label: "Inactivos", accent: "border-t-[#22c55e]", value: (s) => s.inactive },
  {
    id: "custom-roles",
    label: "Roles personalizados",
    accent: "border-t-[#f59e0b]",
    value: () => null,
    unavailableHint: "Dato todavía no disponible",
  },
];

export function UserSummaryCards({ summary, loading }: UserSummaryCardsProps) {
  return (
    <ul aria-label="Resumen de usuarios" className="mb-[18px] grid grid-cols-2 gap-3 lg:grid-cols-4">
      {CARDS.map((card) => {
        const value = summary ? card.value(summary) : null;
        const unavailable = !!card.unavailableHint;
        return (
          <li
            key={card.id}
            className={`rounded-[10px] border border-t-[3px] border-[#e8e4f8] bg-white px-4 py-3.5 dark:border-border dark:bg-card ${card.accent}`}
          >
            {loading && !unavailable ? (
              <Skeleton className="h-7 w-12" />
            ) : (
              <p className={unavailable ? "text-sm font-semibold leading-7 text-[#8b87a3]" : "text-[22px] font-extrabold leading-7 text-[#0e0b1f] dark:text-foreground"}>
                {unavailable ? "No disponible" : value ?? "—"}
              </p>
            )}
            <p className="mt-0.5 text-[11px] text-[#8b87a3]">{card.label}</p>
            {card.unavailableHint && <p className="mt-1 text-[10px] text-[#b8b5cc]">{card.unavailableHint}</p>}
          </li>
        );
      })}
    </ul>
  );
}
