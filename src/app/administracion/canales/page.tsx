"use client";

/**
 * Canales y marketplaces (FEAT-34).
 *
 * - Ventas por canal calculadas en ms-ventas (`porCanal`, por fecha de entrega, una fila por grafía) con las grafías de
 *   un mismo canal agrupadas acá: ya no hay una lista fija de 7 canales (C3). Unidades = Σ quantity de las líneas de
 *   producto, no pedidos (C6).
 * - Comisión = el `channelFee` que quedó guardado en cada pedido. ms-ventas lo calcula al registrar el pedido (y al
 *   editarle las líneas o el canal) con la configuración de abajo: `total × % ÷ 100 + cargo fijo`, solo si la
 *   configuración está activa y su canal es igual al `salesChannel` del pedido sin mirar mayúsculas. El fee de envío
 *   se guarda pero no se usa.
 * - Por eso al guardar se manda la grafía cruda más usada del canal, y se marcan las configuraciones que no coinciden
 *   con ningún pedido (en prod «MERCADO LIBRE» y «SHOPIFY», cuyos pedidos dicen «MERCADOLIBRE» y «WEB»). ms-company no
 *   deja cambiar el canal de una configuración: corregirla es crear la nueva y borrar la vieja. Las grafías salen de
 *   las ventas entregadas de los últimos 90 días (`/administracion/resultados`).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Plus, Trash2, Wand2, X } from "lucide-react";
import { type ReactNode, useId, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  createMarketplaceConfig,
  deleteMarketplaceConfig,
  getMarketplaceConfigs,
  updateMarketplaceConfig,
} from "@/api/Admin";
import { HBarList, type HBarRow } from "@/components/panel-control/charts/HBarList";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAdminPeriod } from "@/contexts/AdminPeriodContext";
import type { ICreateMarketplaceConfigDto, IMarketplaceConfig } from "@/interfaces/IAdmin";
import type { AgregadoCanal } from "@/interfaces/IAdministracion";
import { cn } from "@/lib/utils";
import {
  AdminTable,
  Aviso,
  type ColumnaTabla,
  claseBotonPrimario,
  claseBotonSecundario,
  claseInput,
  Dato,
  formatNumber,
  formatPercent,
  formatSoles,
  formatSolesDecimales,
  KpiCard,
  PanelCard,
  PanelError,
  PanelSkeleton,
  SIN_DATO,
} from "../_components/ui";
import { type CanalEnDatos, claveCanal, type GrupoCanal, grupoCanal, nombreCanal } from "../_lib/canales";
import { sumarDias } from "../_lib/periodo";
import { canalesDelServidor, ventasPorCanalServidor } from "../_lib/servidor";
import {
  type DatosPeriodo,
  useAdminContexto,
  useResultadosPeriodo,
  useVentasServidor,
} from "../_lib/useResultados";

/** Ventana para saber cómo llegan escritos los canales en las ventas. */
const DIAS_CANALES = 90;
const STALE = 5 * 60 * 1000;
const MAX_BARRAS = 7;

const comoError = (error: unknown) => (error instanceof Error ? error : new Error("Error desconocido"));

/** Mensaje del backend (Nest manda `message` como texto o lista) o uno por defecto. */
function mensajeError(error: unknown, porDefecto: string): string {
  const mensaje = (error as { response?: { data?: { message?: unknown } } } | null)?.response?.data?.message;
  const lista = (Array.isArray(mensaje) ? mensaje : [mensaje]).filter(
    (m): m is string => typeof m === "string" && m.trim() !== "",
  );
  return lista.length ? lista.join(" · ") : porDefecto;
}

const aNumero = (texto: string) => Number(texto.trim().replace(",", "."));

/** null = válido. Hasta 2 decimales, como pide ms-company. */
function errorNumero(texto: string, max?: number): string | null {
  const limpio = texto.trim();
  if (!limpio) return "Obligatorio";
  if (!/^\d+(?:[.,]\d{0,2})?$/.test(limpio)) return "Número ≥ 0 con hasta 2 decimales";
  if (max !== undefined && aNumero(limpio) > max) return `Máximo ${max}`;
  return null;
}

