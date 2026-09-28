"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import type {
  PublicidadDia,
  TipoRegistroPauta,
} from "@/features/panel-control/publicidad/models/publicidad.model";
import { formatDayKey, formatSoles } from "@/features/panel-control/shared/utils/format";

export const PATRON_ESTIMADO =
  "repeating-linear-gradient(135deg, var(--pc-series-2) 0 4px, transparent 4px 7px)";

const TIPO_LABEL: Record<TipoRegistroPauta, string> = {
  directa: "Pauta directa",
  general: "Pauta general (sin canal)",
  live: "Inversión de sesión Live",
};

export function DesglosePauta({ dia, onCerrar }: { dia: PublicidadDia; onCerrar: () => void }) {
  const tituloRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const titulo = tituloRef.current;
    if (!titulo) return;
    titulo.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
    titulo.focus({ preventScroll: true });
  }, []);

  return (
    <section
      aria-labelledby="desglose-pauta-titulo"
      className="rounded-xl border border-pc-border bg-pc-surface-muted p-3"
    >
      <div className="mb-2 flex items-start gap-2">
        <h4
          id="desglose-pauta-titulo"
          ref={tituloRef}
          tabIndex={-1}
          className="flex-1 text-sm font-semibold text-pc-text outline-none"
        >
          Pauta registrada el {formatDayKey(dia.dia)} · {formatSoles(dia.invertido)}
        </h4>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar desglose de pauta"
          className="rounded p-0.5 text-pc-text-muted outline-none hover:text-pc-text focus-visible:ring-2 focus-visible:ring-pc-primary"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      {dia.registros.length ? (
        <ul className="space-y-1 text-xs">
          {dia.registros.map((registro) => (
            <li
              key={`${registro.canalId ?? "general"}-${registro.tipo}`}
              className="flex items-center justify-between gap-3"
            >
              <span className="flex items-center gap-1.5">
                <i
                  aria-hidden
                  className="inline-block size-2.5 rounded-sm"
                  style={{
                    background:
                      registro.tipo === "general" ? PATRON_ESTIMADO : "var(--pc-series-2)",
                  }}
                />
                {TIPO_LABEL[registro.tipo]}
                {registro.canalNombre ? ` · ${registro.canalNombre}` : ""}
              </span>
              <span className="font-semibold tabular-nums">{formatSoles(registro.monto)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-pc-text-muted">Sin pauta registrada ese día.</p>
      )}
      <p className="mt-2 text-xs text-pc-text-muted">
        La inversión no tiene pedidos asociados: por eso aquí no se abre un detalle de pedidos. La
        pauta general se reparte entre canales solo en el total del periodo (estimado).
      </p>
    </section>
  );
}
