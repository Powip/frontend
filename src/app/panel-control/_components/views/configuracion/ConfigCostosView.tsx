"use client";

import { Plus, RotateCcw, Save } from "lucide-react";
import { type ReactNode, useId, useMemo, useState } from "react";
import { ContractView } from "@/components/panel-control/ContractView";
import { PanelCard } from "@/components/panel-control/PanelCard";
import { Button } from "@/components/ui/button";
import {
  putConfigComisiones,
  putConfigCouriers,
  putConfigGastosFijos,
} from "@/features/panel-control/configuracion/api/config.api";
import {
  claveCourier,
  claveRegla,
  cuerpoDeComisiones,
  cuerpoDeCouriers,
  cuerpoDeGastos,
  type Valores,
  valoresDeComisiones,
  valoresDeCouriers,
  valoresDeGastos,
} from "@/features/panel-control/configuracion/api/config-cuerpos";
import type {
  ConfigComisiones,
  ConfigCouriers,
  ConfigGastosFijos,
  RolComision,
} from "@/features/panel-control/configuracion/models/configuracion.model";
import { usePanelContract } from "@/features/panel-control/shared/hooks/use-panel-contract";
import type { DataOrigin } from "@/features/panel-control/shared/models/data-origin.model";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import {
  CampoNumero,
  ErroresDelServidor,
  errorNumero,
  type ReglaNumero,
  useGuardarConfig,
} from "./config-form";

const SIN_CONSULTA = {};

interface CampoDef {
  clave: string;
  etiqueta: string;
  prefijo?: string;
  sufijo?: string;
  regla: ReglaNumero;
}

/** Barra de acciones común: Restablecer / Guardar (n) sobre un conjunto de campos. */
function Acciones({
  cambios,
  errores,
  guardando,
  editable,
  onRestablecer,
  onGuardar,
}: {
  cambios: number;
  errores: number;
  guardando: boolean;
  editable: boolean;
  onRestablecer: () => void;
  onGuardar: () => void;
}) {
  if (!editable) return null;
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!cambios || guardando}
        onClick={onRestablecer}
      >
        <RotateCcw aria-hidden />
        Restablecer
      </Button>
      <Button
        type="button"
        size="sm"
        disabled={!cambios || errores > 0 || guardando}
        onClick={onGuardar}
        className="bg-pc-primary text-white hover:bg-pc-primary-strong"
      >
        <Save aria-hidden />
        {guardando ? "Guardando…" : `Guardar ${cambios ? `(${cambios})` : ""}`}
      </Button>
    </>
  );
}

function FilaCampo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-2 py-1.5 text-xs">
      <span className="min-w-0 font-medium">{etiqueta}</span>
      {children}
    </li>
  );
}

// ---- Comisiones --------------------------------------------------------------------------

const CAMPOS_COMISION: (CampoDef & { rol: RolComision; titulo: string })[] = [
  {
    rol: "confirmadora",
    titulo: "Confirmadoras",
    clave: claveRegla("confirmadora", "por_entrega"),
    etiqueta: "Pago por pedido entregado",
    prefijo: "S/",
    regla: { opcional: true },
  },
  {
    rol: "confirmadora",
    titulo: "Confirmadoras",
    clave: claveRegla("confirmadora", "pct_upsell"),
    etiqueta: "Comisión por upsell",
    sufijo: "%",
    regla: { max: 100, opcional: true },
  },
  {
    rol: "vendedora",
    titulo: "Vendedoras",
    clave: claveRegla("vendedora", "pct_pagado"),
    etiqueta: "Comisión sobre lo pagado",
    sufijo: "%",
    regla: { max: 100, opcional: true },
  },
  {
    rol: "vendedora",
    titulo: "Vendedoras",
    clave: claveRegla("vendedora", "pct_upsell"),
    etiqueta: "Comisión por upsell",
    sufijo: "%",
    regla: { max: 100, opcional: true },
  },
];

