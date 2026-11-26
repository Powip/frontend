"use client";

/**
 * Merma (FEAT-34 M9).
 *
 * - Lista y alta de las mermas de `inventory_shrinkage` (fachada de ms-products). Registrar acá no descuenta stock
 *   (no manda `inventoryItemId`).
 * - Los totales del periodo son los del resumen del backend (Σ cantidad × costo − recuperado), el mismo número que
 *   resta la línea «Merma» del Resumen. Si el resumen no llega, se suman las filas de la lista.
 * - Las mermas que se piden en Almacén van como ajuste de inventario y todavía no llegan a esta tabla (Fase 2).
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { createShrinkage } from "@/api/Admin";
import { useAdminPeriod } from "@/contexts/AdminPeriodContext";
import {
  useAdminShrinkageList,
  useAdminShrinkageSummary,
  useInvalidateAdminQueries,
} from "@/hooks/useAdminQueries";
import type { IInventoryShrinkage } from "@/interfaces/IAdmin";
import { cn } from "@/lib/utils";
import {
  AdminTable,
  Aviso,
  type ColumnaTabla,
  claseBotonPrimario,
  claseBotonSecundario,
  claseInput,
  formatNumber,
  formatSolesDecimales,
  KpiCard,
  PanelCard,
  PanelError,
  PanelSkeleton,
  SIN_DATO,
} from "../_components/ui";
import { diaLima, MESES_CORTOS, partes } from "../_lib/periodo";
import { useAdminContexto } from "../_lib/useResultados";

const TIPOS_MERMA: Record<string, string> = {
  devolucion_irrecuperable: "Devolución irrecuperable",
  "daño_almacen": "Daño en almacén",
  envio_perdido_courier: "Envío perdido (courier)",
  descuento_forzado: "Descuento forzado",
  diferencia_inventario: "Diferencia de inventario",
  otro: "Otro",
};

const MAX_UNIDADES = 10000;
const MAX_NOTAS = 1000;

const comoError = (error: unknown) => (error instanceof Error ? error : new Error("Error desconocido"));

function mensajeError(error: unknown, porDefecto: string): string {
  const mensaje = (error as { response?: { data?: { message?: unknown } } } | null)?.response?.data?.message;
  const lista = (Array.isArray(mensaje) ? mensaje : [mensaje]).filter(
    (m): m is string => typeof m === "string" && m.trim() !== "",
  );
  return lista.length ? lista.join(" · ") : porDefecto;
}

const aNumero = (texto: string) => Number(texto.trim().replace(",", "."));

function errorUnidades(texto: string): string | null {
  const limpio = texto.trim();
  if (!limpio) return "Obligatorio";
  if (!/^\d+$/.test(limpio)) return "Número entero";
  const n = Number(limpio);
  if (n < 1) return "Mínimo 1";
  if (n > MAX_UNIDADES) return `Máximo ${MAX_UNIDADES.toLocaleString("es-PE")}`;
  return null;
}

function errorSoles(texto: string): string | null {
  const limpio = texto.trim();
  if (!limpio) return "Obligatorio";
  if (!/^\d+(?:[.,]\d{0,2})?$/.test(limpio)) return "Número ≥ 0 con hasta 2 decimales";
  return null;
}

const costoBruto = (m: IInventoryShrinkage) => Number(m.quantity) * Number(m.unitCost);
const perdidaNeta = (m: IInventoryShrinkage) => costoBruto(m) - Number(m.recoveredAmount || 0);

function fechaCorta(instante: string): string {
  const dia = diaLima(instante);
  if (!dia) return SIN_DATO;
  const [anio, mes, d] = partes(dia);
  return `${d} ${MESES_CORTOS[mes - 1]} ${anio}`;
}

const COLUMNAS: ColumnaTabla<IInventoryShrinkage>[] = [
  { id: "fecha", header: "Fecha", align: "left", cell: (m) => fechaCorta(m.createdAt), sortValue: (m) => m.createdAt },
  {
    id: "tipo",
    header: "Tipo",
    align: "left",
    cell: (m) => TIPOS_MERMA[m.shrinkageType] ?? m.shrinkageType,
    sortValue: (m) => TIPOS_MERMA[m.shrinkageType] ?? m.shrinkageType,
  },
  { id: "unidades", header: "Unidades", cell: (m) => formatNumber(Number(m.quantity)), sortValue: (m) => Number(m.quantity) },
  {
    id: "costo",
    header: "Costo unit.",
    cell: (m) => formatSolesDecimales(Number(m.unitCost)),
    sortValue: (m) => Number(m.unitCost),
  },
  { id: "bruto", header: "Costo bruto", cell: (m) => formatSolesDecimales(costoBruto(m)), sortValue: costoBruto },
  {
    id: "recuperado",
    header: "Recuperado",
    cell: (m) =>
      Number(m.recoveredAmount) > 0 ? (
        formatSolesDecimales(Number(m.recoveredAmount))
      ) : (
        <span className="text-pc-text-muted">{SIN_DATO}</span>
      ),
    sortValue: (m) => Number(m.recoveredAmount || 0),
  },
  {
    id: "neta",
    header: "Pérdida neta",
    cell: (m) => <span className="font-semibold">{formatSolesDecimales(perdidaNeta(m))}</span>,
    sortValue: perdidaNeta,
  },
  {
    id: "notas",
    header: "Notas",
    align: "left",
    className: "max-w-[14rem] truncate",
    cell: (m) => (
      <span title={m.notes ?? undefined} className={cn(!m.notes && "text-pc-text-muted")}>
        {m.notes || SIN_DATO}
      </span>
    ),
  },
];

interface FormMerma {
  tipo: string;
  unidades: string;
  costo: string;
  recuperado: string;
  notas: string;
}

const FORM_VACIO: FormMerma = { tipo: "otro", unidades: "1", costo: "", recuperado: "0", notas: "" };

const claseEtiqueta = "text-[11px] font-semibold uppercase tracking-[0.06em] text-pc-text-muted";

function Campo({
  etiqueta,
  valor,
  onChange,
  error,
  inputMode = "decimal",
}: {
  etiqueta: string;
  valor: string;
  onChange: (valor: string) => void;
  error: string | null;
  inputMode?: "decimal" | "numeric";
}) {
  const id = useId();
  // Vacío no se marca (el botón queda deshabilitado); sí lo mal escrito.
  const mostrar = valor.trim() === "" ? null : error;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className={claseEtiqueta}>
        {etiqueta}
      </label>
      <input
        id={id}
        inputMode={inputMode}
        value={valor}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={!!mostrar}
        aria-describedby={mostrar ? `${id}-error` : undefined}
        className={cn(claseInput, "w-full text-right tabular-nums aria-invalid:border-pc-bad")}
      />
      {mostrar && (
        <span id={`${id}-error`} className="text-[11px] text-pc-bad">
          {mostrar}
        </span>
      )}
    </div>
  );
}

export default function MermaPage() {
  const { fromDate, toDate } = useAdminPeriod();
  const { companyId, token, hoy } = useAdminContexto();
  const invalidar = useInvalidateAdminQueries();
  const qc = useQueryClient();
  const listaQ = useAdminShrinkageList(companyId, fromDate, toDate, token);
  const resumenQ = useAdminShrinkageSummary(companyId, fromDate, toDate, token);
  const [form, setForm] = useState<FormMerma | null>(null);
  const ids = { tipo: useId(), notas: useId() };

  const mermas = useMemo(() => (listaQ.data ?? []) as IInventoryShrinkage[], [listaQ.data]);
  const sumas = useMemo(
    () => ({
      unidades: mermas.reduce((s, m) => s + Number(m.quantity), 0),
      bruto: mermas.reduce((s, m) => s + costoBruto(m), 0),
      recuperado: mermas.reduce((s, m) => s + Number(m.recoveredAmount || 0), 0),
      neta: mermas.reduce((s, m) => s + perdidaNeta(m), 0),
    }),
    [mermas],
  );
  const unidades = resumenQ.data ? Number(resumenQ.data.totalUnidades) : sumas.unidades;
  const costoEstimado = resumenQ.data ? Number(resumenQ.data.costoEstimado) : sumas.neta;

  const crear = useMutation({
    mutationFn: (f: FormMerma) =>
      createShrinkage(
        companyId,
        {
          shrinkageType: f.tipo,
          quantity: Number(f.unidades.trim()),
          unitCost: aNumero(f.costo),
          recoveredAmount: aNumero(f.recuperado),
          notes: f.notas.trim() || undefined,
        },
        token,
      ),
    onSuccess: () => {
      const fueraDelPeriodo = hoy < fromDate || hoy > toDate;
      toast.success(
        fueraDelPeriodo
          ? "Merma registrada con fecha de hoy: no aparece porque el periodo elegido no incluye hoy"
          : "Merma registrada",
      );
      setForm(null);
      invalidar(companyId, fromDate, toDate);
      // El Resumen anual lee las mermas con su propia consulta.
      void qc.invalidateQueries({ queryKey: ["admin-anual-merma"] });
    },
    onError: (error) => toast.error(mensajeError(error, "No se pudo registrar la merma")),
  });

  const errores = form
    ? {
        unidades: errorUnidades(form.unidades),
        costo: errorSoles(form.costo),
        recuperado: errorSoles(form.recuperado),
        notas: form.notas.length > MAX_NOTAS ? `Máximo ${MAX_NOTAS} caracteres` : null,
      }
    : null;
  const valido = !!errores && Object.values(errores).every((e) => e === null);
  const vistaPrevia =
    form && valido ? Number(form.unidades) * aNumero(form.costo) - aNumero(form.recuperado) : null;

  const cargando = listaQ.isLoading || resumenQ.isLoading;

  return (
    <div className="space-y-3.5">
      <Aviso tono="info">
        Las mermas que se registran en Almacén (ajustes de inventario) todavía no llegan acá; se conectan en la Fase 2.
      </Aviso>

      {cargando ? (
        <PanelSkeleton variant="kpis" label="totales de merma" />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard
            label="Unidades perdidas"
            value={formatNumber(unidades)}
            sub={`${formatNumber(mermas.length)} ${mermas.length === 1 ? "registro" : "registros"}`}
          />
          <KpiCard label="Costo estimado" value={formatSolesDecimales(costoEstimado)} sub="Cantidad × costo − recuperado" />
          <KpiCard label="Costo bruto" value={formatSolesDecimales(sumas.bruto)} sub="Cantidad × costo unitario" />
          <KpiCard label="Recuperado" value={formatSolesDecimales(sumas.recuperado)} sub="Lo que se pudo vender o cobrar" />
        </div>
      )}

      <PanelCard
        titulo="Registros de merma"
        subtitulo="El costo estimado del periodo se resta en el Resumen como «Merma»"
        acciones={
          !form && (
            <button type="button" className={claseBotonPrimario} onClick={() => setForm(FORM_VACIO)}>
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Registrar merma
            </button>
          )
        }
      >
        <div className="space-y-3">
          {form && errores && (
            <form
              aria-label="Registrar merma"
              className="space-y-3 rounded-xl border border-pc-border-soft bg-pc-surface-muted p-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (valido && !crear.isPending) crear.mutate(form);
              }}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex min-w-0 flex-col gap-1">
                  <label htmlFor={ids.tipo} className={claseEtiqueta}>
                    Tipo
                  </label>
                  <select
                    id={ids.tipo}
                    value={form.tipo}
                    onChange={(event) => setForm({ ...form, tipo: event.target.value })}
                    className={cn(claseInput, "w-full")}
                  >
                    {Object.entries(TIPOS_MERMA).map(([valor, nombre]) => (
                      <option key={valor} value={valor}>
                        {nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <Campo
                  etiqueta="Unidades"
                  inputMode="numeric"
                  valor={form.unidades}
                  error={errores.unidades}
                  onChange={(unidades) => setForm({ ...form, unidades })}
                />
                <Campo
                  etiqueta="Costo unitario (S/)"
                  valor={form.costo}
                  error={errores.costo}
                  onChange={(costo) => setForm({ ...form, costo })}
                />
                <Campo
                  etiqueta="Recuperado (S/)"
                  valor={form.recuperado}
                  error={errores.recuperado}
                  onChange={(recuperado) => setForm({ ...form, recuperado })}
                />
                <div className="flex min-w-0 flex-col gap-1 sm:col-span-2 lg:col-span-4">
                  <label htmlFor={ids.notas} className={claseEtiqueta}>
                    Notas (opcional)
                  </label>
                  <input
                    id={ids.notas}
                    value={form.notas}
                    maxLength={MAX_NOTAS}
                    placeholder="Qué pasó, pedido o guía relacionada…"
                    onChange={(event) => setForm({ ...form, notas: event.target.value })}
                    className={cn(claseInput, "w-full")}
                  />
                </div>
              </div>
              <p className="text-[11px] text-pc-text-muted">
                {vistaPrevia !== null ? `Pérdida neta: ${formatSolesDecimales(vistaPrevia)}. ` : ""}
                Registrar acá no descuenta stock del inventario.
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="submit" className={claseBotonPrimario} disabled={!valido || crear.isPending}>
                  {crear.isPending ? "Guardando…" : "Registrar"}
                </button>
                <button type="button" className={claseBotonSecundario} onClick={() => setForm(null)}>
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {listaQ.isLoading ? (
            <PanelSkeleton variant="tabla" label="registros de merma" />
          ) : listaQ.isError ? (
            <PanelError error={comoError(listaQ.error)} onRetry={() => void listaQ.refetch()} />
          ) : (
            <AdminTable
              caption="Registros de merma del periodo"
              columns={COLUMNAS}
              rows={mermas}
              getRowKey={(m) => m.id}
              emptyMessage="No hay mermas registradas en este periodo"
              footer={{
                fecha: "Total",
                unidades: formatNumber(sumas.unidades),
                bruto: formatSolesDecimales(sumas.bruto),
                recuperado: formatSolesDecimales(sumas.recuperado),
                neta: formatSolesDecimales(sumas.neta),
              }}
            />
          )}
        </div>
      </PanelCard>
    </div>
  );
}
