"use client";

import { useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { opsErrorMessage } from "@/lib/warehouseOps";
import { cn } from "@/lib/utils";

// FEAT-24 H5-C — piezas comunes de las pantallas de operación de almacén.

export { Money, SELECT_CLASS } from "@/components/compras/PurchaseBits";

export function StatusPill({ label, className }: { label: string; className: string }) {
  return <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", className)}>{label}</span>;
}

export function ErrorBox({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
      {children}
    </div>
  );
}

/** La regla de la pantalla (mockup: el recuadro «exp»). */
export function RuleNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

interface ReasonDialogProps {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  reasonLabel?: string;
  /** El motivo es obligatorio. */
  requireReason?: boolean;
  destructive?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<unknown>;
  /** Mensaje si falla (además del del servidor). */
  errorFallback: string;
}

/** Confirmar una acción con motivo (anular, rechazar). Si el servidor la rechaza, queda abierto con su mensaje. */
export function ReasonDialog({
  title,
  description,
  confirmLabel,
  reasonLabel = "Motivo",
  requireReason = false,
  destructive = false,
  onClose,
  onConfirm,
  errorFallback,
}: ReasonDialogProps) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const missing = requireReason && reason.trim().length < 3;

  const confirm = async () => {
    if (missing || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
    } catch (failure) {
      setError(opsErrorMessage(failure, errorFallback));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <div>{description}</div>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="ops-reason">
            {reasonLabel}
            {requireReason ? " (obligatorio)" : " (opcional)"}
          </Label>
          <Textarea id="ops-reason" value={reason} maxLength={500} disabled={busy} onChange={(event) => setReason(event.target.value)} />
        </div>
        <ErrorBox>{error}</ErrorBox>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Volver
          </Button>
          <Button type="button" variant={destructive ? "destructive" : "default"} disabled={missing || busy} onClick={() => void confirm()}>
            {busy ? "Guardando…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
