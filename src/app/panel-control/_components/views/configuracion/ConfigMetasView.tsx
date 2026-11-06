"use client";

import { RotateCcw, Save } from "lucide-react";
import { useMemo, useState } from "react";
import { ContractView } from "@/components/panel-control/ContractView";
import { PanelCard } from "@/components/panel-control/PanelCard";
import { Button } from "@/components/ui/button";
import { putConfigMetas } from "@/features/panel-control/configuracion/api/config.api";
import { cuerpoDeMetas } from "@/features/panel-control/configuracion/api/config-cuerpos";
import { usePanelContract } from "@/features/panel-control/shared/hooks/use-panel-contract";
import { usePanelOptions } from "@/features/panel-control/shared/hooks/use-panel-options";
import type { DataOrigin } from "@/features/panel-control/shared/models/data-origin.model";
import {
  META_INDICADOR_IDS,
  type MetaIndicador,
  type MetaIndicadorId,
  type MetasPanel,
} from "@/features/panel-control/shared/models/goal.model";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { formatNumber } from "@/features/panel-control/shared/utils/format";
import { CampoNumero, ErroresDelServidor, errorNumero, useGuardarConfig } from "./config-form";

type Valores = Record<string, string>;

const UNIDAD: Record<MetaIndicador["unidad"], string> = {
  porcentaje: "%",
  minutos: "min",
  dias: "días",
  veces: "x",
  cantidad: "N°",
};

type UnidadCampo = MetaIndicador["unidad"] | "soles" | "numero";
type GrupoMensual = keyof MetasPanel["mensuales"];

const GRUPOS_MENSUALES: GrupoMensual[] = ["porCanal", "porVendedora", "porConfirmadora"];

function valorInicial(meta: MetaIndicador): string {
  return meta.unidad === "porcentaje"
    ? String(Math.round(meta.valor * 1000) / 10)
    : String(meta.valor);
}

function valoresDe(metas: MetasPanel): Valores {
  const valores: Valores = {};
  for (const id of META_INDICADOR_IDS)
    valores[`indicador:${id}`] = valorInicial(metas.indicadores[id]);
  for (const grupo of GRUPOS_MENSUALES) {
    for (const [id, valor] of Object.entries(metas.mensuales[grupo])) {
      valores[`${grupo}:${id}`] = String(valor);
    }
  }
  return valores;
}

function separar(clave: string): [string, string] {
  const corte = clave.indexOf(":");
  return [clave.slice(0, corte), clave.slice(corte + 1)];
}

function unidadDe(clave: string, metas: MetasPanel): UnidadCampo {
  const [grupo, id] = separar(clave);
  if (grupo === "indicador") return metas.indicadores[id as MetaIndicadorId].unidad;
  return grupo === "porConfirmadora" ? "numero" : "soles";
}

/** Una meta mensual que todavía no existe puede quedar vacía (= no se carga). */
function esNueva(clave: string, iniciales: Valores): boolean {
  return !(clave in iniciales) && !clave.startsWith("indicador:");
}

function reglaDe(clave: string, metas: MetasPanel, iniciales: Valores) {
  return {
    max: unidadDe(clave, metas) === "porcentaje" ? 100 : undefined,
    opcional: esNueva(clave, iniciales),
  };
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
  const { canales, asesores, canalNombre, asesorNombre } = usePanelOptions();
  const iniciales = useMemo(() => valoresDe(metas), [metas]);
  const [valores, setValores] = useState<Valores>(iniciales);
  const {
    guardar,
    guardando,
    errores: erroresServidor,
  } = useGuardarConfig(putConfigMetas, "Metas");
  const valorDe = (clave: string) => valores[clave] ?? iniciales[clave] ?? "";
  const claves = [...new Set([...Object.keys(iniciales), ...Object.keys(valores)])];
  const cambios = claves.filter(
    (clave) => valorDe(clave) !== (iniciales[clave] ?? "") && !(valorDe(clave).trim() === ""),
  ).length;
  const errores = claves.filter(
    (clave) => errorNumero(valorDe(clave), reglaDe(clave, metas, iniciales)) !== null,
  ).length;
  const cambiar = (clave: string) => (valor: string) =>
    setValores((actual) => ({ ...actual, [clave]: valor }));
  const enviar = () => guardar(cuerpoDeMetas(valores, iniciales, metas));

  const idsDe = (grupo: GrupoMensual): string[] => {
    const existentes = Object.keys(metas.mensuales[grupo]);
    const candidatos =
      grupo === "porCanal"
        ? (canales.data ?? []).map((canal) => canal.id)
        : (asesores.data ?? []).map((asesor) => asesor.id);
    return [...new Set([...existentes, ...candidatos])];
  };

  const mensuales: {
    grupo: GrupoMensual;
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
      <ErroresDelServidor errores={erroresServidor} />
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
                disabled={!cambios || guardando}
                onClick={() => setValores(iniciales)}
              >
                <RotateCcw aria-hidden />
                Restablecer
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!cambios || errores > 0 || guardando}
                onClick={enviar}
                className="bg-pc-primary text-white hover:bg-pc-primary-strong"
              >
                <Save aria-hidden />
                {guardando ? "Guardando…" : `Guardar ${cambios ? `(${cambios})` : ""}`}
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
                const clave = `indicador:${id}`;
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
                        valor={valorDe(clave)}
                        sufijo={UNIDAD[meta.unidad]}
                        regla={reglaDe(clave, metas, iniciales)}
                        editable={editable}
                        onChange={cambiar(clave)}
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
          const ids = idsDe(grupo);
          return (
            <PanelCard
              key={grupo}
              titulo={titulo}
              origin={origin}
              subtitulo="Se prorratean por los días del periodo: meta × días ÷ 30. Vacío = sin meta"
            >
              {ids.length ? (
                <ul className="divide-y divide-pc-border-soft">
                  {ids.map((id) => {
                    const clave = `${grupo}:${id}`;
                    return (
                      <li
                        key={id}
                        className="flex items-center justify-between gap-2 py-1.5 text-xs"
                      >
                        <span className="min-w-0 truncate font-medium">{nombre(id)}</span>
                        <CampoNumero
                          etiqueta={`${titulo}: ${nombre(id)}`}
                          valor={valorDe(clave)}
                          prefijo={unidad === "soles" ? "S/" : undefined}
                          sufijo={unidad === "soles" ? "" : "conf."}
                          regla={reglaDe(clave, metas, iniciales)}
                          editable={editable}
                          onChange={cambiar(clave)}
                        />
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-xs text-pc-text-muted">Sin metas cargadas.</p>
              )}
            </PanelCard>
          );
        })}
      </div>
    </div>
  );
}

const SIN_CONSULTA = {};

export function ConfigMetasView() {
  const { view } = usePanel();
  const metas = usePanelContract("config-metas", SIN_CONSULTA);
  const editable = view.access === "permitido" && view.capabilities.has("editar_configuracion");
  return (
    <ContractView state={metas} label="metas" skeleton="tabla">
      {(data, origin) => (
        <Formulario key={JSON.stringify(data)} metas={data} editable={editable} origin={origin} />
      )}
    </ContractView>
  );
}
