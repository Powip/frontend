"use client";

import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isDniDoc, PERSONA_NATURAL_DNI_HINT } from "@/components/shalom/shalomPersonaNaturalFix";

export interface ShalomDniRetryFormProps {
  /** Prefijo para ids y test ids (uno por pedido con error). */
  idPrefix: string;
  /** Deshabilita el formulario mientras otro envío está en curso. */
  disabled?: boolean;
  /** Reenvía solo este pedido a Shalom con el DNI. El DNI no se guarda en el cliente. */
  onSubmit: (dni: string) => Promise<void>;
}

/**
 * Aparece debajo del error «La declaración jurada solo es para persona natural» cuando el
 * pedido se envió con RUC. Pide el DNI del cliente y reenvía solo ese pedido.
 */
export default function ShalomDniRetryForm({ idPrefix, disabled, onSubmit }: ShalomDniRetryFormProps) {
  const [dni, setDni] = useState("");
  const [sending, setSending] = useState(false);
  const valid = isDniDoc(dni);

  const handleSubmit = async () => {
    if (!valid) return;
    setSending(true);
    try {
      await onSubmit(dni.trim());
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-2 space-y-1.5 text-left" data-testid={`${idPrefix}-dni-retry`}>
      <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
        {PERSONA_NATURAL_DNI_HINT}
      </p>
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label
            htmlFor={`${idPrefix}-dni`}
            className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500"
          >
            DNI del cliente
          </Label>
          <Input
            id={`${idPrefix}-dni`}
            inputMode="numeric"
            maxLength={8}
            placeholder="8 dígitos"
            value={dni}
            onChange={(e) => setDni(e.target.value.replace(/\D/g, "").slice(0, 8))}
            className="h-8 bg-white text-sm dark:bg-slate-700 dark:text-slate-100"
          />
        </div>
        <Button
          type="button"
          size="sm"
          disabled={!valid || sending || disabled}
          onClick={handleSubmit}
        >
          {sending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Reenviar con DNI
        </Button>
      </div>
    </div>
  );
}
