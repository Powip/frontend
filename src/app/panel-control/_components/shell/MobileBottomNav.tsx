"use client";

import {
  Home,
  type LucideIcon,
  Phone,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { getTabDefinition } from "@/features/panel-control/shared/config/panel-tabs.config";
import type { PanelTabId } from "@/features/panel-control/shared/models/panel-navigation.model";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { cn } from "@/lib/utils";

const ICONOS: Record<PanelTabId, LucideIcon> = {
  resumen: Home,
  canales: ShoppingCart,
  callcenter: Phone,
  operaciones: Truck,
  finanzas: Wallet,
  equipo: Users,
  misventas: Receipt,
  configuracion: Settings,
};

export function MobileBottomNav() {
  const { view, dispatch } = usePanel();
  if (view.access !== "permitido" || view.tabs.length < 2) return null;

  return (
    <nav
      aria-label="Secciones del panel"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-pc-border bg-pc-card px-1 pb-[calc(6px+env(safe-area-inset-bottom))] pt-1.5 sm:hidden"
    >
      {view.tabs.map((tab) => {
        const Icono = ICONOS[tab];
        const activo = tab === view.tab;
        return (
          <button
            key={tab}
            type="button"
            aria-current={activo ? "page" : undefined}
            onClick={() => dispatch({ type: "navigate", tab })}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-md px-0.5 py-1 text-[10px] outline-none focus-visible:ring-2 focus-visible:ring-pc-primary",
              activo ? "font-bold text-pc-primary" : "text-pc-text-muted",
            )}
          >
            <Icono className="size-[18px]" aria-hidden />
            <span className="truncate">{getTabDefinition(tab).mobileLabel}</span>
          </button>
        );
      })}
    </nav>
  );
}
