"use client";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CallSession } from "@/types/crmCallSessions";

/** mm:ss */
export function formatTimer(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function contactOf(s: Pick<CallSession, "contactName" | "contactPhone">) {
  return s.contactName?.trim() || s.contactPhone || "Cliente";
}

/** Ventana flotante de la llamada. */
export default function CallShell({
  title,
  children,
  onClose,
  label = "Llamada de WhatsApp",
}: {
  title: string;
  children: React.ReactNode;
  onClose?: () => void;
  label?: string;
}) {
  return (
    <div
      role="dialog"
      aria-label={label}
      className="fixed bottom-4 right-4 z-50 max-h-[calc(100vh-2rem)] w-[340px] max-w-[calc(100vw-2rem)] space-y-3 overflow-y-auto rounded-xl border bg-card p-4 shadow-lg"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
        >
          {title.trim().charAt(0).toUpperCase() || "?"}
        </span>
        <p className="min-w-0 flex-1 break-words sm:truncate font-semibold">{title}</p>
        {onClose && (
          <Button type="button" variant="ghost" size="icon" aria-label="Cerrar" onClick={onClose}>
            <X />
          </Button>
        )}
      </div>
      {children}
    </div>
  );
}
