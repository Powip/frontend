"use client";

/**
 * Gastos y costos (FEAT-34 C1, C4, L1).
 *
 * - Los gastos son mensuales (ms-company). Arriba se ve lo que le toca al periodo elegido con `prorratearGastos`:
 *   cada gasto × días del periodo en su mes ÷ días del mes (D8). Antes se restaba el mes entero con «Hoy» o «Semana».
 * - La lista y el formulario trabajan sobre un mes elegido con selector de mes y año; arrancan en el mes del periodo
 *   (antes el formulario quedaba en el mes en que se abrió la pantalla y no había año).
 * - Compra de mercadería (INVERSION) va aparte: no entra al resultado, el costo ya se cuenta cuando se vende.
 * - Costo de lo vendido = `resultados.costoProducto`, con el aviso de ventas sin costo (C1).
 * - La publicidad conectada vive en la sección Publicidad; acá solo se muestra el total que entra al resultado.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { type ReactNode, useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { createGasto, deleteGasto, updateGasto } from "@/api/Admin";
import { getProducts } from "@/api/Productos";
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
import { useAdminGastos } from "@/hooks/useAdminQueries";
import type { CategoriaGasto, ICreateGastoDto, IGastoOperativo } from "@/interfaces/IAdmin";
import { cn } from "@/lib/utils";
import {
  AdminTable,
  AvisoCostos,
  type ColumnaTabla,
  claseBotonPrimario,
  claseBotonSecundario,
  claseInput,
  formatPercent,
  formatSoles,
  formatSolesDecimales,
  KpiCard,
  type LineaCascada,
  PanelCard,
  PanelError,
  PanelSkeleton,
  SIN_DATO,
  TablaCascada,
} from "../_components/ui";
import {
  aDiaKey,
  diasDelMes,
  etiquetaMes,
  etiquetaPeriodo,
  MESES_CORTOS,
  MESES_LARGOS,
  mesesDelPeriodo,
  partes,
} from "../_lib/periodo";
import { CATEGORIAS_FIJAS, NOMBRE_CATEGORIA, prorratearGastos } from "../_lib/resultados";
import { type DatosPeriodo, useAdminContexto, useResultadosPeriodo } from "../_lib/useResultados";

const CATEGORIAS_FORM: CategoriaGasto[] = [...CATEGORIAS_FIJAS, "PUBLICIDAD", "INVERSION"];
const ANIO_MINIMO = 2020;

const comoError = (error: unknown) => (error instanceof Error ? error : new Error("Error desconocido"));

function mensajeError(error: unknown, porDefecto: string): string {
  const mensaje = (error as { response?: { data?: { message?: unknown } } } | null)?.response?.data?.message;
  const lista = (Array.isArray(mensaje) ? mensaje : [mensaje]).filter(
    (m): m is string => typeof m === "string" && m.trim() !== "",
  );
  return lista.length ? lista.join(" · ") : porDefecto;
}

const aNumero = (texto: string) => Number(texto.trim().replace(",", "."));

/** null = válido: mayor que 0 y con hasta 2 decimales (ms-company). */
function errorMonto(texto: string): string | null {
  const limpio = texto.trim();
  if (!limpio) return "Obligatorio";
  if (!/^\d+(?:[.,]\d{0,2})?$/.test(limpio)) return "Número con hasta 2 decimales";
  if (aNumero(limpio) <= 0) return "Tiene que ser mayor que 0";
  return null;
}

const mayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

const claseEtiqueta = "text-[11px] font-semibold uppercase tracking-[0.06em] text-pc-text-muted";

// ---- Resumen del periodo --------------------------------------------------------------------

/** «26 de 30 días de noviembre» o, con varios meses, un tramo corto por mes. */
function textoReparto(desde: string, hasta: string): string {
  const tramos = mesesDelPeriodo(desde, hasta);
  if (tramos.length === 0) return "";
  if (tramos.length === 1) {
    const t = tramos[0];
    return t.dias === t.diasMes
      ? `${mayuscula(MESES_LARGOS[t.mes - 1])} completo`
      : `${t.dias} de ${t.diasMes} días de ${MESES_LARGOS[t.mes - 1]}`;
  }
  if (tramos.length > 3) return `Cada mes según sus días dentro del periodo (${tramos.length} meses)`;
  return tramos.map((t) => `${MESES_CORTOS[t.mes - 1]}: ${t.dias} de ${t.diasMes} días`).join(" · ");
}

