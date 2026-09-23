import { Badge } from "@/components/ui/badge";
import type { PartnerTierLevel } from "@/features/partners/models/partner-tier";

interface PartnerTierBadgeProps {
  level: PartnerTierLevel;
}

const TIER_MAP: Record<PartnerTierLevel, { label: string; className: string }> = {
  bronce: {
    label: "🥉 Bronce",
    className: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-900",
  },
  plata: {
    label: "🥈 Plata",
    className: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
  },
  oro: {
    label: "🥇 Oro",
    className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
  },
};

export function PartnerTierBadge({ level }: PartnerTierBadgeProps) {
  const mapped = TIER_MAP[level];

  return (
    <Badge variant="outline" className={mapped.className}>
      {mapped.label}
    </Badge>
  );
}
