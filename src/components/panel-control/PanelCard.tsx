import type { ReactNode } from "react";
import type { DataOrigin } from "@/features/panel-control/shared/models/data-origin.model";
import { cn } from "@/lib/utils";
import { DataOriginBadge } from "./DataOriginBadge";

interface PanelCardProps {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  acciones?: ReactNode;
  origin?: DataOrigin;
  children: ReactNode;
  className?: string;
  id?: string;
}

export function PanelCard({
  titulo,
  subtitulo,
  acciones,
  origin,
  children,
  className,
  id,
}: PanelCardProps) {
  return (
    <section
      id={id}
      className={cn(
        "min-w-0 rounded-2xl border border-pc-border bg-pc-card p-4 shadow-[0_1px_2px_rgba(16,32,42,0.04)] sm:p-5",
        className,
      )}
    >
      <header className="mb-3 flex flex-wrap items-start gap-2">
        <div className="min-w-[min(100%,14rem)] flex-1">
          <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-pc-text">
            {titulo}
            {origin && <DataOriginBadge origin={origin} />}
          </h3>
          {subtitulo && <p className="mt-0.5 text-xs text-pc-text-muted">{subtitulo}</p>}
        </div>
        {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
      </header>
      {children}
    </section>
  );
}
