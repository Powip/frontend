import { Info, type LucideIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export type WaCalloutTone = "primary" | "amber" | "teal" | "red" | "pending";

const TONES: Record<WaCalloutTone, { box: string; icon: string }> = {
  primary: { box: "bg-wa-primary-soft", icon: "text-wa-primary" },
  amber: { box: "bg-wa-amber-soft", icon: "text-wa-amber" },
  teal: { box: "bg-wa-teal-soft", icon: "text-wa-teal" },
  red: { box: "bg-wa-red-soft", icon: "text-wa-red" },
  pending: {
    box: "border border-dashed border-wa-border-strong bg-wa-surface-2 text-wa-muted",
    icon: "text-wa-muted",
  },
};

interface WaCalloutProps extends ComponentProps<"div"> {
  tone?: WaCalloutTone;
  icon?: LucideIcon;
  compact?: boolean;
}

export function WaCallout({
  tone = "primary",
  icon: Icon = Info,
  compact = false,
  className,
  children,
  ...props
}: WaCalloutProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl text-[13px] text-wa-fg",
        compact ? "px-3 py-2.5" : "px-4 py-3.5",
        TONES[tone].box,
        tone === "pending" && "text-wa-muted",
        className,
      )}
      {...props}
    >
      <Icon className={cn("mt-px size-[18px] shrink-0", TONES[tone].icon)} aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
