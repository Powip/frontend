"use client";

import { CircleAlert, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

export function AdvertisingDataNotice({
  messages,
  title = "Datos pendientes de confirmar",
  action,
}: {
  messages: string[];
  title?: string;
  action?: ReactNode;
}) {
  const notices = [...new Set(messages.filter(Boolean))];
  if (!notices.length) return null;
  return (
    <section
      role="status"
      aria-label="Estado de datos"
      className="rounded-xl border border-amber-200/80 bg-amber-50/60 px-4 py-3 text-sm dark:border-amber-900 dark:bg-amber-950/20"
    >
      <div className="flex items-start gap-3">
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-amber-950 dark:text-amber-100">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{notices[0]}</p>
        </div>
        {action && <div className="shrink-0 text-xs">{action}</div>}
      </div>
      {notices.length > 1 && (
        <details className="group mt-2 pl-7 text-xs">
          <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-sm font-medium text-foreground outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
            Ver {notices.length - 1} {notices.length === 2 ? "detalle" : "detalles"}
            <ChevronDown className="size-3.5 group-open:rotate-180" aria-hidden="true" />
          </summary>
          <ul className="mt-2 list-disc space-y-2 pl-4 leading-relaxed text-muted-foreground">
            {notices.slice(1).map((notice) => <li key={notice}>{notice}</li>)}
          </ul>
        </details>
      )}
    </section>
  );
}