function FormularioComisiones({
  config,
  editable,
  origin,
}: {
  config: ConfigComisiones;
  editable: boolean;
  origin: DataOrigin;
}) {
  const iniciales = useMemo(() => valoresDeComisiones(config.reglas), [config]);
  const [valores, setValores] = useState<Valores>(iniciales);
  const {
    guardar,
    guardando,
    errores: delServidor,
  } = useGuardarConfig(putConfigComisiones, "Comisiones");
  const valorDe = (clave: string) => valores[clave] ?? iniciales[clave] ?? "";
  // Un valor ya cargado no se puede dejar vacío (el backend no borra reglas).
  const reglaDe = (campo: CampoDef) => ({
    ...campo.regla,
    opcional: !(campo.clave in iniciales),
  });
  const cambios = CAMPOS_COMISION.filter(
    (c) => valorDe(c.clave) !== (iniciales[c.clave] ?? "") && valorDe(c.clave).trim() !== "",
  ).length;
  const errores = CAMPOS_COMISION.filter((c) => errorNumero(valorDe(c.clave), reglaDe(c))).length;

  return (
    <PanelCard
      titulo="Comisiones del equipo"
      subtitulo="Estimación que ve el Dueño en Equipo. La vendedora no ve su comisión. Los porcentajes van de 0 a 100"
      origin={origin}
      acciones={
        <Acciones
          editable={editable}
          cambios={cambios}
          errores={errores}
          guardando={guardando}
          onRestablecer={() => setValores(iniciales)}
          onGuardar={() => guardar(cuerpoDeComisiones(valores, iniciales))}
        />
      }
    >
      <div className="space-y-3">
        <ErroresDelServidor errores={delServidor} />
        {(["confirmadora", "vendedora"] as const).map((rol) => (
          <section key={rol} aria-label={rol === "confirmadora" ? "Confirmadoras" : "Vendedoras"}>
            <h4 className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-pc-text-muted">
              {rol === "confirmadora" ? "Confirmadoras" : "Vendedoras"}
            </h4>
            <ul className="divide-y divide-pc-border-soft">
              {CAMPOS_COMISION.filter((c) => c.rol === rol).map((campo) => (
                <FilaCampo key={campo.clave} etiqueta={campo.etiqueta}>
                  <CampoNumero
                    etiqueta={`${campo.etiqueta} (${campo.titulo})`}
                    valor={valorDe(campo.clave)}
                    prefijo={campo.prefijo}
                    sufijo={campo.sufijo ?? ""}
                    regla={reglaDe(campo)}
                    editable={editable}
                    onChange={(valor) => setValores((a) => ({ ...a, [campo.clave]: valor }))}
                  />
                </FilaCampo>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </PanelCard>
  );
}

// ---- Gastos fijos ------------------------------------------------------------------------

function FormularioGastos({
  config,
  editable,
  origin,
}: {
  config: ConfigGastosFijos;
  editable: boolean;
  origin: DataOrigin;
}) {
  const { session } = usePanel();
  const iniciales = useMemo(() => valoresDeGastos(config.gastos), [config]);
  const [valores, setValores] = useState<Valores>(iniciales);
  const {
    guardar,
    guardando,
    errores: delServidor,
  } = useGuardarConfig(putConfigGastosFijos, "Gastos fijos");
  const valorDe = (clave: string) => valores[clave] ?? iniciales[clave] ?? "";
  const regla = (clave: string): ReglaNumero => ({ opcional: !(clave in iniciales) });
  const tiendas = session.tiendas;
  const cambios = tiendas.filter(
    (t) => valorDe(t.id) !== (iniciales[t.id] ?? "") && valorDe(t.id).trim() !== "",
  ).length;
  const errores = tiendas.filter((t) => errorNumero(valorDe(t.id), regla(t.id))).length;

  return (
    <PanelCard
      titulo="Gastos fijos por tienda"
      subtitulo="Monto mensual en soles; Finanzas lo prorratea por los días del periodo. Vacío = sin gasto cargado"
      origin={origin}
      acciones={
        <Acciones
          editable={editable}
          cambios={cambios}
          errores={errores}
          guardando={guardando}
          onRestablecer={() => setValores(iniciales)}
          onGuardar={() => guardar(cuerpoDeGastos(valores, iniciales))}
        />
      }
    >
      <div className="space-y-3">
        <ErroresDelServidor errores={delServidor} />
        {tiendas.length ? (
          <ul className="divide-y divide-pc-border-soft">
            {tiendas.map((tienda) => (
              <FilaCampo key={tienda.id} etiqueta={tienda.nombre}>
                <CampoNumero
                  etiqueta={`Gasto fijo mensual de ${tienda.nombre}`}
                  valor={valorDe(tienda.id)}
                  prefijo="S/"
                  sufijo="/mes"
                  regla={regla(tienda.id)}
                  editable={editable}
                  onChange={(valor) => setValores((a) => ({ ...a, [tienda.id]: valor }))}
                />
              </FilaCampo>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-pc-text-muted">La empresa no tiene tiendas.</p>
        )}
      </div>
    </PanelCard>
  );
}

// ---- Couriers ----------------------------------------------------------------------------

interface NuevoCourier {
  key: string;
}

function CampoTexto({
  etiqueta,
  valor,
  onChange,
}: {
  etiqueta: string;
  valor: string;
  onChange: (valor: string) => void;
}) {
  const id = useId();
  return (
    <>
      <label htmlFor={id} className="sr-only">
        {etiqueta}
      </label>
      <input
        id={id}
        value={valor}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-40 rounded-md border border-pc-border bg-pc-card px-2 text-xs text-pc-text outline-none focus-visible:ring-2 focus-visible:ring-pc-primary"
      />
    </>
  );
}

function FormularioCouriers({
  config,
  editable,
  origin,
}: {
  config: ConfigCouriers;
  editable: boolean;
  origin: DataOrigin;
}) {
  const iniciales = useMemo(() => valoresDeCouriers(config.couriers), [config]);
  const [valores, setValores] = useState<Valores>(iniciales);
  const [nuevos, setNuevos] = useState<NuevoCourier[]>([]);
  const [claveNueva, setClaveNueva] = useState("");
  const {
    guardar,
    guardando,
    errores: delServidor,
  } = useGuardarConfig(putConfigCouriers, "Couriers");
  const valorDe = (clave: string) => valores[clave] ?? iniciales[clave] ?? "";
  const claves = [...config.couriers.map((c) => c.key), ...nuevos.map((n) => n.key)];
  const reglaPlazo: ReglaNumero = { entero: true, max: 3650, opcional: true };
  const reglaTiempo: ReglaNumero = { entero: true, min: 1, max: 3650, opcional: true };

  const camposDe = (key: string) => [
    claveCourier(key, "nombre"),
    claveCourier(key, "plazo"),
    claveCourier(key, "tiempo"),
  ];
  const cambios = claves
    .flatMap(camposDe)
    .filter((c) => valorDe(c) !== (iniciales[c] ?? "")).length;
  const errores = claves.filter(
    (key) =>
      errorNumero(valorDe(claveCourier(key, "plazo")), reglaPlazo) ||
      errorNumero(valorDe(claveCourier(key, "tiempo")), reglaTiempo) ||
      (nuevos.some((n) => n.key === key) && valorDe(claveCourier(key, "nombre")).trim() === ""),
  ).length;

  const agregar = () => {
    const key = claveNueva.trim();
    if (!key || claves.includes(key)) return;
    setNuevos((actual) => [...actual, { key }]);
    setClaveNueva("");
  };

  return (
    <PanelCard
      titulo="Plazos de courier"
      subtitulo="Días hasta que el courier liquida y días normales de entrega. Vacío en un courier cargado lo borra"
      origin={origin}
      acciones={
        <Acciones
          editable={editable}
          cambios={cambios}
          errores={errores}
          guardando={guardando}
          onRestablecer={() => {
            setValores(iniciales);
            setNuevos([]);
          }}
          onGuardar={() => guardar(cuerpoDeCouriers(valores, iniciales, claves))}
        />
      }
    >
      <div className="space-y-3">
        <ErroresDelServidor errores={delServidor} />
        {claves.length ? (
          <div className="overflow-auto rounded-xl border border-pc-border-soft">
            <table className="w-full border-collapse text-[12.5px]">
              <caption className="sr-only">Plazos por courier</caption>
              <thead>
                <tr className="bg-pc-surface-muted text-[11px] uppercase tracking-wide text-pc-text-muted">
                  <th scope="col" className="px-2.5 py-2 text-left font-semibold">
                    Courier
                  </th>
                  <th scope="col" className="px-2.5 py-2 text-right font-semibold">
                    Liquida en
                  </th>
                  <th scope="col" className="px-2.5 py-2 text-right font-semibold">
                    Entrega normal
                  </th>
                </tr>
              </thead>
              <tbody>
                {claves.map((key) => {
                  const esNuevo = nuevos.some((n) => n.key === key);
                  const nombre = valorDe(claveCourier(key, "nombre"));
                  return (
                    <tr key={key} className="border-t border-pc-border-soft">
                      <th scope="row" className="px-2.5 py-1.5 text-left font-medium">
                        {esNuevo ? (
                          <span className="flex items-center gap-1.5">
                            <span className="text-pc-text-muted">{key}</span>
                            <CampoTexto
                              etiqueta={`Nombre del courier ${key}`}
                              valor={nombre}
                              onChange={(valor) =>
                                setValores((a) => ({ ...a, [claveCourier(key, "nombre")]: valor }))
                              }
                            />
                          </span>
                        ) : (
                          nombre
                        )}
                      </th>
                      <td className="px-2.5 py-1.5">
                        <CampoNumero
                          etiqueta={`Días de liquidación de ${nombre || key}`}
                          valor={valorDe(claveCourier(key, "plazo"))}
                          sufijo="días"
                          regla={reglaPlazo}
                          editable={editable}
                          onChange={(valor) =>
                            setValores((a) => ({ ...a, [claveCourier(key, "plazo")]: valor }))
                          }
                        />
                      </td>
                      <td className="px-2.5 py-1.5">
                        <CampoNumero
                          etiqueta={`Días de entrega normal de ${nombre || key}`}
                          valor={valorDe(claveCourier(key, "tiempo"))}
                          sufijo="días"
                          regla={reglaTiempo}
                          editable={editable}
                          onChange={(valor) =>
                            setValores((a) => ({ ...a, [claveCourier(key, "tiempo")]: valor }))
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-pc-text-muted">Todavía no hay couriers configurados.</p>
        )}
        {editable && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <CampoTexto
              etiqueta="Clave del courier nuevo"
              valor={claveNueva}
              onChange={setClaveNueva}
            />
            <Button type="button" variant="outline" size="sm" onClick={agregar}>
              <Plus aria-hidden />
              Agregar courier
            </Button>
            <span className="text-pc-text-muted">
              Usa la misma clave que Operaciones (por ejemplo «olva»).
            </span>
          </div>
        )}
      </div>
    </PanelCard>
  );
}

// ---- Vista -------------------------------------------------------------------------------

export function ConfigCostosView() {
  const { view } = usePanel();
  const editable = view.access === "permitido" && view.capabilities.has("editar_configuracion");
  const comisiones = usePanelContract("config-comisiones", SIN_CONSULTA);
  const gastos = usePanelContract("config-gastos-fijos", SIN_CONSULTA);
  const couriers = usePanelContract("config-couriers", SIN_CONSULTA);
  return (
    <div className="space-y-3.5">
      <ContractView state={comisiones} label="comisiones" skeleton="tabla">
        {(data, origin) => (
          <FormularioComisiones
            key={JSON.stringify(data)}
            config={data}
            editable={editable}
            origin={origin}
          />
        )}
      </ContractView>
      <ContractView state={gastos} label="gastos fijos" skeleton="tabla">
        {(data, origin) => (
          <FormularioGastos
            key={JSON.stringify(data)}
            config={data}
            editable={editable}
            origin={origin}
          />
        )}
      </ContractView>
      <ContractView state={couriers} label="couriers" skeleton="tabla">
        {(data, origin) => (
          <FormularioCouriers
            key={JSON.stringify(data)}
            config={data}
            editable={editable}
            origin={origin}
          />
        )}
      </ContractView>
    </div>
  );
}
