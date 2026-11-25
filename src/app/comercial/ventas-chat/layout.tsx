"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Bell, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCrmMe } from "@/hooks/useCrmMe";
import WhatsAppCallOverlay from "@/components/ventas-chat/WhatsAppCallOverlay";
import { SoundsDialog } from "@/components/ventas-chat/SoundsControl";
import { VistaProvider, useVista } from "@/components/ventas-chat/VistaContext";
import { VENTAS_CHAT_TABS } from "./tabs";

/** Control de la cabecera (mockup 152): Vista completa / Vista enfocada + campanita de sonidos. */
function ViewModeControl() {
  const { focused, setFocused } = useVista();
  const [sounds, setSounds] = useState(false);
  const btn = (on: boolean) =>
    cn(
      "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
      on ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
    );
  return (
    <div role="group" aria-label="Modo de vista" className="flex shrink-0 items-center gap-1 rounded-xl border bg-muted p-1">
      <button type="button" data-testid="setfull" aria-pressed={!focused} onClick={() => setFocused(false)} className={btn(!focused)}>
        <Maximize2 className="h-4 w-4" aria-hidden />
        Vista completa
      </button>
      <button type="button" data-testid="setfocus" aria-pressed={focused} onClick={() => setFocused(true)} className={btn(focused)}>
        <Minimize2 className="h-4 w-4" aria-hidden />
        Vista enfocada
      </button>
      <button
        type="button"
        aria-label="Sonidos y avisos"
        title="Sonidos y avisos"
        onClick={() => setSounds(true)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-card/60 hover:text-foreground"
      >
        <Bell className="h-4 w-4" aria-hidden />
      </button>
      {sounds && <SoundsDialog onClose={() => setSounds(false)} />}
    </div>
  );
}

function VentasChatShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isAdmin } = useCrmMe();
  const { focused } = useVista();
  const tabs = VENTAS_CHAT_TABS.filter((t) => !t.adminOnly || isAdmin);
  const nav = (
    // Control segmentado (mockup 152): pastillas con ícono dentro de una franja suave.
    // En escritorio las pestañas bajan a otra fila (sin scroll horizontal), como el mockup v8.
    <nav
      aria-label="Secciones de Ventas por chat"
      className={cn(
        "flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border bg-muted p-1 md:flex-wrap md:gap-y-1 md:overflow-visible",
        focused ? "min-w-0 flex-1 md:justify-start" : "mx-auto md:justify-center",
      )}
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
              active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
  return (
    <div className={cn(focused ? "space-y-2 p-2 md:p-3" : "space-y-4 p-4 md:p-6")} data-crm-view={focused ? "focus" : "full"}>
      {focused ? (
        // Vista enfocada: sin título ni subtítulo; pestañas y control en una sola franja.
        <div className="flex items-start gap-2">
          {nav}
          <ViewModeControl />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-semibold">Ventas por chat</h1>
          <p className="text-sm text-muted-foreground">
            Vende más con tu mismo equipo · WhatsApp, Instagram y Messenger en una sola bandeja, con Pau
          </p>
          <div className="mt-1">
            <ViewModeControl />
          </div>
          <div className="mt-2 flex w-full justify-center">{nav}</div>
        </div>
      )}
      {children}
      {/* Llamadas reales de WhatsApp: entrantes, salientes y resultado. */}
      <WhatsAppCallOverlay />
    </div>
  );
}

export default function VentasChatLayout({ children }: { children: ReactNode }) {
  return (
    <VistaProvider>
      <VentasChatShell>{children}</VentasChatShell>
    </VistaProvider>
  );
}
