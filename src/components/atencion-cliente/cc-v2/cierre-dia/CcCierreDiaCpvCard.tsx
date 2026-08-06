"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "./cierreDiaUtils";

export interface CpvValues {
  publiMeta: number;
  publiTiktok: number;
  publiGoogle: number;
}

interface Props {
  values: CpvValues;
  onChange: (values: CpvValues) => void;
}

const PLATFORMS = [
  { key: "publiMeta" as const, label: "Meta Ads", icon: "📘", pillClass: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300" },
  { key: "publiTiktok" as const, label: "TikTok Ads", icon: "🎵", pillClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" },
  { key: "publiGoogle" as const, label: "Google Ads", icon: "🔍", pillClass: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
];

/**
 * Presentacional y controlado: el padre (CcCierreDiaDayView) es dueño del
 * estado y del guardado — el botón "💾 Guardar día" del header persiste
 * estos valores. Así solo hay un punto de guardado, no uno por campo.
 */
export function CcCierreDiaCpvCard({ values, onChange }: Props) {
  const total = values.publiMeta + values.publiTiktok + values.publiGoogle;

  return (
    <Card>
      <CardContent className="py-4 px-4 space-y-3">
        <p className="text-sm font-bold">📣 Gasto de Publicidad</p>
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Gasto por plataforma</p>

        {PLATFORMS.map((p) => (
          <div key={p.key} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
            <span className="flex-1 text-xs flex items-center gap-1.5">
              <span>{p.icon}</span> {p.label}
            </span>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">S/</span>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={values[p.key] || ""}
                placeholder="0"
                onChange={(e) => onChange({ ...values, [p.key]: parseFloat(e.target.value) || 0 })}
                className="h-8 w-28 pl-7 text-xs"
              />
            </div>
          </div>
        ))}

        <div className="pt-2 border-t">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted-foreground">Total publicidad</span>
            <span className="text-sm font-extrabold text-teal-600 dark:text-teal-400">{formatCurrency(total)}</span>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {PLATFORMS.map((p) => (
              <span key={p.key} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${p.pillClass}`}>
                {p.label.split(" ")[0]} {total ? Math.round((values[p.key] / total) * 100) : 0}%
              </span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
