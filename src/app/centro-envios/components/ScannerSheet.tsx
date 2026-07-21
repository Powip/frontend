"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScanLine, CheckCircle2, XCircle, Info } from "lucide-react";
import { OrderHeader } from "@/interfaces/IOrder";
import { cn } from "@/lib/utils";

// @zxing/browser toca navigator.mediaDevices (no existe en SSR) y solo se
// necesita si el usuario elige modo cámara, así que se carga bajo demanda:
// el resto de usuarios (lectora USB/Bluetooth o input manual) no paga ese
// peso en el bundle inicial.
const CameraScanner = dynamic(() => import("./CameraScanner"), {
  ssr: false,
  loading: () => (
    <div className="w-full aspect-video rounded-lg border bg-muted animate-pulse flex items-center justify-center text-sm text-muted-foreground">
      Cargando cámara…
    </div>
  ),
});

type ScanMode = "despacho" | "confirmar" | "consultar";
type InputMethod = "manual" | "camara";

interface ScanLogEntry {
  id: number;
  kind: "ok" | "error" | "info";
  title: string;
  detail: string;
}

interface ScannerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: OrderHeader[];
  onDispatch: (order: OrderHeader) => Promise<void>;
  onConfirmDelivery: (order: OrderHeader) => Promise<void>;
}

const MODES: { value: ScanMode; label: string }[] = [
  { value: "despacho", label: "📦 Despacho" },
  { value: "confirmar", label: "✅ Confirmar entrega" },
  { value: "consultar", label: "🔍 Consultar" },
];

const INPUT_METHODS: { value: InputMethod; label: string }[] = [
  { value: "manual", label: "⌨️ Manual / lectora" },
  { value: "camara", label: "📷 Cámara" },
];

