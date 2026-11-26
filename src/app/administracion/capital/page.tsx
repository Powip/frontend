"use client";

/**
 * Capital y ROI (FEAT-34 M7). Fuera del menú hasta tener backend (D6): capital y préstamos viven solo en este
 * navegador (`_lib/capitalStorage.ts`).
 *
 * - Utilidad = utilidad operativa del año del periodo elegido, a la fecha (`useResultadosAnuales`): la misma cuenta
 *   que Resultados. El capital es todo lo registrado, de cualquier fecha.
 * - La «utilidad reinvertida» no se suma al capital (ya está en la utilidad).
 * - Préstamos con TEA → tasa mensual `(1 + TEA)^(1/12) − 1`, fecha de inicio como día local y una tabla por préstamo.
 */

import { Check, Plus, Trash2 } from "lucide-react";
import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAdminPeriod } from "@/contexts/AdminPeriodContext";
import { cn } from "@/lib/utils";
import { NivelPill } from "../_components/nivel";
import {
  AdminTable,
  Aviso,
  AvisoCostos,
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
  PanelEmpty,
  PanelError,
  SIN_DATO,
} from "../_components/ui";
import {
  type CapitalEntry,
  type CapitalTipo,
  cuotaFrancesa,
  generarAmortizacion,
  resumirCapital,
  resumirPrestamo,
  tasaMensualDeTea,
  TIPOS_CAPITAL,
  useCapitalEntries,
  useCuotasPagadas,
} from "../_lib/capitalStorage";
import { aDiaKey, diasEntre, esDiaKey, etiquetaPeriodo, partes } from "../_lib/periodo";
import { useAdminContexto, useResultadosAnuales } from "../_lib/useResultados";

interface FormCapital {
  tipo: CapitalTipo;
  descripcion: string;
  tienda: string;
  monto: string;
  tea: string;
  plazo: string;
  cuota: string;
  fechaInicio: string;
}

const formVacio = (hoy: string): FormCapital => ({
  tipo: "Capital propio",
  descripcion: "",
  tienda: "Consolidado",
  monto: "",
  tea: "",
  plazo: "12",
  cuota: "",
  fechaInicio: hoy,
});

const leer = (texto: string) => {
  const n = Number(texto.trim().replace(",", "."));
  return texto.trim() !== "" && Number.isFinite(n) ? n : null;
};