// ---- Ventas por canal -----------------------------------------------------------------------

interface FilaCanal {
  clave: string;
  nombre: string;
  grupo: GrupoCanal;
  pedidos: number;
  unidades: number;
  ventas: number;
  comision: number;
  neto: number;
  participacion: number | null;
}

function filasDeCanales(porCanal: AgregadoCanal[]): FilaCanal[] {
  const grupos = ventasPorCanalServidor(porCanal);
  const total = [...grupos.values()].reduce((s, r) => s + r.monto, 0);
  return [...grupos.entries()]
    .map(([clave, r]) => ({
      clave,
      nombre: nombreCanal(clave),
      grupo: grupoCanal(clave),
      pedidos: r.pedidos,
      unidades: r.unidades,
      ventas: r.monto,
      comision: r.comisiones,
      neto: r.monto - r.comisiones,
      participacion: total > 0 ? r.monto / total : null,
    }))
    .sort((a, b) => b.ventas - a.ventas || a.nombre.localeCompare(b.nombre));
}

function PildoraGrupo({ grupo }: { grupo: GrupoCanal }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
        grupo === "marketplace" ? "bg-pc-info-soft text-pc-info" : "bg-pc-surface-muted text-pc-text-muted",
      )}
    >
      {grupo === "marketplace" ? "Marketplace" : "Directo"}
    </span>
  );
}

const COLUMNAS_CANAL: ColumnaTabla<FilaCanal>[] = [
  { id: "canal", header: "Canal", align: "left", cell: (f) => f.nombre, sortValue: (f) => f.nombre },
  { id: "grupo", header: "Tipo", align: "left", cell: (f) => <PildoraGrupo grupo={f.grupo} />, sortValue: (f) => f.grupo },
  { id: "pedidos", header: "Pedidos", cell: (f) => formatNumber(f.pedidos), sortValue: (f) => f.pedidos },
  { id: "unidades", header: "Unidades", cell: (f) => formatNumber(f.unidades), sortValue: (f) => f.unidades },
  { id: "ventas", header: "Ventas", cell: (f) => formatSoles(f.ventas), sortValue: (f) => f.ventas },
  {
    id: "comision",
    header: "Comisión",
    cell: (f) =>
      f.comision > 0 ? (
        <>
          {formatSoles(f.comision)}
          <small className="ml-1 text-pc-text-muted">{formatPercent(f.ventas ? f.comision / f.ventas : null, 1)}</small>
        </>
      ) : (
        <span className="text-pc-text-muted">{formatSoles(0)}</span>
      ),
    sortValue: (f) => f.comision,
  },
  {
    id: "neto",
    header: "Neto",
    cell: (f) => <span className="font-semibold">{formatSoles(f.neto)}</span>,
    sortValue: (f) => f.neto,
  },
  {
    id: "participacion",
    header: "% del total",
    cell: (f) => formatPercent(f.participacion, 1),
    sortValue: (f) => f.participacion,
  },
];