export default function ScannerSheet({
  open,
  onOpenChange,
  orders,
  onDispatch,
  onConfirmDelivery,
}: ScannerSheetProps) {
  const [mode, setMode] = useState<ScanMode>("despacho");
  const [inputMethod, setInputMethod] = useState<InputMethod>("manual");
  const [value, setValue] = useState("");
  const [log, setLog] = useState<ScanLogEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);

  useEffect(() => {
    if (open && inputMethod === "manual") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, mode, inputMethod]);

  // Evita reabrir el drawer en modo cámara con el componente ya desmontado.
  useEffect(() => {
    if (!open) setInputMethod("manual");
  }, [open]);

  const pushLog = (entry: Omit<ScanLogEntry, "id">) => {
    nextId.current += 1;
    setLog((prev) => [{ id: nextId.current, ...entry }, ...prev].slice(0, 30));
  };

  // Lógica de negocio compartida por el input manual (form submit) y la
  // cámara (onDecode) — solo cambia de dónde llega el código.
  const processCode = async (rawCode: string) => {
    const code = rawCode.trim().toUpperCase();
    if (!code) return;

    const order = orders.find(
      (o) =>
        o.orderNumber.toUpperCase() === code ||
        o.guideNumber?.toUpperCase() === code ||
        o.externalTrackingNumber?.toUpperCase() === code,
    );

    if (!order) {
      pushLog({
        kind: "error",
        title: code,
        detail: "No se encontró ningún pedido con ese código",
      });
      return;
    }

    if (mode === "consultar") {
      pushLog({
        kind: "info",
        title: `${order.orderNumber} · ${order.customer.fullName}`,
        detail: `Estado: ${order.status}${order.guideNumber ? ` · Guía ${order.guideNumber}` : ""}${order.courier ? ` · ${order.courier}` : ""}`,
      });
      return;
    }

    if (mode === "despacho") {
      if (!order.guideNumber) {
        pushLog({
          kind: "error",
          title: order.orderNumber,
          detail: "Sin guía asignada — crea la guía antes de despachar",
        });
        return;
      }
      if (!["PREPARADO", "LLAMADO", "ASIGNADO_A_GUIA"].includes(order.status)) {
        pushLog({
          kind: "error",
          title: order.orderNumber,
          detail: `Estado actual (${order.status}) no permite despacho`,
        });
        return;
      }
      setBusy(true);
      try {
        await onDispatch(order);
        pushLog({
          kind: "ok",
          title: `${order.orderNumber} · ${order.customer.fullName}`,
          detail: "Despachado · en tránsito",
        });
      } catch {
        pushLog({
          kind: "error",
          title: order.orderNumber,
          detail: "No se pudo despachar el pedido",
        });
      } finally {
        setBusy(false);
      }
      return;
    }

    // confirmar entrega
    if (order.status !== "EN_ENVIO") {
      pushLog({
        kind: "error",
        title: order.orderNumber,
        detail: `Estado actual (${order.status}) no está en tránsito`,
      });
      return;
    }
    setBusy(true);
    try {
      await onConfirmDelivery(order);
      pushLog({
        kind: "ok",
        title: `${order.orderNumber} · ${order.customer.fullName}`,
        detail: "Entrega confirmada",
      });
    } catch {
      pushLog({
        kind: "error",
        title: order.orderNumber,
        detail: "No se pudo confirmar la entrega",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleManualSubmit = async () => {
    const code = value;
    setValue("");
    inputRef.current?.focus();
    await processCode(code);
  };

  const okCount = log.filter((l) => l.kind === "ok").length;
  const errorCount = log.filter((l) => l.kind === "error").length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg flex flex-col gap-4"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-lg">
            <ScanLine className="h-5 w-5" /> Escáner de despacho
          </SheetTitle>
        </SheetHeader>

        <div className="flex gap-1 bg-muted p-1 rounded-lg">
          {MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => setMode(m.value)}
              className={cn(
                "flex-1 text-sm font-semibold py-2.5 rounded-md transition-colors",
                mode === m.value
                  ? "bg-background shadow-sm text-primary"
                  : "text-muted-foreground",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div>
          <div className="text-xs text-muted-foreground mb-2">
            Elige cómo vas a ingresar el código
          </div>
          <div className="flex gap-1 bg-muted p-1 rounded-lg">
            {INPUT_METHODS.map((m) => (
              <button
                key={m.value}
                onClick={() => setInputMethod(m.value)}
                className={cn(
                  "flex-1 text-sm font-semibold py-2 rounded-md transition-colors",
                  inputMethod === m.value
                    ? "bg-background shadow-sm text-primary"
                    : "text-muted-foreground",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {inputMethod === "manual" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleManualSubmit();
            }}
            className="flex gap-2"
          >
            <input
              ref={inputRef}
              placeholder="ORD-XXXXXX / N° guía"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={busy}
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3.5 py-1 text-base shadow-xs outline-none font-mono focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:opacity-50"
            />
            <Button type="submit" disabled={busy}>
              Escanear
            </Button>
          </form>
        ) : (
          <CameraScanner
            active={open && inputMethod === "camara"}
            onDecode={processCode}
            disabled={busy}
          />
        )}

        <div className="flex-1 overflow-y-auto space-y-2.5">
          <div className="text-xs font-semibold text-muted-foreground uppercase">
            Escaneados en esta sesión
          </div>
          {log.length === 0 && (
            <div className="text-sm text-muted-foreground border rounded-lg p-4 text-center">
              Escanea o escribe un código para comenzar
            </div>
          )}
          {log.map((entry) => (
            <div
              key={entry.id}
              className={cn(
                "flex items-start gap-2.5 rounded-lg border p-3 text-sm",
                entry.kind === "ok" &&
                  "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-900",
                entry.kind === "error" &&
                  "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-900",
                entry.kind === "info" &&
                  "bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-900",
              )}
            >
              {entry.kind === "ok" && (
                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
              )}
              {entry.kind === "error" && (
                <XCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              {entry.kind === "info" && (
                <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <div className="font-semibold">{entry.title}</div>
                <div className="text-muted-foreground text-xs">{entry.detail}</div>
              </div>
            </div>
          ))}
        </div>

        <SheetFooter className="border-t pt-3.5">
          <div className="flex-1 text-sm text-muted-foreground">
            <b className="text-foreground">{okCount}</b> ok ·{" "}
            <b className="text-foreground">{errorCount}</b> errores
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
