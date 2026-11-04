"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { aNumero } from "@/features/panel-control/configuracion/api/config-cuerpos";
import { mensajeDeError, mensajesDe400 } from "@/features/panel-control/shared/api/panel-errors";
import { panelKeys } from "@/features/panel-control/shared/hooks/panel-keys";

export interface ReglaNumero {
  /** Tope inclusivo (p. ej. 100 para porcentajes). */
  max?: number;
  entero?: boolean;
  /** Mínimo inclusivo (por defecto 0). */
  min?: number;
  /** El campo puede quedar vacío (= sin valor / no se envía). */
  opcional?: boolean;
}

/** Validación del campo: número ≥ 0 (y ≤ tope si lo hay). `null` = válido. */
export function errorNumero(texto: string, regla: ReglaNumero = {}): string | null {
  if (texto.trim() === "") return regla.opcional ? null : "Obligatorio";
  const numero = aNumero(texto);
  const minimo = regla.min ?? 0;
  if (!Number.isFinite(numero) || numero < minimo) {
    return minimo === 0 ? "Debe ser un número ≥ 0" : `Debe ser un número ≥ ${minimo}`;
  }
  if (regla.entero && !Number.isInteger(numero)) return "Debe ser un número entero";
  if (regla.max !== undefined && numero > regla.max) {
    return regla.max === 100 ? "Máximo 100 %" : `Máximo ${regla.max}`;
  }
  return null;
}

export function CampoNumero({
  etiqueta,
  valor,
  prefijo,
  sufijo,
  editable,
  regla,
  onChange,
}: {
  etiqueta: string;
  valor: string;
  prefijo?: string;
  sufijo?: string;
  editable: boolean;
  regla?: ReglaNumero;
  onChange: (valor: string) => void;
}) {
  const id = useId();
  const mensaje = errorNumero(valor, regla);
  return (
    <div className="flex items-center justify-end gap-1.5">
      <label htmlFor={id} className="sr-only">
        {etiqueta}
      </label>
      {prefijo && <span className="text-xs text-pc-text-muted">{prefijo}</span>}
      <input
        id={id}
        inputMode="decimal"
        value={valor}
        readOnly={!editable}
        aria-invalid={!!mensaje}
        aria-describedby={mensaje ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-24 rounded-md border border-pc-border bg-pc-card px-2 text-right text-xs tabular-nums text-pc-text outline-none focus-visible:ring-2 focus-visible:ring-pc-primary read-only:bg-pc-surface-muted aria-invalid:border-pc-bad"
      />
      {sufijo !== undefined && <span className="w-8 text-xs text-pc-text-muted">{sufijo}</span>}
      {mensaje && (
        <span id={`${id}-error`} role="alert" className="text-[11px] text-pc-bad">
          {mensaje}
        </span>
      )}
    </div>
  );
}

/** Errores que devolvió el backend al guardar; el formulario conserva lo tipeado. */
export function ErroresDelServidor({ errores }: { errores: string[] }) {
  if (!errores.length) return null;
  return (
    <ul
      aria-label="No se pudo guardar"
      className="space-y-1 rounded-lg border border-pc-bad px-3 py-2 text-xs text-pc-bad"
    >
      {errores.map((error) => (
        <li key={error} role="alert">
          {error}
        </li>
      ))}
    </ul>
  );
}

/**
 * Guardado de un formulario de Configuración: manda el cuerpo, muestra los errores del backend
 * (400 con su texto; otros con el mensaje general) y, si sale bien, invalida todo lo del panel
 * para que Equipo, Finanzas, Couriers y Canales lo reflejen al recargar.
 */
export function useGuardarConfig<C, R>(
  guardar: (cuerpo: C) => Promise<R>,
  etiqueta: string,
  alGuardar?: () => void,
) {
  const cliente = useQueryClient();
  const [errores, setErrores] = useState<string[]>([]);
  const mutacion = useMutation({
    mutationFn: guardar,
    onSuccess: () => {
      setErrores([]);
      toast.success(`${etiqueta}: guardado`);
      void cliente.invalidateQueries({ queryKey: panelKeys.all });
      alGuardar?.();
    },
    onError: (error) => {
      const del400 = mensajesDe400(error);
      setErrores(del400.length ? del400 : [mensajeDeError(error)]);
    },
  });
  return {
    guardar: (cuerpo: C) => mutacion.mutate(cuerpo),
    guardando: mutacion.isPending,
    errores,
  };
}
