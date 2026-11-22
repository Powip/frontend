"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useCrmMe } from "@/hooks/useCrmMe";
import { VENTAS_CHAT_TABS } from "./tabs";

export default function VentasChatLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isAdmin } = useCrmMe();
  const tabs = VENTAS_CHAT_TABS.filter((t) => !t.adminOnly || isAdmin);
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Ventas por chat</h1>
        <p className="text-sm text-muted-foreground">
          Atiende y vende por WhatsApp, Messenger, Instagram y TikTok desde Powip.
        </p>
      </div>
      <nav aria-label="Secciones de Ventas por chat" className="flex flex-wrap gap-1 border-b">
        {tabs.map((t) => {
          const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
