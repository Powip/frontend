import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export type WaTone = "ok" | "warn" | "err" | "info" | "neutral" | "purple" | "teal";

const PILL_TONES: Record<WaTone, string> = {
  ok: "bg-wa-green-soft text-wa-green",
  warn: "bg-wa-amber-soft text-wa-amber",
  err: "bg-wa-red-soft text-wa-red",
  info: "bg-wa-blue-soft text-wa-blue",
  neutral: "border border-wa-border bg-wa-surface-2 text-wa-muted",
  purple: "bg-wa-primary-soft text-wa-primary",
  teal: "bg-wa-teal-soft text-wa-teal",
};

interface WaPillProps extends ComponentProps<"span"> {
  tone?: WaTone;
}

export function WaPill({ tone = "neutral", className, ...props }: WaPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] text-xs font-semibold",
        PILL_TONES[tone],
        className,
      )}
      {...props}
    />
  );
}

const MINI_TONES: Record<WaTone, string> = {
  ok: "bg-wa-green-soft text-wa-green",
  warn: "bg-wa-amber-soft text-wa-amber",
  err: "bg-wa-red-soft text-wa-red",
  info: "bg-wa-blue-soft text-wa-blue",
  neutral: "border border-wa-border bg-wa-surface-2 text-wa-muted",
  purple: "bg-wa-primary-soft text-wa-primary",
  teal: "bg-wa-teal-soft text-wa-teal",
};

export function WaMini({ tone = "neutral", className, ...props }: WaPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-[7px] py-px text-[10.5px] font-semibold",
        MINI_TONES[tone],
        className,
      )}
      {...props}
    />
  );
}

export function WaDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-2 shrink-0 rounded-full bg-wa-whatsapp shadow-[0_0_0_3px_color-mix(in_srgb,var(--wa-whatsapp)_25%,transparent)]",
        className,
      )}
    />
  );
}
