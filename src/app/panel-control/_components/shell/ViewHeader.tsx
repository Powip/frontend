"use client";

import Link from "next/link";
import { getTabDefinition } from "@/features/panel-control/shared/config/panel-tabs.config";
import type { PanelTabId } from "@/features/panel-control/shared/models/panel-navigation.model";

export function ViewHeader({ tab }: { tab: PanelTabId }) {
  const definicion = getTabDefinition(tab);
  return (
    <div className="mb-4 flex flex-wrap items-end gap-2.5">
      <div className="min-w-0">
        <h2 className="text-lg font-extrabold text-pc-text">{definicion.titulo}</h2>
        <p className="mt-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-pc-text-muted">
          {definicion.subtitulo}
        </p>
      </div>
      <div className="grow" />
      {definicion.moduloRelacionado && (
        <Link
          href={definicion.moduloRelacionado.href}
          className="rounded-lg border border-pc-border bg-pc-card px-2.5 py-1.5 text-[11px] font-semibold text-pc-text outline-none hover:border-pc-primary hover:text-pc-primary focus-visible:ring-2 focus-visible:ring-pc-primary"
        >
          Abrir módulo {definicion.moduloRelacionado.label} →
        </Link>
      )}
    </div>
  );
}
