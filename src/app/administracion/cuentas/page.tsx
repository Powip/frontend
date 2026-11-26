"use client";

/**
 * Cuentas por cobrar y pagar (FEAT-34: C7, M8). Fuera del menú hasta tener backend (D6).
 *
 * Por cobrar:
 * - Saldo en calle: pedidos hoy en tránsito (ASIGNADO_A_GUIA + EN_ENVIO + DESPACHADO, últimos 90 días) menos lo ya
 *   pagado, agrupado por courier (`usePedidosEnTransito`). Antes solo DESPACHADO (~25 % del saldo real).
 * - Cobros confirmados que el courier todavía no liquidó (`courierSettlementBalances`, ms-courier).
 * - Otras cuentas registradas a mano (solo en este navegador).
 * Por pagar: solo lo registrado a mano (solo en este navegador).
 *
 * Es una foto de hoy: no depende del periodo elegido. Ya no hay «vencidas» ni «próximas»: el vencimiento es texto
 * libre y esas secciones salían siempre vacías.
 */

import { useQuery } from "@tanstack/react-query";
import { Check, Plus } from "lucide-react";
import Link from "next/link";
import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getCourierSettlements, settlementMoney } from "@/services/courierSettlementsService";
import { cn } from "@/lib/utils";
import { NivelPill } from "../_components/nivel";
import {
  AdminTable,
  Aviso,
  claseBotonPrimario,
  claseBotonSecundario,
  claseInput,
  formatNumber,
  formatSoles,
  formatSolesDecimales,
  KpiCard,
  PanelCard,
  PanelEmpty,
  PanelError,
  PanelSkeleton,
  SIN_DATO,
} from "../_components/ui";
import { courierSettlementBalances } from "../_lib/courierSettlementBalances";
import {
  type CuentaManual,
  saldoEnCallePorCourier,
  totalCuentas,
  useCuentasHistorial,
  useCuentasManualCobrar,
  useCuentasManualPagar,
} from "../_lib/cuentasStorage";
import { etiquetaMes, partes } from "../_lib/periodo";
import { DIAS_EN_TRANSITO, useAdminContexto, usePedidosEnTransito } from "../_lib/useResultados";

type TipoCuenta = "cobrar" | "pagar";

const FORM_VACIO = { tipo: "pagar" as TipoCuenta, concepto: "", descripcion: "", monto: "", vencimiento: "" };

