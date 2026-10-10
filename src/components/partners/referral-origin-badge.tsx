import { Link2, Pencil, Hash } from "lucide-react";
import type { ReferralOrigin } from "@/features/partners/models/referral-origin.enum";
import { cn } from "@/lib/utils";

interface ReferralOriginBadgeProps {
  origin: ReferralOrigin;
}

const ORIGIN_MAP: Record<ReferralOrigin, { label: string; icon: typeof Link2; className: string }> = {
  link: { label: "Link", icon: Link2, className: "bg-primary/10 text-primary" },
  codigo: { label: "Código", icon: Hash, className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  manual: { label: "Manual", icon: Pencil, className: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300" },
};

export function ReferralOriginBadge({ origin }: ReferralOriginBadgeProps) {
  const mapped = ORIGIN_MAP[origin];
  const Icon = mapped.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
        mapped.className,
      )}
    >
      <Icon aria-hidden="true" className="size-3" />
      {mapped.label}
    </span>
  );
}
