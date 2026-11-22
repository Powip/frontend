"use client";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCrmEvents } from "@/hooks/useCrmChat";
import { useCrmMe } from "@/hooks/useCrmMe";
import { NATIVE_SELECT_CLASS } from "./format";
import ConversationList from "./ConversationList";
import InboxIndicators, { type InboxIndicator } from "./InboxIndicators";
import ChatPanel from "./ChatPanel";

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
  const live = useCrmEvents();
  const [indicator, setIndicator] = useState<InboxIndicator | null>(null);
  const { stores } = useCrmMe();
  const [storeChoice, setStoreChoice] = useState("");
  // Si la tienda elegida deja de existir, se vuelve a «todas».
  const storeId = stores.some((s) => s.id === storeChoice) ? storeChoice : undefined;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end gap-3">
        {stores.length > 1 && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Tienda
            <select
              value={storeId ?? ""}
              onChange={(e) => setStoreChoice(e.target.value)}
              className={cn(NATIVE_SELECT_CLASS, "w-auto min-w-40")}
            >
              <option value="">Todas las tiendas</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
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

      <InboxIndicators active={indicator} onChange={setIndicator} storeId={storeId} />

      <div className="grid h-[calc(100vh-14rem)] min-h-[420px] overflow-hidden rounded-lg border bg-card md:grid-cols-[340px_1fr]">
        <div className={cn("min-h-0 border-r", selectedId ? "hidden md:block" : "block")}>
          <ConversationList
            selectedId={selectedId}
            onSelect={select}
            indicator={indicator}
            onIndicatorChange={setIndicator}
            storeId={storeId}
          />
        </div>
        <div className={cn("min-h-0", selectedId ? "block" : "hidden md:block")}>
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
