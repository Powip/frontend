"use client";
import { cn } from "@/lib/utils";
import type { LiveState } from "@/hooks/useCrmChat";

export default function LiveIndicator({ state }: { state: LiveState }) {
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-1.5 text-xs",
        state === "live" ? "text-emerald-600" : "text-amber-600",
      )}
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          state === "live" ? "bg-emerald-500" : "animate-pulse bg-amber-500",
        )}
      />
      {state === "live" ? "En vivo" : "Reconectando…"}
    </span>
  );
}