export default function CapitalRoiPage() {
  const { toDate } = useAdminPeriod();
  const { companyId, hoy } = useAdminContexto();
  const anio = partes(toDate)[0];
  const datos = useResultadosAnuales(anio);

  const [capital, setCapital] = useCapitalEntries(companyId);
  const [form, setForm] = useState<FormCapital | null>(null);

  const resumen = useMemo(() => resumirCapital(capital), [capital]);
  const prestamos = capital.filter((c) => c.tipo === "Préstamo");

  const utilidad = datos.total.utilidadOperativa;
  const diasMedidos = diasEntre(datos.desde, datos.hasta);
  const diasAnio = diasEntre(aDiaKey(anio, 1, 1), aDiaKey(anio, 12, 31));
  const utilidadMensual = diasMedidos > 0 ? (utilidad / diasMedidos) * (diasAnio / 12) : null;
  const roi = resumen.invertido > 0 && diasMedidos > 0 ? utilidad / resumen.invertido : null;
  const mesesRecupero =
    utilidadMensual !== null && utilidadMensual > 0 && resumen.invertido > 0
      ? resumen.invertido / utilidadMensual
      : null;
  const periodoUtilidad = diasMedidos > 0 ? etiquetaPeriodo(datos.desde, datos.hasta) : String(anio);

  function guardar(evento: FormEvent) {
    evento.preventDefault();
    if (!form) return;
    const monto = leer(form.monto);
    if (!form.descripcion.trim() || monto === null || monto <= 0) {
      toast.error("Completa la descripción y un monto mayor a 0");
      return;
    }
    let extra: Partial<CapitalEntry> = {};
    if (form.tipo === "Préstamo") {
      const tea = leer(form.tea) ?? 0;
      const plazo = Math.round(leer(form.plazo) ?? 0);
      const cuota = leer(form.cuota) ?? 0;
      if (tea < 0 || plazo <= 0 || cuota <= 0) {
        toast.error("Para un préstamo, completa la TEA, el plazo y la cuota mensual");
        return;
      }
      if (!esDiaKey(form.fechaInicio)) {
        toast.error("Elige la fecha del desembolso");
        return;
      }
      const interesPrimerMes = monto * tasaMensualDeTea(tea);
      if (cuota <= interesPrimerMes) {
        toast.error(
          `La cuota (${formatSolesDecimales(cuota)}) no cubre el interés del primer mes (${formatSolesDecimales(interesPrimerMes)}): la deuda nunca bajaría.`,
        );
        return;
      }
      extra = { tasaAnualPct: tea, plazoCuotas: plazo, cuotaMensual: cuota, fechaInicio: form.fechaInicio };
    }
    setCapital((prev) => [
      ...prev,
      {
        id: `cap-${Date.now()}`,
        tipo: form.tipo,
        descripcion: form.descripcion.trim(),
        monto,
        tienda: form.tienda.trim() || "Consolidado",
        ...extra,
      },
    ]);
    setForm(null);
    toast.success("Capital registrado en este navegador");
  }

  function eliminar(id: string) {
    setCapital((prev) => prev.filter((c) => c.id !== id));
  }

  const rotulo = (
    <p className="text-xs text-pc-text-muted">
      La utilidad es la operativa de <span className="font-semibold text-pc-text">{periodoUtilidad}</span> (el año del
      último día del periodo elegido, a la fecha). El capital es todo lo registrado, de cualquier fecha: el ROI compara
      la utilidad de ese tramo contra todo el capital.
    </p>
  );

  return (
    <div className="space-y-3.5">
      {rotulo}
      {datos.error ? <PanelError error={datos.error as Error} /> : <AvisoCostos costo={datos.total.costo} />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Capital invertido"
          value={formatSoles(resumen.invertido)}
          sub={`Aportes ${formatSoles(resumen.aportes)} · préstamos ${formatSoles(resumen.prestamos)}`}
        />
        <KpiCard
          label={`Utilidad operativa ${anio}`}
          loading={datos.cargando}
          value={<span className={cn(utilidad < 0 && "text-pc-bad")}>{formatSoles(utilidad)}</span>}
          sub={periodoUtilidad}
        />
        <KpiCard
          label="ROI"
          loading={datos.cargando}
          value={formatPercent(roi, 1)}
          sub={resumen.invertido > 0 ? "Utilidad ÷ capital invertido" : "Registra tu capital para calcularlo"}
        />
        <KpiCard
          label="Tiempo de recupero"
          loading={datos.cargando}
          value={mesesRecupero !== null ? `${mesesRecupero.toFixed(1)} meses` : SIN_DATO}
          sub={
            utilidadMensual !== null && utilidadMensual <= 0
              ? "Sin utilidad en el año: a este ritmo no se recupera"
              : `Capital ÷ utilidad de un mes promedio (${formatSoles(utilidadMensual)})`
          }
        />
      </div>

      {resumen.reinvertida > 0 && (
        <Aviso tono="info" titulo={`Utilidad reinvertida: ${formatSoles(resumen.reinvertida)}`}>
          No se suma al capital: es utilidad que ya ganaste. Si la sumáramos, la misma plata contaría como inversión y
          como ganancia.
        </Aviso>
      )}

      {form && (
        <PanelCard titulo="Registrar capital" subtitulo="Se guarda solo en este navegador.">
          <form onSubmit={guardar} aria-label="Registrar capital" className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Campo label="Tipo" id="capital-tipo">
                <select
                  id="capital-tipo"
                  className={cn(claseInput, "w-full")}
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value as CapitalTipo })}
                >
                  {TIPOS_CAPITAL.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {tipo}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo label="Descripción" id="capital-descripcion">
                <input
                  id="capital-descripcion"
                  placeholder="Ej: aporte inicial"
                  className={cn(claseInput, "w-full")}
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                />
              </Campo>
              <Campo label="Tienda" id="capital-tienda">
                <input
                  id="capital-tienda"
                  className={cn(claseInput, "w-full")}
                  value={form.tienda}
                  onChange={(e) => setForm({ ...form, tienda: e.target.value })}
                />
              </Campo>
              <Campo label="Monto (S/)" id="capital-monto">
                <input
                  id="capital-monto"
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  className={cn(claseInput, "w-full")}
                  value={form.monto}
                  onChange={(e) => setForm({ ...form, monto: e.target.value })}
                />
              </Campo>
            </div>
            {form.tipo === "Préstamo" && <DatosPrestamo form={form} setForm={setForm} />}
            {form.tipo === "Utilidad reinvertida" && (
              <p className="text-xs text-pc-text-muted">
                Queda anotada pero no suma al capital invertido: ya está dentro de la utilidad.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="submit" className={claseBotonPrimario}>
                Guardar
              </button>
              <button type="button" className={claseBotonSecundario} onClick={() => setForm(null)}>
                Cancelar
              </button>
            </div>
          </form>
        </PanelCard>
      )}

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[2fr_3fr]">
        <PanelCard
          titulo="Capital registrado"
          subtitulo="Aportes, aumentos, préstamos y utilidad reinvertida"
          acciones={
            !form && (
              <button type="button" className={claseBotonPrimario} onClick={() => setForm(formVacio(hoy))}>
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Registrar capital
              </button>
            )
          }
        >
          {capital.length === 0 ? (
            <PanelEmpty mensaje="Todavía no registraste capital" />
          ) : (
            <ul className="space-y-2">
              {capital.map((c) => (
                <li key={c.id} className="flex items-center gap-3 rounded-xl border border-pc-border-soft px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-pc-text">{c.tipo}</p>
                    <p className="truncate text-xs text-pc-text-muted">
                      {c.descripcion} · {c.tienda}
                      {c.tipo === "Utilidad reinvertida" && " · no suma al capital"}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-pc-text">{formatSoles(c.monto)}</span>
                  <button
                    type="button"
                    className={claseBotonSecundario}
                    aria-label={`Eliminar ${c.tipo}: ${c.descripcion}`}
                    onClick={() => eliminar(c.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </PanelCard>

        <div className="min-w-0 space-y-3.5">
          {prestamos.length === 0 ? (
            <PanelCard titulo="Préstamos" subtitulo="Cuotas, intereses y saldo de cada préstamo">
              <PanelEmpty mensaje="Sin préstamos registrados" />
              <p className="mt-2 text-xs text-pc-text-muted">
                Registra uno con «Registrar capital» → tipo Préstamo (TEA, plazo y cuota).
              </p>
            </PanelCard>
          ) : (
            prestamos.map((p) => <SeguimientoPrestamo key={p.id} companyId={companyId} prestamo={p} hoy={hoy} />)
          )}
        </div>
      </div>
    </div>
  );
}

function Campo({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-xs font-semibold text-pc-text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

function DatosPrestamo({ form, setForm }: { form: FormCapital; setForm: (form: FormCapital) => void }) {
  const monto = leer(form.monto) ?? 0;
  const tea = leer(form.tea) ?? 0;
  const plazo = Math.round(leer(form.plazo) ?? 0);
  const sugerida = cuotaFrancesa(monto, tea, plazo);
  return (
    <div className="space-y-2 rounded-xl border border-pc-border-soft bg-pc-surface-muted p-3">
      <p className="text-xs font-semibold text-pc-text-muted">Datos del préstamo</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Campo label="TEA % (tasa efectiva anual)" id="capital-tea">
          <input
            id="capital-tea"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            className={cn(claseInput, "w-full")}
            value={form.tea}
            onChange={(e) => setForm({ ...form, tea: e.target.value })}
          />
        </Campo>
        <Campo label="Plazo (cuotas mensuales)" id="capital-plazo">
          <input
            id="capital-plazo"
            type="number"
            min="1"
            step="1"
            className={cn(claseInput, "w-full")}
            value={form.plazo}
            onChange={(e) => setForm({ ...form, plazo: e.target.value })}
          />
        </Campo>
        <Campo label="Cuota mensual (S/)" id="capital-cuota">
          <input
            id="capital-cuota"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            className={cn(claseInput, "w-full")}
            value={form.cuota}
            onChange={(e) => setForm({ ...form, cuota: e.target.value })}
          />
        </Campo>
        <Campo label="Fecha del desembolso" id="capital-fecha">
          <input
            id="capital-fecha"
            type="date"
            className={cn(claseInput, "w-full")}
            value={form.fechaInicio}
            onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })}
          />
        </Campo>
      </div>
      <p className="flex flex-wrap items-center gap-2 text-xs text-pc-text-muted">
        Tasa mensual equivalente: {formatPercent(tasaMensualDeTea(tea), 2)}.
        {sugerida !== null && (
          <>
            {" "}
            Cuota fija para ese plazo: {formatSolesDecimales(sugerida)}.
            <button
              type="button"
              className={claseBotonSecundario}
              onClick={() => setForm({ ...form, cuota: String(sugerida) })}
            >
              Usar esa cuota
            </button>
          </>
        )}
      </p>
    </div>
  );
}

function SeguimientoPrestamo({ companyId, prestamo, hoy }: { companyId: string; prestamo: CapitalEntry; hoy: string }) {
  const [cuotasPagadas, setCuotasPagadas] = useCuotasPagadas(companyId, prestamo.id);
  const cuotas = useMemo(() => generarAmortizacion(prestamo, cuotasPagadas, hoy), [prestamo, cuotasPagadas, hoy]);
  const resumen = resumirPrestamo(prestamo, cuotas);
  const progreso = cuotas.length > 0 ? resumen.pagadas / cuotas.length : 0;

  function pagar() {
    if (!resumen.proxima) return;
    setCuotasPagadas((n) => n + 1);
    toast.success(`Cuota ${resumen.proxima.n} pagada: ${formatSolesDecimales(resumen.proxima.cuota)}`);
  }

  return (
    <PanelCard
      titulo={`Préstamo: ${prestamo.descripcion}`}
      subtitulo={`${formatSoles(prestamo.monto)} · TEA ${(prestamo.tasaAnualPct ?? 0).toLocaleString("es-PE", { maximumFractionDigits: 2 })} % · ${formatNumber(prestamo.plazoCuotas ?? 0)} cuotas`}
      acciones={
        resumen.proxima && (
          <button type="button" className={claseBotonPrimario} onClick={pagar}>
            <Check className="h-3.5 w-3.5" aria-hidden />
            Pagar cuota {resumen.proxima.n}
          </button>
        )
      }
    >
      {cuotas.length === 0 ? (
        <PanelEmpty mensaje="Faltan datos del préstamo (TEA, plazo o cuota) para armar las cuotas" />
      ) : (
        <div className="space-y-3">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Dato label={`Pagado (${resumen.pagadas} cuotas)`} valor={formatSoles(resumen.pagado)} />
            <Dato label="Saldo de capital" valor={formatSoles(resumen.saldo)} />
            <Dato label="Intereses totales" valor={formatSoles(resumen.interesTotal)} />
            <Dato
              label="Próxima cuota"
              valor={resumen.proxima ? formatSoles(resumen.proxima.cuota) : SIN_DATO}
              sub={resumen.proxima ? resumen.proxima.fecha : "Préstamo pagado"}
            />
          </dl>
          <div
            role="progressbar"
            aria-label={`Cuotas pagadas de ${prestamo.descripcion}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progreso * 100)}
            className="h-2 overflow-hidden rounded-md bg-pc-border-soft"
          >
            <span className="block h-full rounded-md bg-pc-primary" style={{ width: `${progreso * 100}%` }} />
          </div>
          <AdminTable
            caption={`Cuotas del préstamo ${prestamo.descripcion}`}
            ordenable={false}
            maxHeight={320}
            rows={cuotas}
            getRowKey={(c) => String(c.n)}
            rowClassName={(c) => (c.estado === "proxima" ? "bg-pc-primary/5" : undefined)}
            columns={[
              { id: "n", header: "#", align: "left", cell: (c) => c.n },
              { id: "fecha", header: "Vence", align: "left", cell: (c) => c.fecha },
              { id: "cuota", header: "Cuota", cell: (c) => formatSolesDecimales(c.cuota) },
              { id: "capital", header: "Capital", cell: (c) => formatSolesDecimales(c.capital) },
              { id: "interes", header: "Interés", cell: (c) => formatSolesDecimales(c.interes) },
              { id: "saldo", header: "Saldo", cell: (c) => formatSolesDecimales(c.saldo) },
              {
                id: "estado",
                header: "Estado",
                align: "left",
                cell: (c) => (
                  <NivelPill nivel={c.estado === "pagada" ? "verde" : c.estado === "proxima" ? "ambar" : "sin-datos"}>
                    {c.estado === "pagada" ? "Pagada" : c.estado === "proxima" ? "Próxima" : "Pendiente"}
                  </NivelPill>
                ),
              },
            ]}
          />
        </div>
      )}
    </PanelCard>
  );
}
