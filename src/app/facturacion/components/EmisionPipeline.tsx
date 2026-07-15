import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmisionPipelineProps {
  steps: string[];
  activeIndex: number;
}

export function EmisionPipeline({ steps, activeIndex }: EmisionPipelineProps) {
  return (
    <div className="my-2 divide-y divide-border rounded-lg border">
      {steps.map((label, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        return (
          <div key={label} className="flex items-center gap-3 px-4 py-3">
            <div
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
                done && "bg-green-500 text-white",
                active && "bg-primary text-primary-foreground",
                !done && !active && "bg-muted text-muted-foreground"
              )}
            >
              {done ? (
                <Check className="h-3.5 w-3.5" />
              ) : active ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                i + 1
              )}
            </div>
            <span
              className={cn(
                "text-sm font-medium",
                done || active ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