function ResumenPeriodo({ datos }: { datos: DatosPeriodo }) {
  if (datos.cargando) return <PanelSkeleton variant="kpis" label="resumen de gastos y costos" />;
  if (datos.error) return <PanelError error={comoError(datos.error)} />;
  const r = datos.resultados;
  const deLasVentas = (monto: number) =>
    r.ventas > 0 ? `${formatPercent(monto / r.ventas, 1)} de las ventas` : "Sin ventas en el periodo";
  const totalCostos = r.ventas - r.utilidadOperativa;
  const publicidadSub =
    r.publicidad.conectada === null
      ? `Cargada en Gastos ${formatSoles(r.publicidad.gastos)} · cuentas conectadas sin dato`
      : `Conectada ${formatSoles(r.publicidad.conectada)} · cargada en Gastos ${formatSoles(r.publicidad.gastos)}`;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Gastos fijos del periodo"
          value={formatSoles(r.gastosFijos)}
          sub={`Le toca al periodo: ${textoReparto(datos.desde, datos.hasta)}`}
        />
        <KpiCard label="Costo de lo vendido" value={formatSoles(r.costoProducto)} sub={deLasVentas(r.costoProducto)} />
        <KpiCard label="Publicidad del periodo" value={formatSoles(r.publicidad.total)} sub={publicidadSub} />
        <KpiCard label="Total de costos y gastos" value={formatSoles(totalCostos)} sub={deLasVentas(totalCostos)} />
      </div>
      <AvisoCostos costo={r.costo} />
    </>
  );
}

// ---- Buscador de prenda (compra de mercadería) ----------------------------------------------

type Prenda = { id: string; name: string; sku?: string };

