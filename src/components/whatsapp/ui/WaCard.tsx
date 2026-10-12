import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function WaCard({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-2xl border border-wa-border bg-wa-surface p-[22px] shadow-wa",
        className,
      )}
      {...props}
    />
  );
}

interface WaCardHeaderProps {
  title: ReactNode;
  titleId?: string;
  description?: ReactNode;
  level?: 2 | 3;
  actions?: ReactNode;
  className?: string;
}

export function WaCardHeader({
  title,
  titleId,
  description,
  level = 2,
  actions,
  className,
}: WaCardHeaderProps) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <div className={cn("mb-4 flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <Heading
          id={titleId}
          className={cn(
            "m-0 font-semibold text-wa-fg",
            level === 2 ? "text-[17px]" : "text-[15px]",
          )}
        >
          {title}
        </Heading>
        {description && <div className="mt-0.5 text-[13px] text-wa-muted">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}
