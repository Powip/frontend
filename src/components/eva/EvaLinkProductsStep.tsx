"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isValidEvaSkuCode, type EvaLinkCandidate } from "./evaModalHelpers";

interface EvaLinkProductsStepProps {
  candidates: EvaLinkCandidate[];
  saving: boolean;
  /** Recibe solo los códigos escritos, por variantId (sin espacios). */
  onSave: (codes: Record<string, string>) => Promise<void>;
}

/**
 * Paso "Vincular productos" (FEAT-26): lista una sola vez las variantes sin código EVA
 * de todos los pedidos del envío para escribir cada código una única vez.
 */
export default function EvaLinkProductsStep({
  candidates,
  saving,
  onSave,
}: EvaLinkProductsStepProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const written = Object.entries(values).filter(([, v]) => v.trim() !== "");
  const hasInvalid = written.some(([, v]) => !isValidEvaSkuCode(v));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {candidates.length} producto{candidates.length !== 1 ? "s" : ""} sin
        código EVA. Escribí el código del almacén de EVA una vez y queda
        guardado.
      </div>
      <div className="divide-y rounded-lg border dark:divide-slate-700 dark:border-slate-700">
        {candidates.map((c) => (
          <div
            key={c.variantId}
            className="flex items-center justify-between gap-3 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                {c.productName}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                <span className="font-mono">{c.powipSku}</span>
                {c.attributes &&
                  Object.keys(c.attributes).length > 0 &&
                  ` · ${Object.values(c.attributes).join(" / ")}`}
                {` · x${c.totalQuantity} · ${c.orderCount} pedido${c.orderCount !== 1 ? "s" : ""}`}
              </p>
            </div>
            <Input
              aria-label={`SKU EVA de ${c.productName}`}
              value={values[c.variantId] ?? ""}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [c.variantId]: e.target.value }))
              }
              placeholder="Ej: FEMI064"
              className={`h-9 w-40 font-mono text-xs ${values[c.variantId]?.trim() && !isValidEvaSkuCode(values[c.variantId]) ? "border-red-400" : ""}`}
            />
          </div>
        ))}
      </div>
      <Button
        onClick={() =>
          onSave(Object.fromEntries(written.map(([k, v]) => [k, v.trim()])))
        }
        disabled={saving || hasInvalid}
        className="h-11 w-full bg-blue-500 font-bold text-white hover:bg-blue-600"
      >
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Guardar vínculos y seguir
      </Button>
    </div>
  );
}
