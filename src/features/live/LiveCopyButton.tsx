"use client";

import { Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { copyLiveText } from "./liveCopy";

/**
 * FEAT-33 A2: un solo botón de copiar para todo Live. Cambia a «✓ Copiado» por 2 s y avisa;
 * si el navegador no deja copiar, muestra el texto seleccionado para copiarlo a mano.
 */
export default function LiveCopyButton({
  text,
  label,
  size = "sm",
  variant = "outline",
  disabled = false,
  className,
}: {
  text: string;
  label: string;
  size?: "sm" | "default";
  variant?: "outline" | "default" | "ghost";
  disabled?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  async function copy() {
    if ((await copyLiveText(text)) === "copied") {
      toast.success("✓ Copiado");
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
      return;
    }
    toast.error("No se pudo copiar. Mantén presionado el link para copiarlo.");
    setManual(true);
  }
  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={className}
        disabled={disabled || !text}
        onClick={() => void copy()}
      >
        {copied ? null : <Copy className="h-4 w-4" aria-hidden="true" />}
        {copied ? "✓ Copiado" : label}
      </Button>
      <Dialog open={manual} onOpenChange={setManual}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copia el link a mano</DialogTitle>
            <DialogDescription>
              Tu navegador no dejó copiarlo. Ya está seleccionado: mantén
              presionado y elige Copiar (en computadora, Ctrl + C).
            </DialogDescription>
          </DialogHeader>
          <textarea
            aria-label="Texto para copiar"
            readOnly
            autoFocus
            rows={3}
            value={text}
            onFocus={(event) => event.currentTarget.select()}
            className="w-full resize-none rounded-lg border bg-muted/30 p-3 text-sm"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