function BuscadorPrenda({ value, onChange }: { value: Prenda | null; onChange: (p: Prenda | null) => void }) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<Prenda[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const id = useId();

  useEffect(() => {
    const texto = query.trim();
    if (texto.length < 2) {
      setResultados([]);
      return;
    }
    let cancelado = false;
    setBuscando(true);
    const espera = setTimeout(() => {
      getProducts({ name: texto })
        .then((items) => {
          if (!cancelado) setResultados(items.slice(0, 8).map((p) => ({ id: p.id, name: p.name, sku: p.sku })));
        })
        .catch(() => {
          if (!cancelado) setResultados([]);
        })
        .finally(() => {
          if (!cancelado) setBuscando(false);
        });
    }, 300);
    return () => {
      cancelado = true;
      clearTimeout(espera);
    };
  }, [query]);

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className={claseEtiqueta}>
        Prenda (opcional)
      </label>
      {value ? (
        <div className="flex h-8 items-center justify-between gap-2 rounded-lg border border-pc-border bg-pc-card px-2.5 text-xs text-pc-text">
          <span className="truncate" title={value.name}>
            {value.name}
          </span>
          <button
            type="button"
            aria-label="Quitar prenda"
            className="rounded text-pc-text-muted outline-none hover:text-pc-text focus-visible:ring-2 focus-visible:ring-pc-primary"
            onClick={() => onChange(null)}
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            id={id}
            placeholder="Buscar prenda…"
            value={query}
            autoComplete="off"
            onChange={(event) => {
              setQuery(event.target.value);
              setAbierto(true);
            }}
            onFocus={() => setAbierto(true)}
            onBlur={() => setTimeout(() => setAbierto(false), 150)}
            className={cn(claseInput, "w-full")}
          />
          {abierto && query.trim().length >= 2 && (
            <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-pc-border bg-pc-card shadow-md">
              {buscando ? (
                <p className="px-3 py-2 text-xs text-pc-text-muted">Buscando…</p>
              ) : resultados.length === 0 ? (
                <p className="px-3 py-2 text-xs text-pc-text-muted">Sin resultados</p>
              ) : (
                resultados.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="flex w-full flex-col items-start px-3 py-2 text-left text-xs text-pc-text hover:bg-pc-surface-muted"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onChange(p);
                      setQuery("");
                      setAbierto(false);
                    }}
                  >
                    <span>{p.name}</span>
                    {p.sku && <span className="text-[11px] text-pc-text-muted">{p.sku}</span>}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Gastos del mes -------------------------------------------------------------------------

interface FormGasto {
  id: string | null;
  categoria: CategoriaGasto;
  descripcion: string;
  monto: string;
  mes: number;
  anio: number;
  productId: string | null;
  productName: string | null;
  /** Prenda que tenía al abrir la edición (para desligarla si cambia de categoría). */
  teniaPrenda: boolean;
}

const formVacio = (anio: number, mes: number): FormGasto => ({
  id: null,
  categoria: "OTRO",
  descripcion: "",
  monto: "",
  mes,
  anio,
  productId: null,
  productName: null,
  teniaPrenda: false,
});

const formDeGasto = (g: IGastoOperativo): FormGasto => ({
  id: g.id,
  categoria: g.categoria,
  descripcion: g.descripcion ?? "",
  monto: String(Number(g.monto)),
  mes: Number(g.mes),
  anio: Number(g.anio),
  productId: g.productId ?? null,
  productName: g.productName ?? null,
  teniaPrenda: !!g.productId,
});

function cuerpoDeForm(form: FormGasto): ICreateGastoDto {
  const base: ICreateGastoDto = {
    categoria: form.categoria,
    descripcion: form.descripcion.trim(),
    monto: aNumero(form.monto),
    mes: form.mes,
    anio: form.anio,
  };
  if (form.categoria === "INVERSION") return { ...base, productId: form.productId, productName: form.productName };
  // La prenda solo aplica a la compra de mercadería: si cambió de categoría, se desliga.
  return form.teniaPrenda ? { ...base, productId: null, productName: null } : base;
}

function Pildora({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold", className)}>{children}</span>
  );
}

function SelectorMes({
  anio,
  mes,
  anios,
  onChange,
  etiqueta,
}: {
  anio: number;
  mes: number;
  anios: number[];
  onChange: (valor: { anio: number; mes: number }) => void;
  etiqueta: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <select
        aria-label={`Mes ${etiqueta}`}
        value={mes}
        onChange={(event) => onChange({ anio, mes: Number(event.target.value) })}
        className={claseInput}
      >
        {MESES_LARGOS.map((nombre, i) => (
          <option key={nombre} value={i + 1}>
            {mayuscula(nombre)}
          </option>
        ))}
      </select>
      <select
        aria-label={`Año ${etiqueta}`}
        value={anio}
        onChange={(event) => onChange({ anio: Number(event.target.value), mes })}
        className={claseInput}
      >
        {anios.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
    </div>
  );
}

function ResumenDelMes({
  gastos,
  anio,
  mes,
  desde,
  hasta,
}: {
  gastos: IGastoOperativo[];
  anio: number;
  mes: number;
  desde: string;
  hasta: string;
}) {
  const delMes = (categoria: CategoriaGasto) =>
    gastos.filter((g) => g.categoria === categoria).reduce((s, g) => s + (Number(g.monto) || 0), 0);
  const prorrateo = prorratearGastos(gastos, desde, hasta);
  const tramo = mesesDelPeriodo(desde, hasta).find((t) => t.anio === anio && t.mes === mes);
  const fijosMes = CATEGORIAS_FIJAS.reduce((s, c) => s + delMes(c), 0);
  const nombreMes = MESES_LARGOS[mes - 1];

  const filas: { clave: string; etiqueta: string; monto: number; periodo: number; total?: boolean }[] = [
    ...CATEGORIAS_FIJAS.map((c) => ({
      clave: c,
      etiqueta: NOMBRE_CATEGORIA[c],
      monto: delMes(c),
      periodo: prorrateo.porCategoria[c],
    })),
    { clave: "fijos", etiqueta: "Gastos fijos", monto: fijosMes, periodo: prorrateo.fijos, total: true },
    {
      clave: "PUBLICIDAD",
      etiqueta: "Publicidad cargada",
      monto: delMes("PUBLICIDAD"),
      periodo: prorrateo.publicidad,
    },
    {
      clave: "total",
      etiqueta: "Total que entra al resultado",
      monto: fijosMes + delMes("PUBLICIDAD"),
      periodo: prorrateo.fijos + prorrateo.publicidad,
      total: true,
    },
  ];

  return (
    <div className="space-y-3">
      <table className="w-full border-collapse text-[12.5px]">
        <caption className="sr-only">Gastos de {etiquetaMes(anio, mes, true)} por categoría</caption>
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-pc-text-muted">
            <th scope="col" className="py-1.5 text-left font-semibold">
              Categoría
            </th>
            <th scope="col" className="py-1.5 text-right font-semibold">
              Del mes
            </th>
            <th scope="col" className="py-1.5 text-right font-semibold">
              Le toca al periodo
            </th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr
              key={fila.clave}
              className={cn("border-t border-pc-border-soft", fila.total && "bg-pc-surface-muted font-bold")}
            >
              <th scope="row" className="py-2 pl-1 text-left font-medium text-pc-text">
                {fila.etiqueta}
              </th>
              <td className="py-2 text-right tabular-nums">{formatSoles(fila.monto)}</td>
              <td className="py-2 pr-1 text-right tabular-nums">{formatSoles(fila.periodo)}</td>
            </tr>
          ))}
          <tr className="border-t border-pc-border text-pc-text-muted">
            <th scope="row" className="py-2 pl-1 text-left font-medium">
              {NOMBRE_CATEGORIA.INVERSION}
            </th>
            <td className="py-2 text-right tabular-nums">{formatSoles(delMes("INVERSION"))}</td>
            <td className="py-2 pr-1 text-right text-[11px]">No entra</td>
          </tr>
        </tbody>
      </table>
      <p className="text-xs leading-relaxed text-pc-text-muted">
        {tramo
          ? tramo.dias === tramo.diasMes
            ? `El periodo toma ${nombreMes} completo.`
            : `Al periodo le tocan ${tramo.dias} de ${tramo.diasMes} días de ${nombreMes}: cada gasto del mes se multiplica por ${tramo.dias}/${tramo.diasMes}.`
          : `${mayuscula(nombreMes)} ${anio} no está dentro del periodo elegido (${etiquetaPeriodo(desde, hasta)}): no le toca nada.`}{" "}
        La compra de mercadería va aparte: no se resta en el resultado porque el costo del producto ya se cuenta cuando
        se vende.
      </p>
    </div>
  );
}

function GastosDelMes({ desde, hasta }: { desde: string; hasta: string }) {
  const { companyId, token, hoy } = useAdminContexto();
  const qc = useQueryClient();
  const [anioFin, mesFin] = partes(hasta);
  const [vista, setVista] = useState({ anio: anioFin, mes: mesFin });
  const [form, setForm] = useState<FormGasto | null>(null);
  const [aBorrar, setABorrar] = useState<IGastoOperativo | null>(null);
  const ids = { categoria: useId(), descripcion: useId(), monto: useId() };

  const inicio = aDiaKey(vista.anio, vista.mes, 1);
  const fin = aDiaKey(vista.anio, vista.mes, diasDelMes(vista.anio, vista.mes));
  const gastosQ = useAdminGastos(companyId, inicio, fin, token);
  const gastos = useMemo(
    () =>
      (gastosQ.data ?? []).filter((g) => Number(g.anio) === vista.anio && Number(g.mes) === vista.mes),
    [gastosQ.data, vista.anio, vista.mes],
  );

  const anioHoy = partes(hoy)[0];
  const anios = useMemo(() => {
    const lista = new Set<number>([vista.anio, form?.anio ?? vista.anio]);
    for (let a = Math.max(ANIO_MINIMO, anioHoy - 4); a <= anioHoy + 1; a++) lista.add(a);
    return [...lista].sort((a, b) => b - a);
  }, [anioHoy, vista.anio, form?.anio]);

  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ["admin-gastos"] });
    void qc.invalidateQueries({ queryKey: ["admin-anual-gastos"] });
  };

  const guardar = useMutation({
    mutationFn: (f: FormGasto) =>
      f.id ? updateGasto(companyId, f.id, cuerpoDeForm(f), token) : createGasto(companyId, cuerpoDeForm(f), token),
    onSuccess: (_, f) => {
      toast.success(`${f.id ? "Gasto actualizado" : "Gasto registrado"} en ${etiquetaMes(f.anio, f.mes, true)}`);
      setForm(null);
      setVista({ anio: f.anio, mes: f.mes });
      invalidar();
    },
    onError: (error) => toast.error(mensajeError(error, "No se pudo guardar el gasto")),
  });
  const borrar = useMutation({
    mutationFn: (id: string) => deleteGasto(companyId, id, token),
    onSuccess: () => {
      toast.success("Gasto eliminado");
      invalidar();
    },
    onError: (error) => toast.error(mensajeError(error, "No se pudo eliminar el gasto")),
  });

  const errorDeMonto = form && form.monto.trim() !== "" ? errorMonto(form.monto) : null;
  const puedeGuardar = !!form && errorMonto(form.monto) === null && !guardar.isPending;
  const totalMes = gastos.reduce((s, g) => s + (Number(g.monto) || 0), 0);
  const hayInversion = gastos.some((g) => g.categoria === "INVERSION");

  const columnas: ColumnaTabla<IGastoOperativo>[] = [
    {
      id: "categoria",
      header: "Categoría",
      align: "left",
      cell: (g) => (
        <span className="flex items-center gap-1.5">
          <Pildora
            className={
              g.categoria === "INVERSION"
                ? "bg-pc-info-soft text-pc-info"
                : g.categoria === "PUBLICIDAD"
                  ? "bg-pc-warn-soft text-pc-warn"
                  : "bg-pc-surface-muted text-pc-text"
            }
          >
            {NOMBRE_CATEGORIA[g.categoria] ?? g.categoria}
          </Pildora>
          {g.source && g.source !== "manual" && (
            <Pildora className="border border-pc-border text-pc-text-muted">Automático</Pildora>
          )}
          {g.recurrence && <Pildora className="border border-pc-border text-pc-text-muted">{g.recurrence}</Pildora>}
        </span>
      ),
      sortValue: (g) => NOMBRE_CATEGORIA[g.categoria] ?? g.categoria,
    },
    {
      id: "descripcion",
      header: "Descripción",
      align: "left",
      className: "max-w-[14rem] truncate",
      cell: (g) => (
        <span title={g.descripcion ?? undefined} className={cn(!g.descripcion && "text-pc-text-muted")}>
          {g.descripcion || SIN_DATO}
        </span>
      ),
      sortValue: (g) => g.descripcion ?? "",
    },
    {
      id: "prenda",
      header: "Prenda",
      align: "left",
      className: "max-w-[10rem] truncate",
      cell: (g) => <span className={cn(!g.productName && "text-pc-text-muted")}>{g.productName || SIN_DATO}</span>,
      sortValue: (g) => g.productName ?? "",
    },
    {
      id: "monto",
      header: "Monto",
      cell: (g) => <span className="font-semibold">{formatSolesDecimales(Number(g.monto))}</span>,
      sortValue: (g) => Number(g.monto),
    },
    {
      id: "acciones",
      header: <span className="sr-only">Acciones</span>,
      cell: (g) => (
        <span className="inline-flex gap-1">
          <button
            type="button"
            aria-label={`Editar gasto ${NOMBRE_CATEGORIA[g.categoria] ?? g.categoria} ${formatSolesDecimales(Number(g.monto))}`}
            className={claseBotonSecundario}
            disabled={guardar.isPending || borrar.isPending}
            onClick={() => setForm(formDeGasto(g))}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button
            type="button"
            aria-label={`Eliminar gasto ${NOMBRE_CATEGORIA[g.categoria] ?? g.categoria} ${formatSolesDecimales(Number(g.monto))}`}
            className={cn(claseBotonSecundario, "hover:border-pc-bad hover:text-pc-bad")}
            disabled={guardar.isPending || borrar.isPending}
            onClick={() => setABorrar(g)}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        </span>
      ),
    },
  ];

  const etiquetaVista = etiquetaMes(vista.anio, vista.mes, true);

  return (
    <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[3fr_2fr]">
      <PanelCard
        titulo={`Gastos de ${etiquetaVista}`}
        subtitulo="Monto mensual. Se reparte por días en los periodos más cortos"
        acciones={
          <>
            <SelectorMes
              anio={vista.anio}
              mes={vista.mes}
              anios={anios}
              etiqueta="que se muestra"
              onChange={(v) => setVista(v)}
            />
            {!form && (
              <button
                type="button"
                className={claseBotonPrimario}
                onClick={() => setForm(formVacio(vista.anio, vista.mes))}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Registrar gasto
              </button>
            )}
          </>
        }
      >
        <div className="space-y-3">
          {form && (
            <form
              aria-label={form.id ? "Editar gasto" : "Registrar gasto"}
              className="space-y-3 rounded-xl border border-pc-border-soft bg-pc-surface-muted p-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (puedeGuardar) guardar.mutate(form);
              }}
            >
              <p className="text-sm font-semibold text-pc-text">{form.id ? "Editar gasto" : "Registrar gasto"}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <label htmlFor={ids.categoria} className={claseEtiqueta}>
                    Categoría
                  </label>
                  <select
                    id={ids.categoria}
                    value={form.categoria}
                    onChange={(event) => setForm({ ...form, categoria: event.target.value as CategoriaGasto })}
                    className={cn(claseInput, "w-full")}
                  >
                    {CATEGORIAS_FORM.map((c) => (
                      <option key={c} value={c}>
                        {NOMBRE_CATEGORIA[c]}
                      </option>
                    ))}
                  </select>
                </div>
                {form.categoria === "INVERSION" && (
                  <BuscadorPrenda
                    value={form.productId ? { id: form.productId, name: form.productName || "Prenda" } : null}
                    onChange={(p) => setForm({ ...form, productId: p?.id ?? null, productName: p?.name ?? null })}
                  />
                )}
                <div className="flex min-w-0 flex-col gap-1">
                  <label htmlFor={ids.descripcion} className={claseEtiqueta}>
                    Descripción
                  </label>
                  <input
                    id={ids.descripcion}
                    placeholder="Ej.: planilla de noviembre"
                    value={form.descripcion}
                    onChange={(event) => setForm({ ...form, descripcion: event.target.value })}
                    className={cn(claseInput, "w-full")}
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <label htmlFor={ids.monto} className={claseEtiqueta}>
                    Monto del mes (S/)
                  </label>
                  <input
                    id={ids.monto}
                    inputMode="decimal"
                    placeholder="0.00"
                    value={form.monto}
                    onChange={(event) => setForm({ ...form, monto: event.target.value })}
                    aria-invalid={!!errorDeMonto}
                    aria-describedby={errorDeMonto ? `${ids.monto}-error` : undefined}
                    className={cn(claseInput, "w-full text-right tabular-nums aria-invalid:border-pc-bad")}
                  />
                  {errorDeMonto && (
                    <span id={`${ids.monto}-error`} className="text-[11px] text-pc-bad">
                      {errorDeMonto}
                    </span>
                  )}
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className={claseEtiqueta}>Mes del gasto</span>
                  <SelectorMes
                    anio={form.anio}
                    mes={form.mes}
                    anios={anios}
                    etiqueta="del gasto"
                    onChange={(v) => setForm({ ...form, ...v })}
                  />
                </div>
              </div>
              {form.categoria === "INVERSION" && (
                <p className="text-[11px] text-pc-text-muted">
                  La compra de mercadería se guarda para tu control pero no se resta en el resultado: el costo del producto
                  ya se cuenta cuando se vende.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button type="submit" className={claseBotonPrimario} disabled={!puedeGuardar}>
                  {guardar.isPending ? "Guardando…" : form.id ? "Guardar cambios" : "Registrar"}
                </button>
                <button type="button" className={claseBotonSecundario} onClick={() => setForm(null)}>
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {gastosQ.isLoading ? (
            <PanelSkeleton variant="tabla" label={`gastos de ${etiquetaVista}`} />
          ) : gastosQ.isError ? (
            <PanelError error={comoError(gastosQ.error)} onRetry={() => void gastosQ.refetch()} />
          ) : (
            <AdminTable
              caption={`Gastos de ${etiquetaVista}`}
              columns={columnas}
              rows={gastos}
              getRowKey={(g) => g.id}
              emptyMessage={`No hay gastos cargados en ${etiquetaVista}`}
              footer={{
                categoria: hayInversion ? "Total (con compra de mercadería)" : "Total del mes",
                monto: formatSolesDecimales(totalMes),
              }}
            />
          )}
        </div>
      </PanelCard>

      <PanelCard titulo={`Por categoría · ${etiquetaVista}`} subtitulo="Gasto del mes y la parte que le toca al periodo elegido">
        {gastosQ.isLoading ? (
          <PanelSkeleton variant="tabla" label="gastos por categoría" />
        ) : gastosQ.isError ? (
          <PanelError error={comoError(gastosQ.error)} />
        ) : (
          <ResumenDelMes gastos={gastos} anio={vista.anio} mes={vista.mes} desde={desde} hasta={hasta} />
        )}
      </PanelCard>

      <AlertDialog open={!!aBorrar} onOpenChange={(abierto) => !abierto && setABorrar(null)}>
        <AlertDialogContent className="border-pc-border bg-pc-card text-pc-text">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">¿Eliminar este gasto?</AlertDialogTitle>
            <AlertDialogDescription className="text-pc-text-muted">
              {aBorrar
                ? `${NOMBRE_CATEGORIA[aBorrar.categoria] ?? aBorrar.categoria}${aBorrar.descripcion ? ` · ${aBorrar.descripcion}` : ""} · ${etiquetaMes(Number(aBorrar.anio), Number(aBorrar.mes), true)} · ${formatSolesDecimales(Number(aBorrar.monto))}. `
                : ""}
              Deja de restarse en Resumen, Utilidad y los demás resultados.
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
    </div>
  );
}

// ---- Costos y gastos del periodo ------------------------------------------------------------

function CostosDelPeriodo({ datos }: { datos: DatosPeriodo }) {
  if (datos.cargando || datos.error) return null;
  const r = datos.resultados;
  const total = r.ventas - r.utilidadOperativa;
  const lineas: LineaCascada[] = [
    {
      clave: "costo",
      etiqueta: "Costo de producto",
      monto: r.costoProducto,
      signo: "+",
      nota:
        r.costo.sinCostoPedidos > 0
          ? `Falta el costo de ${r.costo.sinCostoPedidos} ${r.costo.sinCostoPedidos === 1 ? "venta" : "ventas"}`
          : undefined,
    },
    { clave: "merma", etiqueta: "Merma", monto: r.merma, signo: "+" },
    { clave: "comisiones", etiqueta: "Comisiones de canal", monto: r.comisiones, signo: "+" },
    { clave: "envios", etiqueta: "Envíos (courier)", monto: r.envios, signo: "+" },
    { clave: "publicidad", etiqueta: "Publicidad", monto: r.publicidad.total, signo: "+" },
    { clave: "fijos", etiqueta: "Gastos fijos (repartidos por días)", monto: r.gastosFijos, signo: "+" },
    { clave: "total", etiqueta: "Total de costos y gastos", monto: total, signo: "=", total: true },
    { clave: "ventas", etiqueta: "Ventas del periodo (con IGV)", monto: r.ventas, signo: "=", informativa: true },
  ];
  return (
    <PanelCard
      titulo="Costos y gastos del periodo"
      subtitulo="Todo lo que se resta a las ventas hasta la utilidad operativa (los mismos números del Resumen)"
    >
      <TablaCascada lineas={lineas} base={r.ventas} caption="Costos y gastos del periodo" />
    </PanelCard>
  );
}

export default function GastosPage() {
  const { fromDate, toDate } = useAdminPeriod();
  const datos = useResultadosPeriodo(fromDate, toDate);
  return (
    <div className="space-y-3.5">
      <ResumenPeriodo datos={datos} />
      {/* La clave reinicia el mes elegido cuando cambia el periodo: arranca en el mes del periodo. */}
      <GastosDelMes key={toDate} desde={fromDate} hasta={toDate} />
      <CostosDelPeriodo datos={datos} />
    </div>
  );
}
