"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useCrmMe } from "@/hooks/useCrmMe";
import WhatsAppCallOverlay from "@/components/ventas-chat/WhatsAppCallOverlay";
import { VENTAS_CHAT_TABS } from "./tabs";

export default function VentasChatLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isAdmin } = useCrmMe();
  const tabs = VENTAS_CHAT_TABS.filter((t) => !t.adminOnly || isAdmin);
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-2xl font-semibold">Ventas por chat</h1>
        <p className="text-sm text-muted-foreground">
          Atiende y vende por WhatsApp, Messenger, Instagram y TikTok desde Powip.
        </p>
        {/* Control segmentado (mockup 152): pastillas con ícono dentro de una franja suave. */}
        <nav
          aria-label="Secciones de Ventas por chat"
          className="mx-auto mt-2 flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border bg-muted p-1"
        >
          {tabs.map((t) => {
            const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
            const Icon = t.icon;
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
      {/* Llamadas reales de WhatsApp: entrantes, salientes y resultado. */}
      <WhatsAppCallOverlay />
    </div>
  );
}
