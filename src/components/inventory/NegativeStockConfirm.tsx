"use client";

import { AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

// FEAT-24 C-D3 — casilla obligatoria para registrar una salida que deja el físico en negativo (control de stock
// flexible). La usan «Ajustar stock», el ajuste o merma y el despacho de traslados.

interface Props {
  id: string;
  /** Aviso de arriba: el mensaje del servidor (409 `STOCK_NEGATIVO_CONFIRMAR`) o el de la pantalla. */
  message?: string | null;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export default function NegativeStockConfirm({ id, message, label, checked, disabled, onCheckedChange }: Props) {
  return (
    <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
      {message ? (
        <p className="flex items-start gap-1.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {message}
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <Checkbox id={id} checked={checked} disabled={disabled} onCheckedChange={(value) => onCheckedChange(value === true)} />
        <label htmlFor={id} className="cursor-pointer font-medium">
          {label}
        </label>
      </div>
    </div>
  );
}
