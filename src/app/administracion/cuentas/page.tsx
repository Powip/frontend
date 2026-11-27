"use client";

/**
 * Cuentas por cobrar y pagar (FEAT-34: C7, M8, Fase 3). Volvió al menú (Caja) al tener respaldo en el servidor.
 *
 * Por cobrar:
 * - Saldo en calle: pedidos hoy en tránsito (ASIGNADO_A_GUIA + EN_ENVIO + DESPACHADO, últimos 90 días) menos lo ya
 *   pagado, por courier (`usePedidosEnTransito`, calculado en ms-ventas; acá se juntan las grafías de un mismo
 *   courier). Antes solo DESPACHADO (~25 % del saldo real).
 * - Cobros confirmados que el courier todavía no liquidó (`courierSettlementBalances`, ms-courier).
 * - Otras cuentas registradas a mano (en el servidor: las ve todo el equipo).
 * Por pagar:
 * - Compras de inventario pendientes de pago (`/administracion/compras`, ms-logistics; Fase 3: antes no se veían).
 * - Lo registrado a mano.
 *
 * Es una foto de hoy: no depende del periodo elegido. El vencimiento de lo manual es una fecha (Fase 3): lo pendiente
 * con fecha pasada se marca «Vencida».
 */

import { useQuery } from "@tanstack/react-query";
import { Check, Plus, Trash2 } from "lucide-react";
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
import type { CuentaServidor, EstadoCompra } from "@/interfaces/IAdministracion";
import { textoDia } from "../_lib/capitalStorage";
import { courierSettlementBalances } from "../_lib/courierSettlementBalances";
import {
  cuentasAbiertas,
  cuentasSaldadas,
  estaVencida,
  saldoEnCallePorCourier,
  totalCuentas,
} from "../_lib/cuentasStorage";
import { mensajeError, useComprasAdministracion, useCuentasServidor } from "../_lib/datosServidor";
import { type DiaKey, esDiaKey, etiquetaMes, partes } from "../_lib/periodo";
import { DIAS_EN_TRANSITO, useAdminContexto, usePedidosEnTransito } from "../_lib/useResultados";

type TipoCuenta = "cobrar" | "pagar";

const FORM_VACIO = { tipo: "pagar" as TipoCuenta, concepto: "", descripcion: "", monto: "", vence: "" };

