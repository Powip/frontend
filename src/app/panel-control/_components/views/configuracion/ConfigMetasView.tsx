"use client";

import { RotateCcw, Save } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { ContractView } from "@/components/panel-control/ContractView";
import { PanelCard } from "@/components/panel-control/PanelCard";
import { notifyPendingIntegration } from "@/components/panel-control/pending-integration";
import { Button } from "@/components/ui/button";
import { usePanelContract } from "@/features/panel-control/shared/hooks/use-panel-contract";
import { usePanelOptions } from "@/features/panel-control/shared/hooks/use-panel-options";
import type { DataOrigin } from "@/features/panel-control/shared/models/data-origin.model";
import {
  META_INDICADOR_IDS,
  type MetaIndicador,
  type MetasPanel,
} from "@/features/panel-control/shared/models/goal.model";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { formatNumber } from "@/features/panel-control/shared/utils/format";

type Valores = Record<string, string>;

const UNIDAD: Record<MetaIndicador["unidad"], string> = {
  porcentaje: "%",
  minutos: "min",
  dias: "días",
  veces: "x",
  cantidad: "N°",
};

function valorInicial(meta: MetaIndicador): string {
  return meta.unidad === "porcentaje"
    ? String(Math.round(meta.valor * 1000) / 10)
    : String(meta.valor);
}

function error(texto: string, unidad: MetaIndicador["unidad"] | "soles" | "numero"): string | null {
  if (texto.trim() === "") return "Obligatorio";
  const numero = Number(texto.replace(",", "."));
  if (!Number.isFinite(numero) || numero < 0) return "Debe ser un número ≥ 0";
  if (unidad === "porcentaje" && numero > 100) return "Máximo 100 %";
  return null;
}

function CampoNumero({
  etiqueta,
  valor,
  unidad,
  sufijo,
  editable,
  onChange,
}: {
  etiqueta: string;
  valor: string;
  unidad: MetaIndicador["unidad"] | "soles" | "numero";
  sufijo: string;
  editable: boolean;
  onChange: (valor: string) => void;
}) {
  const id = useId();
  const mensaje = error(valor, unidad);
  return (
    <div className="flex items-center justify-end gap-1.5">
      <label htmlFor={id} className="sr-only">
        {etiqueta}
      </label>
      {unidad === "soles" && <span className="text-xs text-pc-text-muted">S/</span>}
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
      <span className="w-8 text-xs text-pc-text-muted">{sufijo}</span>
      {mensaje && (
        <span id={`${id}-error`} role="alert" className="text-[11px] text-pc-bad">
          {mensaje}
        </span>
      )}
    </div>
  );
}

function valoresDe(metas: MetasPanel): Valores {
  const valores: Valores = {};
  for (const id of META_INDICADOR_IDS)
    valores[`indicador:${id}`] = valorInicial(metas.indicadores[id]);
  for (const [grupo, registro] of Object.entries(metas.mensuales)) {
    for (const [id, valor] of Object.entries(registro)) valores[`${grupo}:${id}`] = String(valor);
  }
  return valores;
}