function VentasPorCanal({ datos, onRetry }: { datos: DatosPeriodo; onRetry: () => void }) {
  const filas = useMemo(() => filasDeCanales(datos.servidor.porCanal), [datos.servidor.porCanal]);

  if (datos.cargando) {
    return (
      <>
        <PanelSkeleton variant="kpis" label="ventas por canal" />
        <PanelSkeleton variant="tabla" label="tabla de canales" />
      </>
    );
  }
  if (datos.error) return <PanelError error={comoError(datos.error)} onRetry={onRetry} />;

  const total = datos.ventas;
  const marketplaces = filas.filter((f) => f.grupo === "marketplace");
  const directos = filas.filter((f) => f.grupo === "directo");
  const sumar = (lista: FilaCanal[], campo: "ventas" | "comision") => lista.reduce((s, f) => s + f[campo], 0);
  const ventasMkt = sumar(marketplaces, "ventas");
  const comisionMkt = sumar(marketplaces, "comision");
  const ventasDirecto = sumar(directos, "ventas");
  const comisionDirecto = sumar(directos, "comision");
  const parte = (valor: number) => (total.monto > 0 ? valor / total.monto : null);

  const barras: HBarRow[] = filas.slice(0, MAX_BARRAS).map((f, i) => ({
    key: f.clave,
    label: f.nombre,
    value: f.ventas,
    dotColor: `var(--pc-series-${i + 1})`,
    barColor: `var(--pc-series-${i + 1})`,
  }));
  const resto = filas.slice(MAX_BARRAS);
  if (resto.length) {
    barras.push({
      key: "__otros",
      label: `Otros (${resto.length})`,
      value: sumar(resto, "ventas"),
      dotColor: "var(--pc-series-8)",
      barColor: "var(--pc-series-8)",
    });
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Ventas"
          value={formatSoles(total.monto)}
          sub={`${formatNumber(total.pedidos)} pedidos · ${formatNumber(total.unidades)} unidades`}
        />
        <KpiCard
          label="Comisiones de canal"
          value={formatSoles(total.comisiones)}
          sub={`${formatPercent(parte(total.comisiones), 1)} de las ventas`}
        />
        <KpiCard label="Neto de comisiones" value={formatSoles(total.monto - total.comisiones)} sub="Ventas − comisiones" />
        <KpiCard
          label="Canales con ventas"
          value={formatNumber(filas.length)}
          sub={`${formatNumber(marketplaces.length)} ${marketplaces.length === 1 ? "marketplace" : "marketplaces"}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[3fr_2fr]">
        <PanelCard titulo="Participación en las ventas" subtitulo="Ventas entregadas de cada canal">
          <HBarList
            rows={barras}
            total={total.monto}
            formatValue={formatSoles}
            ariaLabel="Participación de cada canal en las ventas"
          />
        </PanelCard>
        <PanelCard titulo="Directo y marketplaces" subtitulo="Lo que se vende en canales propios y lo que pasa por un marketplace">
          <dl className="grid grid-cols-2 gap-3">
            <Dato
              label="Canales directos"
              valor={formatSoles(ventasDirecto)}
              sub={`${formatPercent(parte(ventasDirecto))} de las ventas · comisión ${formatSoles(comisionDirecto)}`}
            />
            <Dato
              label="Marketplaces"
              valor={formatSoles(ventasMkt)}
              sub={`${formatPercent(parte(ventasMkt))} de las ventas · comisión ${formatPercent(
                ventasMkt > 0 ? comisionMkt / ventasMkt : null,
                1,
              )}`}
            />
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-pc-text-muted">
            La comisión es la que quedó guardada en cada pedido al registrarlo. Si cambias una configuración abajo, los
            pedidos ya registrados no cambian.
          </p>
        </PanelCard>
      </div>

      <PanelCard
        titulo="Ventas por canal"
        subtitulo="Unidades = productos vendidos (sin servicios). Neto = ventas − comisión del canal"
      >
        <AdminTable
          caption="Ventas, unidades, comisión y neto por canal"
          columns={COLUMNAS_CANAL}
          rows={filas}
          getRowKey={(f) => f.clave}
          emptyMessage="No hay ventas entregadas en este periodo"
          footer={{
            canal: "Total",
            pedidos: formatNumber(total.pedidos),
            unidades: formatNumber(total.unidades),
            ventas: formatSoles(total.monto),
            comision: formatSoles(total.comisiones),
            neto: formatSoles(total.monto - total.comisiones),
            participacion: total.monto > 0 ? formatPercent(1, 1) : SIN_DATO,
          }}
        />
      </PanelCard>
    </>
  );
}

// ---- Configuración de comisiones ------------------------------------------------------------

/** Pedidos por grafía (en mayúsculas, como compara ms-ventas). */
function contarGrafias(porCanal: readonly { canal: string | null; pedidos: number }[]): Map<string, number> {
  const conteo = new Map<string, number>();
  for (const fila of porCanal) {
    const grafia = (fila.canal ?? "").trim().toUpperCase();
    if (grafia) conteo.set(grafia, (conteo.get(grafia) ?? 0) + fila.pedidos);
  }
  return conteo;
}

type RevisionGrafia =
  | { tipo: "ok"; pedidos: number }
  | { tipo: "parcial"; pedidos: number; delCanal: number; otras: string[] }
  | { tipo: "no_coincide"; sugerida: string }
  | { tipo: "sin_pedidos" };

/** ¿La configuración coincide con cómo llegan escritos los pedidos de su canal? */
function revisarGrafia(
  config: IMarketplaceConfig,
  canales: CanalEnDatos[],
  conteo: Map<string, number>,
): RevisionGrafia {
  const canal = canales.find((c) => c.clave === claveCanal(config.channel));
  if (!canal) return { tipo: "sin_pedidos" };
  const propia = config.channel.trim().toUpperCase();
  const pedidos = conteo.get(propia) ?? 0;
  if (pedidos === 0) return { tipo: "no_coincide", sugerida: canal.grafias[0] };
  if (pedidos < canal.pedidos) {
    const otras = canal.grafias.filter((g) => g.toUpperCase() !== propia);
    return { tipo: "parcial", pedidos, delCanal: canal.pedidos, otras: [...new Set(otras)] };
  }
  return { tipo: "ok", pedidos };
}

const comillas = (texto: string) => `«${texto}»`;

function CampoNumero({
  etiqueta,
  valor,
  onChange,
  max,
}: {
  etiqueta: string;
  valor: string;
  onChange: (valor: string) => void;
  max?: number;
}) {
  const id = useId();
  // Vacío no se marca (el botón queda deshabilitado); sí lo mal escrito.
  const error = valor.trim() === "" ? null : errorNumero(valor, max);
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-[0.06em] text-pc-text-muted">
        {etiqueta}
      </label>
      <input
        id={id}
        inputMode="decimal"
        value={valor}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(claseInput, "w-full text-right tabular-nums aria-invalid:border-pc-bad")}
      />
      {error && (
        <span id={`${id}-error`} className="text-[11px] text-pc-bad">
          {error}
        </span>
      )}
    </div>
  );
}

interface ValoresConfig {
  pct: string;
  fijo: string;
  envio: string;
}

const valoresValidos = (v: ValoresConfig) =>
  errorNumero(v.pct, 100) === null && errorNumero(v.fijo) === null && errorNumero(v.envio) === null;

const cuerpoDe = (v: ValoresConfig) => ({
  commissionPct: aNumero(v.pct),
  fixedCharge: aNumero(v.fijo),
  shippingFee: aNumero(v.envio),
});

/** Ejemplo en soles para un pedido de S/ 100. */
function EjemploComision({ valores }: { valores: ValoresConfig }) {
  if (errorNumero(valores.pct, 100) !== null || errorNumero(valores.fijo) !== null) return null;
  const comision = (100 * aNumero(valores.pct)) / 100 + aNumero(valores.fijo);
  return (
    <p className="text-[11px] text-pc-text-muted">
      En un pedido de S/ 100 se descontarían {formatSolesDecimales(comision)}.
    </p>
  );
}

function CamposConfig({ valores, onChange }: { valores: ValoresConfig; onChange: (v: ValoresConfig) => void }) {
  return (
    <>
      <CampoNumero etiqueta="Comisión (%)" valor={valores.pct} max={100} onChange={(pct) => onChange({ ...valores, pct })} />
      <CampoNumero etiqueta="Cargo fijo (S/)" valor={valores.fijo} onChange={(fijo) => onChange({ ...valores, fijo })} />
      <CampoNumero
        etiqueta="Fee de envío (S/)"
        valor={valores.envio}
        onChange={(envio) => onChange({ ...valores, envio })}
      />
    </>
  );
}

function PildoraEstado({ activa }: { activa: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
        activa ? "bg-pc-ok-soft text-pc-ok" : "bg-pc-surface-muted text-pc-text-muted",
      )}
    >
      {activa ? "Activa" : "Pausada"}
    </span>
  );
}

function ValorConfig({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 text-right">
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-pc-text-muted">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums text-pc-text">{children}</dd>
    </div>
  );
}

function ConfiguracionComisiones() {
  const { companyId, token, hoy } = useAdminContexto();
  const qc = useQueryClient();
  const recientesQ = useVentasServidor(sumarDias(hoy, -(DIAS_CANALES - 1)), hoy);
  const configsQ = useQuery({
    queryKey: ["admin-marketplace-config", companyId],
    queryFn: () => getMarketplaceConfigs(companyId, token),
    enabled: !!companyId && !!token,
    staleTime: STALE,
  });

  const porCanal = recientesQ.data?.porCanal;
  const canales = useMemo(
    () => canalesDelServidor(porCanal ?? []).filter((c) => c.clave !== "SIN_CANAL" && c.grafias.length > 0),
    [porCanal],
  );
  const conteo = useMemo(() => contarGrafias(porCanal ?? []), [porCanal]);
  const configs = useMemo(() => configsQ.data ?? [], [configsQ.data]);
  const clavesConfiguradas = useMemo(() => new Set(configs.map((c) => claveCanal(c.channel))), [configs]);
  const grafiasConfiguradas = useMemo(
    () => new Set(configs.map((c) => c.channel.trim().toUpperCase())),
    [configs],
  );

  const [nuevo, setNuevo] = useState<(ValoresConfig & { clave: string }) | null>(null);
  const [edicion, setEdicion] = useState<(ValoresConfig & { id: string; activa: boolean }) | null>(null);
  const [aBorrar, setABorrar] = useState<IMarketplaceConfig | null>(null);
  const [aCorregir, setACorregir] = useState<{ config: IMarketplaceConfig; grafia: string } | null>(null);
  const selectorId = useId();

  const invalidar = () => qc.invalidateQueries({ queryKey: ["admin-marketplace-config", companyId] });

  const crear = useMutation({
    mutationFn: (dto: ICreateMarketplaceConfigDto) => createMarketplaceConfig(companyId, dto, token),
    onSuccess: () => {
      toast.success("Comisión guardada");
      setNuevo(null);
      void invalidar();
    },
    onError: (error) => toast.error(mensajeError(error, "No se pudo guardar la comisión")),
  });
  const actualizar = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Partial<ICreateMarketplaceConfigDto> }) =>
      updateMarketplaceConfig(companyId, id, dto, token),
    onSuccess: () => {
      toast.success("Comisión actualizada");
      setEdicion(null);
      void invalidar();
    },
    onError: (error) => toast.error(mensajeError(error, "No se pudo actualizar la comisión")),
  });
  const borrar = useMutation({
    mutationFn: (id: string) => deleteMarketplaceConfig(companyId, id, token),
    onSuccess: () => {
      toast.success("Comisión eliminada");
      void invalidar();
    },
    onError: (error) => toast.error(mensajeError(error, "No se pudo eliminar la comisión")),
  });
  // ms-company no deja cambiar el canal: se crea la configuración con la grafía buena y se borra la vieja.
  const corregir = useMutation({
    mutationFn: async ({ config, grafia }: { config: IMarketplaceConfig; grafia: string }) => {
      await createMarketplaceConfig(
        companyId,
        {
          channel: grafia,
          commissionPct: Number(config.commissionPct),
          fixedCharge: Number(config.fixedCharge),
          shippingFee: Number(config.shippingFee),
          isActive: config.isActive,
        },
        token,
      );
      await deleteMarketplaceConfig(companyId, config.id, token);
    },
    onSuccess: (_, { grafia }) => toast.success(`Comisión guardada como ${comillas(grafia)}`),
    onError: (error) => toast.error(mensajeError(error, "No se pudo corregir la comisión")),
    onSettled: () => void invalidar(),
  });

  const canalNuevo = nuevo ? canales.find((c) => c.clave === nuevo.clave) : undefined;
  const marketplacesSinConfig = canales.filter((c) => c.grupo === "marketplace" && !clavesConfiguradas.has(c.clave));
  const ocupado = crear.isPending || actualizar.isPending || borrar.isPending || corregir.isPending;

  const guardarNuevo = () => {
    if (!nuevo || !canalNuevo || !valoresValidos(nuevo)) return;
    crear.mutate({ channel: canalNuevo.grafias[0], ...cuerpoDe(nuevo), isActive: true });
  };

  const guardarEdicion = () => {
    if (!edicion || !valoresValidos(edicion)) return;
    actualizar.mutate({ id: edicion.id, dto: { ...cuerpoDe(edicion), isActive: edicion.activa } });
  };

  const renderRevision = (config: IMarketplaceConfig) => {
    if (!porCanal) return null;
    const revision = revisarGrafia(config, canales, conteo);
    switch (revision.tipo) {
      case "ok":
        return (
          <p className="mt-1.5 text-[11px] text-pc-ok">
            Coincide con {formatNumber(revision.pedidos)}{" "}
            {revision.pedidos === 1 ? "venta entregada" : "ventas entregadas"} en los últimos {DIAS_CANALES} días.
          </p>
        );
      case "parcial":
        return (
          <Aviso tono="info" className="mt-2">
            Solo se aplica a los pedidos que dicen {comillas(config.channel)} ({formatNumber(revision.pedidos)} de{" "}
            {formatNumber(revision.delCanal)}). Los que llegan como {revision.otras.map(comillas).join(", ")} no pagan
            esta comisión.
          </Aviso>
        );
      case "no_coincide": {
        const yaExiste = grafiasConfiguradas.has(revision.sugerida.toUpperCase());
        return (
          <Aviso tono="warn" className="mt-2" titulo="No coincide con ningún pedido">
            <p>
              Los pedidos de {nombreCanal(claveCanal(config.channel))} dicen {comillas(revision.sugerida)}, no{" "}
              {comillas(config.channel)}: esta comisión nunca se aplica. Grafía sugerida: {comillas(revision.sugerida)}.
            </p>
            {yaExiste ? (
              <p className="mt-1">Ya hay otra comisión guardada como {comillas(revision.sugerida)}: puedes eliminar esta.</p>
            ) : (
              <button
                type="button"
                className={cn(claseBotonSecundario, "mt-1.5")}
                disabled={ocupado}
                onClick={() => setACorregir({ config, grafia: revision.sugerida })}
              >
                <Wand2 className="h-3.5 w-3.5" aria-hidden />
                Guardar como {comillas(revision.sugerida)}
              </button>
            )}
          </Aviso>
        );
      }
      case "sin_pedidos":
        return (
          <p className="mt-1.5 text-[11px] text-pc-text-muted">
            Sin ventas entregadas de este canal en los últimos {DIAS_CANALES} días: no se puede comprobar si coincide.
          </p>
        );
    }
  };

  return (
    <PanelCard
      titulo="Comisiones por canal"
      subtitulo="Se descuentan de cada pedido nuevo de ese canal: total × % + cargo fijo"
      acciones={
        !nuevo && (
          <button
            type="button"
            className={claseBotonPrimario}
            disabled={!configsQ.isSuccess}
            onClick={() => setNuevo({ clave: "", pct: "", fijo: "0", envio: "0" })}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Agregar comisión
          </button>
        )
      }
    >
      <div className="space-y-3">
        <Aviso tono="info">
          La comisión se calcula cuando se registra el pedido: cambiarla no corrige los pedidos ya creados. El fee de envío
          queda guardado, pero hoy no se descuenta de los pedidos.
        </Aviso>

        {nuevo && (
          <div className="space-y-2 rounded-xl border border-pc-border-soft bg-pc-surface-muted p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="flex min-w-0 flex-col gap-1 lg:col-span-2">
                <label
                  htmlFor={selectorId}
                  className="text-[11px] font-semibold uppercase tracking-[0.06em] text-pc-text-muted"
                >
                  Canal
                </label>
                <select
                  id={selectorId}
                  value={nuevo.clave}
                  onChange={(event) => setNuevo({ ...nuevo, clave: event.target.value })}
                  className={cn(claseInput, "w-full")}
                  disabled={recientesQ.isLoading}
                >
                  <option value="">{recientesQ.isLoading ? "Cargando canales…" : "Elige un canal"}</option>
                  {canales.map((canal) => {
                    const configurado = clavesConfiguradas.has(canal.clave);
                    return (
                      <option key={canal.clave} value={canal.clave} disabled={configurado}>
                        {`${canal.nombre} · ${formatNumber(canal.pedidos)} ventas${configurado ? " (ya tiene comisión)" : ""}`}
                      </option>
                    );
                  })}
                </select>
              </div>
              <CamposConfig valores={nuevo} onChange={(v) => setNuevo({ ...nuevo, ...v })} />
            </div>
            {recientesQ.isError && (
              <p className="text-[11px] text-pc-bad">
                No se pudieron leer los canales de tus ventas. Reintenta más tarde.
              </p>
            )}
            {canalNuevo && (
              <p className="text-[11px] text-pc-text-muted">
                Se guarda como {comillas(canalNuevo.grafias[0])}, igual que en tus pedidos.
                {canalNuevo.grafias.length > 1 &&
                  ` Los que llegan como ${canalNuevo.grafias.slice(1).map(comillas).join(", ")} no la pagan.`}
              </p>
            )}
            <EjemploComision valores={nuevo} />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={claseBotonPrimario}
                disabled={!canalNuevo || !valoresValidos(nuevo) || crear.isPending}
                onClick={guardarNuevo}
              >
                <Check className="h-3.5 w-3.5" aria-hidden />
                {crear.isPending ? "Guardando…" : "Guardar comisión"}
              </button>
              <button type="button" className={claseBotonSecundario} onClick={() => setNuevo(null)}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {marketplacesSinConfig.length > 0 && !nuevo && (
          <p className="text-xs text-pc-text-muted">
            Hay ventas de {marketplacesSinConfig.map((c) => c.nombre).join(", ")} sin comisión configurada.
          </p>
        )}

        {configsQ.isLoading ? (
          <PanelSkeleton variant="tabla" label="comisiones configuradas" />
        ) : configsQ.isError ? (
          <PanelError error={comoError(configsQ.error)} onRetry={() => void configsQ.refetch()} />
        ) : configs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-pc-border bg-pc-surface-muted p-4 text-center text-xs text-pc-text-muted">
            Todavía no hay comisiones configuradas. Agrega las de tus marketplaces para que se descuenten de los pedidos
            nuevos.
          </p>
        ) : (
          <ul aria-label="Comisiones configuradas" className="divide-y divide-pc-border-soft">
            {configs.map((config) => {
              const editando = edicion?.id === config.id;
              return (
                <li key={config.id} className="py-3">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-[10rem] flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-pc-text">
                        {nombreCanal(claveCanal(config.channel))}
                        <PildoraEstado activa={config.isActive} />
                      </p>
                      <p className="text-[11px] text-pc-text-muted">Guardada como {comillas(config.channel)}</p>
                    </div>
                    {editando && edicion ? (
                      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3 lg:w-auto lg:min-w-[26rem]">
                        <CamposConfig valores={edicion} onChange={(v) => setEdicion({ ...edicion, ...v })} />
                        <label className="flex items-center gap-2 text-xs text-pc-text sm:col-span-3">
                          <input
                            type="checkbox"
                            checked={edicion.activa}
                            onChange={(event) => setEdicion({ ...edicion, activa: event.target.checked })}
                            className="h-4 w-4 accent-[var(--pc-primary)]"
                          />
                          Activa (si la pausas, los pedidos nuevos no pagan esta comisión)
                        </label>
                        <div className="flex flex-wrap gap-2 sm:col-span-3">
                          <button
                            type="button"
                            className={claseBotonPrimario}
                            disabled={!valoresValidos(edicion) || actualizar.isPending}
                            onClick={guardarEdicion}
                          >
                            <Check className="h-3.5 w-3.5" aria-hidden />
                            {actualizar.isPending ? "Guardando…" : "Guardar"}
                          </button>
                          <button type="button" className={claseBotonSecundario} onClick={() => setEdicion(null)}>
                            <X className="h-3.5 w-3.5" aria-hidden />
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <dl className="grid grid-cols-3 gap-4">
                          <ValorConfig label="Comisión">{formatPercent(Number(config.commissionPct) / 100, 1)}</ValorConfig>
                          <ValorConfig label="Cargo fijo">{formatSolesDecimales(Number(config.fixedCharge))}</ValorConfig>
                          <ValorConfig label="Fee envío">{formatSolesDecimales(Number(config.shippingFee))}</ValorConfig>
                        </dl>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            aria-label={`Editar comisión de ${config.channel}`}
                            className={claseBotonSecundario}
                            disabled={ocupado}
                            onClick={() =>
                              setEdicion({
                                id: config.id,
                                pct: String(Number(config.commissionPct)),
                                fijo: String(Number(config.fixedCharge)),
                                envio: String(Number(config.shippingFee)),
                                activa: config.isActive,
                              })
                            }
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                          </button>
                          <button
                            type="button"
                            aria-label={`Eliminar comisión de ${config.channel}`}
                            className={cn(claseBotonSecundario, "hover:border-pc-bad hover:text-pc-bad")}
                            disabled={ocupado}
                            onClick={() => setABorrar(config)}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  {!config.isActive && (
                    <p className="mt-1.5 text-[11px] text-pc-text-muted">Pausada: los pedidos nuevos no la pagan.</p>
                  )}
                  {renderRevision(config)}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <AlertDialog open={!!aBorrar} onOpenChange={(abierto) => !abierto && setABorrar(null)}>
        <AlertDialogContent className="border-pc-border bg-pc-card text-pc-text">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">¿Eliminar la comisión de {aBorrar?.channel}?</AlertDialogTitle>
            <AlertDialogDescription className="text-pc-text-muted">
              Los pedidos nuevos de este canal dejan de pagar comisión. Los ya registrados no cambian.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={claseBotonSecundario}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-pc-bad text-pc-on-fill hover:bg-pc-bad/90"
              onClick={() => aBorrar && borrar.mutate(aBorrar.id)}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!aCorregir} onOpenChange={(abierto) => !abierto && setACorregir(null)}>
        <AlertDialogContent className="border-pc-border bg-pc-card text-pc-text">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">
              ¿Guardar como {aCorregir ? comillas(aCorregir.grafia) : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-pc-text-muted">
              Se crea la comisión con la misma tasa y el canal escrito como en tus pedidos, y se borra la de{" "}
              {aCorregir ? comillas(aCorregir.config.channel) : ""}. Se aplica a los pedidos que se registren desde ahora.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={claseBotonSecundario}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-pc-primary text-pc-on-fill hover:bg-pc-primary-strong"
              onClick={() => aCorregir && corregir.mutate(aCorregir)}
            >
              Guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PanelCard>
  );
}

export default function CanalesPage() {
  const { fromDate, toDate } = useAdminPeriod();
  const datos = useResultadosPeriodo(fromDate, toDate);
  const qc = useQueryClient();
  const reintentar = () => {
    void qc.invalidateQueries({ queryKey: ["admin-resultados"] });
  };
  return (
    <div className="space-y-3.5">
      <VentasPorCanal datos={datos} onRetry={reintentar} />
      <ConfiguracionComisiones />
    </div>
  );
}