export default function CuentasPage() {
  const { auth } = useAuth();
  const { companyId, hoy } = useAdminContexto();
  const transito = usePedidosEnTransito();

  const settlementQuery = useQuery({
    queryKey: ["courier-settlements", companyId, auth?.user?.id],
    queryFn: ({ signal }) => getCourierSettlements(companyId, signal),
    enabled: !!companyId && !!auth?.user?.id,
    retry: false,
  });
  const balances = useMemo(
    () => courierSettlementBalances(settlementQuery.data?.collections ?? []),
    [settlementQuery.data],
  );
  const porLiquidarPen = balances.filter((b) => b.currency === "PEN").reduce((s, b) => s + b.remainingAmount, 0);
  const otrasMonedas = [...new Set(balances.filter((b) => b.currency !== "PEN").map((b) => b.currency))];

  const [cobrarManual, setCobrarManual] = useCuentasManualCobrar(companyId);
  const [pagarManual, setPagarManual] = useCuentasManualPagar(companyId);
  const [historial, setHistorial] = useCuentasHistorial(companyId);
  const [vista, setVista] = useState<"abiertas" | "historial">("abiertas");
  const [form, setForm] = useState<typeof FORM_VACIO | null>(null);

  const porCourier = useMemo(() => saldoEnCallePorCourier(transito.pedidos), [transito.pedidos]);
  const totalCobrarManual = totalCuentas(cobrarManual);
  const totalPagar = totalCuentas(pagarManual);

  function marcar(tipo: TipoCuenta, cuenta: CuentaManual) {
    if (tipo === "cobrar") setCobrarManual((prev) => prev.filter((c) => c.id !== cuenta.id));
    else setPagarManual((prev) => prev.filter((c) => c.id !== cuenta.id));
    setHistorial((prev) => [
      {
        id: `h-${Date.now()}`,
        mes: hoy.slice(0, 7),
        tipo: tipo === "cobrar" ? "ingreso" : "egreso",
        concepto: cuenta.concepto,
        monto: cuenta.monto,
      },
      ...prev,
    ]);
    toast.success(`${tipo === "cobrar" ? "Cobrado" : "Pagado"}: ${formatSolesDecimales(cuenta.monto)}`);
  }

  function agregar(evento: FormEvent) {
    evento.preventDefault();
    if (!form) return;
    const monto = Number(form.monto.replace(",", "."));
    if (!form.concepto.trim() || !Number.isFinite(monto) || monto <= 0) {
      toast.error("Completa el concepto y un monto mayor a 0");
      return;
    }
    const cuenta: CuentaManual = {
      id: `m-${Date.now()}`,
      concepto: form.concepto.trim(),
      descripcion: form.descripcion.trim(),
      monto,
      vencimiento: form.vencimiento.trim(),
    };
    if (form.tipo === "cobrar") setCobrarManual((prev) => [...prev, cuenta]);
    else setPagarManual((prev) => [...prev, cuenta]);
    setForm(null);
    toast.success("Cuenta agregada en este navegador");
  }

  const historialOrdenado = useMemo(() => [...historial].sort((a, b) => b.mes.localeCompare(a.mes)), [historial]);
  const cobrado = historial.filter((m) => m.tipo === "ingreso").reduce((s, m) => s + m.monto, 0);
  const pagado = historial.filter((m) => m.tipo === "egreso").reduce((s, m) => s + m.monto, 0);

  return (
    <div className="space-y-3.5">
      <p className="text-xs text-pc-text-muted">
        Foto de hoy: no depende del periodo elegido arriba.
      </p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="En calle"
          loading={transito.cargando}
          value={formatSoles(transito.saldo)}
          sub={`${formatNumber(transito.pedidos.length)} pedidos en tránsito, lo que falta cobrar`}
        />
        <KpiCard
          label="Courier por liquidar"
          loading={settlementQuery.isLoading}
          value={settlementQuery.isError ? SIN_DATO : formatSoles(porLiquidarPen)}
          sub={
            settlementQuery.isError
              ? "No se pudo consultar"
              : `Cobros confirmados que el courier aún no deposita${otrasMonedas.length ? ` (además en ${otrasMonedas.join(", ")})` : ""}`
          }
        />
        <KpiCard
          label="Otras por cobrar"
          value={formatSoles(totalCobrarManual)}
          sub="Registro manual de este navegador"
        />
        <KpiCard label="Por pagar" value={formatSoles(totalPagar)} sub="Registro manual de este navegador" />
      </div>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[3fr_2fr]">
        <PanelCard
          titulo="Saldo en calle por courier"
          subtitulo={`Pedidos asignados a guía, en envío o despachados, creados en los últimos ${DIAS_EN_TRANSITO} días. Lo pagado por adelantado no suma.`}
        >
          {transito.error ? (
            <PanelError error={transito.error as Error} />
          ) : transito.cargando ? (
            <PanelSkeleton variant="tabla" label="saldo en calle" />
          ) : (
            <AdminTable
              caption="Saldo por cobrar de los pedidos en tránsito, por courier"
              emptyMessage="No hay pedidos en tránsito"
              rows={porCourier}
              getRowKey={(fila) => fila.clave}
              columns={[
                { id: "courier", header: "Courier", align: "left", cell: (fila) => fila.courier, sortValue: (fila) => fila.courier },
                { id: "pedidos", header: "Pedidos", cell: (fila) => formatNumber(fila.pedidos), sortValue: (fila) => fila.pedidos },
                { id: "conSaldo", header: "Con saldo", cell: (fila) => formatNumber(fila.conSaldo), sortValue: (fila) => fila.conSaldo },
                { id: "saldo", header: "Por cobrar", cell: (fila) => formatSoles(fila.saldo), sortValue: (fila) => fila.saldo },
              ]}
              footer={{
                courier: "Total",
                pedidos: formatNumber(transito.pedidos.length),
                conSaldo: formatNumber(porCourier.reduce((s, f) => s + f.conSaldo, 0)),
                saldo: formatSoles(transito.saldo),
              }}
            />
          )}
          <p className="mt-2 text-[11px] text-pc-text-muted">
            Hay pedidos que quedan «en envío» por meses porque nadie los cerró: si el saldo parece alto, revísalos en
            Operaciones.
          </p>
        </PanelCard>

        <PanelCard
          titulo="Cobrado por el courier, sin liquidar"
          subtitulo="Cobros confirmados que el courier todavía te debe, por moneda. Los depósitos en revisión siguen pendientes hasta aprobarse."
          acciones={
            <Link href="/operaciones/liquidaciones" className={claseBotonSecundario}>
              Ver liquidaciones
            </Link>
          }
        >
          {settlementQuery.isLoading ? (
            <PanelSkeleton variant="tabla" label="liquidaciones de courier" />
          ) : settlementQuery.isError ? (
            <div className="space-y-2">
              <Aviso tono="bad">No se pudieron consultar los saldos del courier.</Aviso>
              <button type="button" className={claseBotonSecundario} onClick={() => settlementQuery.refetch()}>
                Reintentar
              </button>
            </div>
          ) : balances.length === 0 ? (
            <PanelEmpty mensaje="No hay cobros confirmados pendientes de liquidar" />
          ) : (
            <ul className="space-y-2">
              {balances.map((balance) => (
                <li
                  key={balance.key}
                  className="flex items-start justify-between gap-3 rounded-xl border border-pc-border-soft px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-pc-text">{balance.courierName}</p>
                    <p className="text-xs text-pc-text-muted">
                      {formatNumber(balance.collections)} cobros · en revisión{" "}
                      {settlementMoney(balance.reservedAmount, balance.currency)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-pc-text">
                    {settlementMoney(balance.remainingAmount, balance.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </PanelCard>
      </div>

      <PanelCard
        titulo="Registro manual"
        subtitulo="Cuentas que anotas a mano. Se guardan solo en este navegador: otro usuario u otra computadora no las ve."
        acciones={
          <>
            <div role="group" aria-label="Ver cuentas" className="inline-flex rounded-lg border border-pc-border p-0.5">
              {(
                [
                  ["abiertas", "Abiertas"],
                  ["historial", "Historial"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={vista === id}
                  onClick={() => setVista(id)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-pc-primary",
                    vista === id ? "bg-pc-primary text-pc-on-fill" : "text-pc-text-muted hover:text-pc-primary",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {!form && (
              <button type="button" className={claseBotonPrimario} onClick={() => setForm({ ...FORM_VACIO })}>
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Agregar cuenta
              </button>
            )}
          </>
        }
      >
        {form && (
          <form
            onSubmit={agregar}
            aria-label="Agregar cuenta"
            className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-pc-border-soft bg-pc-surface-muted p-3 sm:grid-cols-2 lg:grid-cols-5"
          >
            <Campo label="Tipo" id="cuenta-tipo">
              <select
                id="cuenta-tipo"
                className={cn(claseInput, "w-full")}
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoCuenta })}
              >
                <option value="pagar">Por pagar</option>
                <option value="cobrar">Por cobrar</option>
              </select>
            </Campo>
            <Campo label="Concepto" id="cuenta-concepto">
              <input
                id="cuenta-concepto"
                className={cn(claseInput, "w-full")}
                value={form.concepto}
                onChange={(e) => setForm({ ...form, concepto: e.target.value })}
              />
            </Campo>
            <Campo label="Detalle" id="cuenta-detalle">
              <input
                id="cuenta-detalle"
                className={cn(claseInput, "w-full")}
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              />
            </Campo>
            <Campo label="Monto (S/)" id="cuenta-monto">
              <input
                id="cuenta-monto"
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                className={cn(claseInput, "w-full")}
                value={form.monto}
                onChange={(e) => setForm({ ...form, monto: e.target.value })}
              />
            </Campo>
            <Campo label="Vencimiento o nota" id="cuenta-vencimiento">
              <input
                id="cuenta-vencimiento"
                placeholder="Ej: a fin de mes"
                className={cn(claseInput, "w-full")}
                value={form.vencimiento}
                onChange={(e) => setForm({ ...form, vencimiento: e.target.value })}
              />
            </Campo>
            <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-5">
              <button type="submit" className={claseBotonPrimario}>
                Guardar
              </button>
              <button type="button" className={claseBotonSecundario} onClick={() => setForm(null)}>
                Cancelar
              </button>
            </div>
          </form>
        )}

        {vista === "abiertas" ? (
          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
            <ListaCuentas
              titulo="Por cobrar"
              tipo="cobrar"
              cuentas={cobrarManual}
              onMarcar={(c) => marcar("cobrar", c)}
            />
            <ListaCuentas titulo="Por pagar" tipo="pagar" cuentas={pagarManual} onMarcar={(c) => marcar("pagar", c)} />
          </div>
        ) : (
          <AdminTable
            caption="Historial de cuentas marcadas como cobradas o pagadas"
            emptyMessage="Todavía no marcaste ninguna cuenta como cobrada o pagada"
            rows={historialOrdenado}
            getRowKey={(m) => m.id}
            columns={[
              {
                id: "mes",
                header: "Mes",
                align: "left",
                cell: (m) => {
                  const [a, mes] = partes(`${m.mes}-01`);
                  return <span className="capitalize">{etiquetaMes(a, mes, true)}</span>;
                },
                sortValue: (m) => m.mes,
              },
              {
                id: "tipo",
                header: "Tipo",
                align: "left",
                cell: (m) => (
                  <NivelPill nivel={m.tipo === "ingreso" ? "verde" : "rojo"}>
                    {m.tipo === "ingreso" ? "Cobrado" : "Pagado"}
                  </NivelPill>
                ),
              },
              { id: "concepto", header: "Concepto", align: "left", cell: (m) => m.concepto },
              {
                id: "monto",
                header: "Monto",
                cell: (m) => (
                  <span className={m.tipo === "ingreso" ? "text-pc-ok" : "text-pc-bad"}>
                    {m.tipo === "ingreso" ? "+" : "−"}
                    {formatSolesDecimales(m.monto)}
                  </span>
                ),
                sortValue: (m) => (m.tipo === "ingreso" ? m.monto : -m.monto),
              },
            ]}
            footer={{
              mes: "Neto",
              concepto: `Cobrado ${formatSoles(cobrado)} · pagado ${formatSoles(pagado)}`,
              monto: formatSolesDecimales(cobrado - pagado),
            }}
          />
        )}
      </PanelCard>
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

function ListaCuentas({
  titulo,
  tipo,
  cuentas,
  onMarcar,
}: {
  titulo: string;
  tipo: TipoCuenta;
  cuentas: CuentaManual[];
  onMarcar: (cuenta: CuentaManual) => void;
}) {
  return (
    <section aria-label={`${titulo} (registro manual)`} className="min-w-0">
      <h4 className="mb-2 flex items-baseline justify-between gap-2 text-xs font-bold uppercase tracking-[0.08em] text-pc-text-muted">
        {titulo}
        <span className="tabular-nums text-pc-text">{formatSoles(totalCuentas(cuentas))}</span>
      </h4>
      {cuentas.length === 0 ? (
        <PanelEmpty mensaje={tipo === "cobrar" ? "Nada anotado por cobrar" : "Nada anotado por pagar"} />
      ) : (
        <ul className="space-y-2">
          {cuentas.map((cuenta) => (
            <li
              key={cuenta.id}
              className="flex items-center gap-3 rounded-xl border border-pc-border-soft px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-pc-text">{cuenta.concepto}</p>
                {(cuenta.descripcion || cuenta.vencimiento) && (
                  <p className="truncate text-xs text-pc-text-muted">
                    {[cuenta.descripcion, cuenta.vencimiento].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <span
                className={cn(
                  "shrink-0 text-sm font-bold tabular-nums",
                  tipo === "cobrar" ? "text-pc-ok" : "text-pc-bad",
                )}
              >
                {formatSolesDecimales(cuenta.monto)}
              </span>
              <button
                type="button"
                className={claseBotonSecundario}
                onClick={() => onMarcar(cuenta)}
                aria-label={`Marcar ${cuenta.concepto} como ${tipo === "cobrar" ? "cobrada" : "pagada"}`}
              >
                <Check className="h-3.5 w-3.5" aria-hidden />
                {tipo === "cobrar" ? "Cobrado" : "Pagado"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
