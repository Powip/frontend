"use client";

import { Input } from "@/components/ui/input";
import type { EvaLinkableItem } from "@/services/evaService";
import { evaSkuKey, isValidEvaSkuCode } from "./evaModalHelpers";

interface EvaSkuItemsEditorProps {
  orderId: string;
  items: EvaLinkableItem[];
  /** Códigos vigentes en el modal, por `evaSkuKey`. */
  codes: Record<string, string>;
  /** Códigos tal como están guardados en el vínculo (para la marca "vinculado"). */
  linkedCodes: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

/** Un campo "SKU EVA" por ítem del pedido (cuentas ALMACEN, FEAT-26). */
export default function EvaSkuItemsEditor({
  orderId,
  items,
  codes,
  linkedCodes,
  onChange,
}: EvaSkuItemsEditorProps) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">
        SKU EVA por producto
      </p>
      {items.map((item, index) => {
        const key = evaSkuKey(orderId, index, item);
        const value = codes[key] ?? "";
        const linked = !!linkedCodes[key] && linkedCodes[key] === value;
        return (
          <div
            key={`${key}:${index}`}
            className="flex items-center justify-between gap-3 text-xs"
          >
            <div className="min-w-0">
              <span className="text-slate-700 dark:text-slate-200">
                {item.productName}
              </span>{" "}
              <span className="font-mono text-slate-400">{item.sku}</span>{" "}
              <span className="text-slate-500">×{item.quantity}</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${linked ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400" : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"}`}
              >
                {linked ? "vinculado" : "nuevo"}
              </span>
              <Input
                aria-label={`SKU EVA de ${item.productName}`}
                value={value}
                onChange={(e) => onChange(key, e.target.value)}
                placeholder="Código EVA"
                className={`h-8 w-36 font-mono text-xs ${value.trim() && !isValidEvaSkuCode(value) ? "border-red-400" : ""}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