const ESTADO_COMPRA: Record<EstadoCompra, string> = {
  PEDIDA: "Pedida",
  RECIBIDA_PARCIAL: "Recibida en parte",
  RECIBIDA: "Recibida",
};

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

  // Las compras pendientes de pago son una foto de hoy: el rango solo es el que pide el endpoint.
  const compras = useComprasAdministracion(hoy, hoy);
  const comprasPorPagar = compras.data?.porPagar;

  const { query: cuentasQuery, crear, actualizar, borrar } = useCuentasServidor();
  const cobrarManual = useMemo(() => cuentasAbiertas(cuentasQuery.data, "cobrar"), [cuentasQuery.data]);
  const pagarManual = useMemo(() => cuentasAbiertas(cuentasQuery.data, "pagar"), [cuentasQuery.data]);
  const historial = useMemo(() => cuentasSaldadas(cuentasQuery.data), [cuentasQuery.data]);
  const [vista, setVista] = useState<"abiertas" | "historial">("abiertas");
  const [form, setForm] = useState<typeof FORM_VACIO | null>(null);

  const porCourier = useMemo(() => saldoEnCallePorCourier(transito.porCourier), [transito.porCourier]);
  const totalCobrarManual = totalCuentas(cobrarManual);
  const totalPagarManual = totalCuentas(pagarManual);
  const totalPagar = totalPagarManual + (comprasPorPagar?.monto ?? 0);

  function marcar(cuenta: CuentaServidor) {
    actualizar.mutate(
      { id: cuenta.id, cambios: { saldadaEn: hoy } },
      {
        onSuccess: () =>
          toast.success(`${cuenta.lado === "cobrar" ? "Cobrado" : "Pagado"}: ${formatSolesDecimales(cuenta.monto)}`),
        onError: (error) => toast.error(mensajeError(error, "No se pudo marcar la cuenta")),
      },
    );
  }

  function eliminar(cuenta: CuentaServidor) {
    borrar.mutate(cuenta.id, {
      onSuccess: () => toast.success(`Cuenta eliminada: ${cuenta.concepto}`),
      onError: (error) => toast.error(mensajeError(error, "No se pudo eliminar la cuenta")),
    });
  }

  function agregar(evento: FormEvent) {
    evento.preventDefault();
    if (!form) return;
    const monto = Number(form.monto.replace(",", "."));
    if (!form.concepto.trim() || !Number.isFinite(monto) || monto <= 0) {
      toast.error("Completa el concepto y un monto mayor a 0");
      return;
    }
    if (form.vence && !esDiaKey(form.vence)) {
      toast.error("La fecha de vencimiento no es válida");
      return;
    }
    crear.mutate(
      {
        lado: form.tipo,
        concepto: form.concepto.trim(),
        descripcion: form.descripcion.trim(),
        monto: Math.round(monto * 100) / 100,
        ...(form.vence ? { vence: form.vence } : {}),
      },
      {
        onSuccess: () => {
          setForm(null);
          toast.success("Cuenta agregada");
        },
        onError: (error) => toast.error(mensajeError(error, "No se pudo agregar la cuenta")),
      },
    );
  }

  const cobrado = historial.filter((m) => m.lado === "cobrar").reduce((s, m) => s + m.monto, 0);
  const pagado = historial.filter((m) => m.lado === "pagar").reduce((s, m) => s + m.monto, 0);

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
          sub={
            <>
              {formatNumber(transito.pedidos)} pedidos en tránsito, lo que falta cobrar
              <span className="block">
                Con guía {formatSoles(transito.porEstado.ASIGNADO_A_GUIA.saldo)} · en envío{" "}
                {formatSoles(transito.porEstado.EN_ENVIO.saldo)} · despachados{" "}
                {formatSoles(transito.porEstado.DESPACHADO.saldo)}
              </span>
            </>
          }
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
          loading={cuentasQuery.isLoading}
          value={formatSoles(totalCobrarManual)}
          sub="Registro manual"
        />
        <KpiCard
          label="Por pagar"
          loading={cuentasQuery.isLoading || compras.isLoading}
          value={formatSoles(totalPagar)}
          sub={
            compras.error
              ? `Registro manual ${formatSoles(totalPagarManual)} · no se pudieron consultar las compras`
              : `Compras de inventario ${formatSoles(comprasPorPagar?.monto ?? 0)} · registro manual ${formatSoles(totalPagarManual)}`
          }
        />
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
                pedidos: formatNumber(transito.pedidos),
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
        titulo="Compras de inventario por pagar"
        subtitulo="Compras registradas en Compras que todavía figuran como pendientes de pago (no dependen del periodo)."
        acciones={
          <Link href="/compras" className={claseBotonSecundario}>
            Ver compras
          </Link>
        }
      >
        {compras.error ? (
          <PanelError error={compras.error as Error} />
        ) : compras.isLoading ? (
          <PanelSkeleton variant="tabla" label="compras por pagar" />
        ) : (
          <AdminTable
            caption="Compras de inventario pendientes de pago"
            emptyMessage="No hay compras pendientes de pago"
            maxHeight={320}
            rows={comprasPorPagar?.lista ?? []}
            getRowKey={(c) => c.id}
            columns={[
              { id: "numero", header: "Compra", align: "left", cell: (c) => c.numero, sortValue: (c) => c.numero },
              {
                id: "proveedor",
                header: "Proveedor",
                align: "left",
                cell: (c) => c.proveedor || "Sin proveedor",
                sortValue: (c) => c.proveedor ?? "",
              },
              { id: "estado", header: "Estado", align: "left", cell: (c) => ESTADO_COMPRA[c.estado] ?? c.estado },
              {
                id: "vence",
                header: "Vence",
                align: "left",
                cell: (c) => (esDiaKey(c.vence) ? <TextoVence dia={c.vence} hoy={hoy} /> : SIN_DATO),
                sortValue: (c) => c.vence ?? "9999",
              },
              { id: "monto", header: "Monto", cell: (c) => formatSolesDecimales(c.monto), sortValue: (c) => c.monto },
            ]}
            footer={
              comprasPorPagar && comprasPorPagar.compras > 0
                ? {
                    numero: `${formatNumber(comprasPorPagar.compras)} compras`,
                    monto: formatSolesDecimales(comprasPorPagar.monto),
                  }
                : undefined
            }
          />
        )}
        <p className="mt-2 text-[11px] text-pc-text-muted">
          El monto es el total de la compra más sus gastos. Cuando la pagues, márcala como pagada en Compras.
        </p>
      </PanelCard>

      <PanelCard
        titulo="Registro manual"
        subtitulo="Cuentas que anotas a mano (préstamos a terceros, deudas con proveedores fuera de Compras…). Las ve todo el equipo con acceso a Finanzas."
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
            {!form && cuentasQuery.isSuccess && (
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
            <Campo label="Vence" id="cuenta-vence">
              <input
                id="cuenta-vence"
                type="date"
                className={cn(claseInput, "w-full")}
                value={form.vence}
                onChange={(e) => setForm({ ...form, vence: e.target.value })}
              />
            </Campo>
            <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-5">
              <button type="submit" className={claseBotonPrimario} disabled={crear.isPending}>
                {crear.isPending ? "Guardando…" : "Guardar"}
              </button>
              <button type="button" className={claseBotonSecundario} onClick={() => setForm(null)}>
                Cancelar
              </button>
            </div>
          </form>
        )}

        {cuentasQuery.error ? (
          <PanelError error={cuentasQuery.error as Error} />
        ) : cuentasQuery.isLoading ? (
          <PanelSkeleton variant="tabla" label="cuentas" />
        ) : vista === "abiertas" ? (
          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
            <ListaCuentas
              titulo="Por cobrar"
              tipo="cobrar"
              cuentas={cobrarManual}
              hoy={hoy}
              ocupado={actualizar.isPending || borrar.isPending}
              onMarcar={marcar}
              onEliminar={eliminar}
            />
            <ListaCuentas
              titulo="Por pagar"
              tipo="pagar"
              cuentas={pagarManual}
              hoy={hoy}
              ocupado={actualizar.isPending || borrar.isPending}
              onMarcar={marcar}
              onEliminar={eliminar}
            />
          </div>
        ) : (
          <AdminTable
            caption="Historial de cuentas marcadas como cobradas o pagadas"
            emptyMessage="Todavía no marcaste ninguna cuenta como cobrada o pagada"
            rows={historial}
            getRowKey={(m) => m.id}
            columns={[
              {
                id: "mes",
                header: "Mes",
                align: "left",
                cell: (m) => {
                  const [a, mes] = partes(m.saldadaEn as DiaKey);
                  return <span className="capitalize">{etiquetaMes(a, mes, true)}</span>;
                },
                sortValue: (m) => m.saldadaEn ?? "",
              },
              {
                id: "tipo",
                header: "Tipo",
                align: "left",
                cell: (m) => (
                  <NivelPill nivel={m.lado === "cobrar" ? "verde" : "rojo"}>
                    {m.lado === "cobrar" ? "Cobrado" : "Pagado"}
                  </NivelPill>
                ),
              },
              { id: "concepto", header: "Concepto", align: "left", cell: (m) => m.concepto },
              {
                id: "monto",
                header: "Monto",
                cell: (m) => (
                  <span className={m.lado === "cobrar" ? "text-pc-ok" : "text-pc-bad"}>
                    {m.lado === "cobrar" ? "+" : "−"}
                    {formatSolesDecimales(m.monto)}
                  </span>
                ),
                sortValue: (m) => (m.lado === "cobrar" ? m.monto : -m.monto),
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

/** «Vence 5 dic 2026», o «Vencida · 20 nov 2026» si ya pasó. */
function TextoVence({ dia, hoy }: { dia: DiaKey; hoy: string }) {
  const vencida = dia < hoy;
  return (
    <span className={cn(vencida && "font-semibold text-pc-bad")}>
      {vencida ? "Vencida · " : "Vence "}
      {textoDia(dia)}
    </span>
  );
}

function ListaCuentas({
  titulo,
  tipo,
  cuentas,
  hoy,
  ocupado,
  onMarcar,
  onEliminar,
}: {
  titulo: string;
  tipo: TipoCuenta;
  cuentas: CuentaServidor[];
  hoy: string;
  ocupado: boolean;
  onMarcar: (cuenta: CuentaServidor) => void;
  onEliminar: (cuenta: CuentaServidor) => void;
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
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-2",
                estaVencida(cuenta, hoy) ? "border-pc-bad/40" : "border-pc-border-soft",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-pc-text">{cuenta.concepto}</p>
                {(cuenta.descripcion || cuenta.vence) && (
                  <p className="truncate text-xs text-pc-text-muted">
                    {cuenta.descripcion}
                    {cuenta.descripcion && esDiaKey(cuenta.vence) && " · "}
                    {esDiaKey(cuenta.vence) && <TextoVence dia={cuenta.vence} hoy={hoy} />}
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
                disabled={ocupado}
                onClick={() => onMarcar(cuenta)}
                aria-label={`Marcar ${cuenta.concepto} como ${tipo === "cobrar" ? "cobrada" : "pagada"}`}
              >
                <Check className="h-3.5 w-3.5" aria-hidden />
                {tipo === "cobrar" ? "Cobrado" : "Pagado"}
              </button>
              <button
                type="button"
                className={claseBotonSecundario}
                disabled={ocupado}
                onClick={() => onEliminar(cuenta)}
                aria-label={`Eliminar ${cuenta.concepto}`}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