function Formulario({
  metas,
  editable,
  origin,
}: {
  metas: MetasPanel;
  editable: boolean;
  origin: DataOrigin;
}) {
  const { canalNombre, asesorNombre } = usePanelOptions();
  const iniciales = useMemo(() => valoresDe(metas), [metas]);
  const [valores, setValores] = useState<Valores>(iniciales);
  const cambios = Object.keys(valores).filter(
    (clave) => valores[clave] !== iniciales[clave],
  ).length;
  const errores = Object.entries(valores).filter(([clave, valor]) => {
    const [grupo, id] = clave.split(":");
    const unidad =
      grupo === "indicador"
        ? metas.indicadores[id as (typeof META_INDICADOR_IDS)[number]].unidad
        : grupo === "porConfirmadora"
          ? "numero"
          : "soles";
    return error(valor, unidad) !== null;
  }).length;
  const cambiar = (clave: string) => (valor: string) =>
    setValores((actual) => ({ ...actual, [clave]: valor }));

  const mensuales: {
    grupo: keyof MetasPanel["mensuales"];
    titulo: string;
    unidad: "soles" | "numero";
    nombre: (id: string) => string;
  }[] = [
    {
      grupo: "porCanal",
      titulo: "Meta mensual por canal (S/)",
      unidad: "soles",
      nombre: (id) => canalNombre(id) ?? id,
    },
    {
      grupo: "porVendedora",
      titulo: "Meta mensual por vendedora (S/)",
      unidad: "soles",
      nombre: (id) => asesorNombre(id) ?? id,
    },
    {
      grupo: "porConfirmadora",
      titulo: "Meta mensual por confirmadora (confirmados)",
      unidad: "numero",
      nombre: (id) => asesorNombre(id) ?? id,
    },
  ];

  return (
    <div className="space-y-3.5">
      <PanelCard
        titulo="Indicadores"
        origin={origin}
        subtitulo="Semáforo: cumple si alcanza la meta; «cerca» dentro de la tolerancia; los porcentajes se comparan redondeados a 2 decimales (§11.1)"
        acciones={
          editable && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!cambios}
                onClick={() => setValores(iniciales)}
              >
                <RotateCcw aria-hidden />
                Restablecer
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!cambios || errores > 0}
                onClick={() => notifyPendingIntegration("Guardar metas", "config-metas-guardar")}
                className="bg-pc-primary text-white hover:bg-pc-primary-strong"
              >
                <Save aria-hidden />
                Guardar {cambios ? `(${cambios})` : ""}
                <span className="rounded bg-white/20 px-1 text-[10px] font-bold uppercase">
                  Pendiente
                </span>
              </Button>
            </>
          )
        }
      >
        <div className="overflow-auto rounded-xl border border-pc-border-soft">
          <table className="w-full border-collapse text-[12.5px]">
            <caption className="sr-only">Metas por indicador</caption>
            <thead>
              <tr className="bg-pc-surface-muted text-[11px] uppercase tracking-wide text-pc-text-muted">
                <th scope="col" className="px-2.5 py-2 text-left font-semibold">
                  Indicador
                </th>
                <th scope="col" className="px-2.5 py-2 text-left font-semibold">
                  Dirección
                </th>
                <th scope="col" className="px-2.5 py-2 text-right font-semibold">
                  Meta
                </th>
                <th scope="col" className="px-2.5 py-2 text-right font-semibold">
                  Tolerancia «cerca»
                </th>
              </tr>
            </thead>
            <tbody>
              {META_INDICADOR_IDS.map((id) => {
                const meta = metas.indicadores[id];
                return (
                  <tr key={id} className="border-t border-pc-border-soft">
                    <th scope="row" className="px-2.5 py-1.5 text-left font-medium">
                      {meta.etiqueta}
                    </th>
                    <td className="px-2.5 py-1.5 text-pc-text-muted">
                      {meta.direccion === "minimo" ? "Mínimo (≥)" : "Máximo (≤)"}
                    </td>
                    <td className="px-2.5 py-1.5">
                      <CampoNumero
                        etiqueta={`Meta de ${meta.etiqueta}`}
                        valor={valores[`indicador:${id}`]}
                        unidad={meta.unidad}
                        sufijo={UNIDAD[meta.unidad]}
                        editable={editable}
                        onChange={cambiar(`indicador:${id}`)}
                      />
                    </td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums text-pc-text-muted">
                      {formatNumber(meta.tolerancia * 100)} %
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </PanelCard>
      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-3">
        {mensuales.map(({ grupo, titulo, unidad, nombre }) => {
          const ids = Object.keys(metas.mensuales[grupo]);
          return (
            <PanelCard
              key={grupo}
              titulo={titulo}
              origin={origin}
              subtitulo="Se prorratean por los días del periodo: meta × días ÷ 30"
            >
              {ids.length ? (
                <ul className="divide-y divide-pc-border-soft">
                  {ids.map((id) => (
                    <li key={id} className="flex items-center justify-between gap-2 py-1.5 text-xs">
                      <span className="min-w-0 truncate font-medium">{nombre(id)}</span>
                      <CampoNumero
                        etiqueta={`${titulo}: ${nombre(id)}`}
                        valor={valores[`${grupo}:${id}`]}
                        unidad={unidad}
                        sufijo={unidad === "soles" ? "" : "conf."}
                        editable={editable}
                        onChange={cambiar(`${grupo}:${id}`)}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-pc-text-muted">Sin metas cargadas.</p>
              )}
            </PanelCard>
          );
        })}
      </div>
      {origin.kind !== "real" && (
        <p className="text-xs text-pc-text-muted">
          Metas demo: GET /config/metas todavía no existe. Los montos mensuales son de ejemplo
          aunque los nombres de canales y asesores sean reales; no los uses para evaluar a nadie.
        </p>
      )}
      {editable && (
        <p className="text-xs text-pc-text-muted">
          Guardar requiere PUT /config/metas: hoy no persiste nada. Mientras no exista, el panel usa
          las metas por defecto de la especificación y metas mensuales de ejemplo.
        </p>
      )}
    </div>
  );
}

export function ConfigMetasView() {
  const { session, view } = usePanel();
  const query = useMemo(
    () => (session.empresaId ? { empresaId: session.empresaId } : null),
    [session.empresaId],
  );
  const metas = usePanelContract("config-metas", query);
  const editable = view.access === "permitido" && view.capabilities.has("editar_configuracion");
  return (
    <ContractView state={metas} label="metas" skeleton="tabla">
      {(data, origin) => (
        <Formulario key={JSON.stringify(data)} metas={data} editable={editable} origin={origin} />
      )}
    </ContractView>
  );
}
