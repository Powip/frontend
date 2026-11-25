"use client";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCrmEvents } from "@/hooks/useCrmChat";
import { useCrmMe } from "@/hooks/useCrmMe";
import ConversationList from "./ConversationList";
import InboxIndicators, { type InboxIndicator } from "./InboxIndicators";
import MyDay from "./MyDay";
import ChatPanel from "./ChatPanel";
import SoundsControl from "./SoundsControl";
import { useVista } from "./VistaContext";

export default function Bandeja() {
  const router = useRouter();
  const pathname = usePathname();
  const urlId = useSearchParams()?.get("c") || null;
  const [selectedId, setSelectedId] = useState<string | null>(urlId);
  // Sigue a la URL (volver desde registrar-venta, atrás/adelante del navegador).
  useEffect(() => setSelectedId(urlId), [urlId]);
  const select = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      router.replace(id ? `${pathname}?c=${encodeURIComponent(id)}` : pathname, {
        scroll: false,
      });
    },
    [router, pathname],
  );
  // Vista enfocada o completa: la elige el control de la cabecera (layout).
  const { focused } = useVista();
  const live = useCrmEvents();
  const [indicator, setIndicator] = useState<InboxIndicator | null>(null);
  const { stores } = useCrmMe();
  const [storeChoice, setStoreChoice] = useState("");
  // Si la tienda elegida deja de existir, se vuelve a «todas».
  const storeId = stores.some((s) => s.id === storeChoice) ? storeChoice : undefined;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end gap-3">
        <span
          role="status"
          className={cn(
            "inline-flex items-center gap-1.5 text-xs",
            live === "live" ? "text-emerald-600" : "text-amber-600",
          )}
        >
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              live === "live" ? "bg-emerald-500" : "animate-pulse bg-amber-500",
            )}
          />
          {live === "live" ? "En vivo" : "Reconectando…"}
        </span>
      </div>

      <MyDay onOpenChat={(id) => select(id)} compact={focused} />

      {!focused && (
        <InboxIndicators active={indicator} onChange={setIndicator} storeId={storeId} />
      )}

      <SoundsControl openConversationId={selectedId} showButton={false} />

      {/* Alto del mockup 152: la bandeja ocupa toda la ventana (mín. 780 px) y cada columna
          tiene su propio scroll; en celular, el alto visible menos la cabecera.
          Vista completa bajo 1400 px (mockup: @media max-width:1400px): lista y chat de 680 px
          y el panel Pedido/Cliente baja a todo el ancho, para que el chat no quede angosto. */}
      <div
        className={cn(
          "grid h-[calc(100dvh-190px)] min-h-[420px] overflow-hidden rounded-2xl border bg-card shadow-sm",
          // Vista enfocada: el chat toma todo el alto bajo la franja de pestañas (mockup: 100vh − 92px).
          focused
            ? "md:h-[calc(100vh-92px)] md:grid-cols-[300px_minmax(0,1fr)]"
            : "md:h-auto md:min-h-0 md:grid-cols-[300px_minmax(0,1fr)] min-[87.5rem]:h-[max(780px,calc(100vh-30px))] min-[87.5rem]:grid-cols-[330px_minmax(0,1fr)]",
        )}
        data-testid="inbox-grid"
      >
        <div
          className={cn(
            "min-h-0 border-r",
            selectedId ? "hidden md:block" : "block",
            !focused && "md:h-[680px] min-[87.5rem]:h-auto",
          )}
        >
          <ConversationList
            selectedId={selectedId}
            onSelect={select}
            indicator={indicator}
            onIndicatorChange={setIndicator}
            storeId={storeId}
            onStoreChange={setStoreChoice}
          />
        </div>
        <div
          className={cn(
            "min-h-0",
            selectedId ? "block" : "hidden md:block",
            // Con chat abierto, el chat y su panel se acomodan en la grilla de la bandeja.
            !focused && (selectedId ? "md:contents min-[87.5rem]:block" : "md:h-[680px] min-[87.5rem]:h-auto"),
          )}
        >
          {selectedId ? (
            <ChatPanel
              key={selectedId}
              conversationId={selectedId}
              onBack={() => select(null)}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
              <MessageCircle className="h-10 w-10" />
              <p>Elige una conversación para ver los mensajes.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
