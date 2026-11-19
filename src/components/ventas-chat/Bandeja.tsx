"use client";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCrmEvents } from "@/hooks/useCrmChat";
import ConversationList from "./ConversationList";
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

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
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

      <div className="grid h-[calc(100vh-14rem)] min-h-[420px] overflow-hidden rounded-lg border bg-card md:grid-cols-[340px_1fr]">
        <div className={cn("min-h-0 border-r", selectedId ? "hidden md:block" : "block")}>
          <ConversationList selectedId={selectedId} onSelect={select} />
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
