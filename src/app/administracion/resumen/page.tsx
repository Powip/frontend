"use client";

/**
 * Resumen — §7 doc técnica.
 *
 * CONECTADO A DATOS REALES: toda la cascada de utilidad (ventas, COGS,
 * merma, fees marketplace, courier integrado, gastos operativos, comisión
 * POWIP, IGV) sale de `useAdminOrders` / `useAdminGastos` /
 * `useAdminShrinkageSummary` / `useAdminCourierCost` — igual que antes.
 *
 * SOLUCIÓN PUENTE (localStorage, sin backend): Inversión ADS, CPV neto y
 * ROAS POWIP del hero y del semáforo COD salen de la inversión registrada en
 * Pauta por canal (`usePautaEntries`), filtrada al periodo del topbar — y la
 * meta mensual de la alerta de avance sale de la meta anual (÷12) que se
 * edita en Resumen Anual (`useMetasAnuales`). Ambas viven en `localStorage`
 * del navegador — no hay backend detrás todavía, ver aviso en la UI.
 *
 * QUITADO — Tasa de confirmación (uno de los 4 indicadores del semáforo COD
 * del doc, §7.7): `OrderStatus` no distingue "confirmado" de otros estados
 * y no hay forma de resolverlo sin un cambio de backend, así que el
 * semáforo se quedó en 3 indicadores (CPV, ROAS, margen neto) en vez de
 * mostrar una card que siempre va a decir "Sin dato". Vuelve a agregarse
 * cuando exista ese estado en `OrderStatus`.
 */

import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminPeriod } from "@/contexts/AdminPeriodContext";
import {
  useAdminOrders,
  useAdminGastos,
  useAdminShrinkageSummary,
  useAdminCourierCost,
} from "@/hooks/useAdminQueries";
import { updateCompany as updateCompanyApi } from "@/services/companyService";
import { IGastoOperativo } from "@/interfaces/IAdmin";
import { calcularPnL } from "../_lib/pnl";
import { usePautaEntries, totalInvertidoEnRango } from "../_lib/pautaStorage";
import { useMetasAnuales } from "../_lib/metasStorage";
import { paidAmount } from "../_lib/realData";
import { NivelDot, NivelPill, type Nivel } from "../_components/nivel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

function shiftPeriod(fromDate: string, toDate: string) {
  const from = new Date(fromDate);
  const to = new Date(toDate);
  const diffDays = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  const prevTo = new Date(from);
  prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevFrom.getDate() - diffDays + 1);
  return {
    prevFrom: prevFrom.toISOString().slice(0, 10),
    prevTo: prevTo.toISOString().slice(0, 10),
  };
}

function pctChange(current: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((current - prev) / Math.abs(prev)) * 100;
}

function fmt(n: number) {
  // n === 0 también atrapa -0 (en JS, -0 === 0 es true) — evita mostrar "S/ -0.00".
  const v = n === 0 ? 0 : n;
  return `S/ ${v.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmt0(n: number) {
  return `S/ ${n.toLocaleString("es-PE", { maximumFractionDigits: 0 })}`;
}

function DeltaBadge({
  current,
  prev,
}: {
  current: number;
  prev: number | null;
}) {
  if (prev === null) return null;
  const delta = pctChange(current, prev);
  if (delta === null) return null;
  const abs = Math.abs(delta).toFixed(1);
  if (delta > 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-green-600">
        <TrendingUp className="h-3 w-3" />+{abs}%
      </span>
    );
  if (delta < 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-destructive">
        <TrendingDown className="h-3 w-3" />-{abs}%
      </span>
    );
  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
      <Minus className="h-3 w-3" />
      0%
    </span>
  );
}

/** Peor de varios niveles — ignora "sin-datos" (§7.7: el color final es el peor de los indicadores CON dato). */
function peorNivel(niveles: (Nivel | null)[]): Nivel {
  const validos = niveles.filter(
    (n): n is Nivel => n !== null && n !== "sin-datos",
  );
  if (validos.length === 0) return "sin-datos";
  if (validos.includes("rojo")) return "rojo";
  if (validos.includes("ambar")) return "ambar";
  return "verde";
}

export default function ResumenAdminPage() {
  const { auth, updateCompany } = useAuth();
  const { fromDate, toDate } = useAdminPeriod();
  const [editingRate, setEditingRate] = useState(false);
  const [rateInput, setRateInput] = useState("");
  const [savingRate, setSavingRate] = useState(false);

  const companyId = auth?.company?.id ?? "";
  const token = auth?.accessToken ?? "";
  const storeIds = useMemo(
    () => (auth?.company?.stores ?? []).map((s) => s.id),
    [auth?.company?.stores],
  );
  const ivaRate = (auth?.company?.iva ?? 18) / 100;
  const powipRate = auth?.company?.powipCommissionRate ?? 0.005;
  const { prevFrom, prevTo } = useMemo(
    () => shiftPeriod(fromDate, toDate),
    [fromDate, toDate],
  );

  const [pautaEntries] = usePautaEntries(companyId);
  const anioPeriodo = new Date(fromDate).getFullYear();
  const [metas] = useMetasAnuales(companyId, anioPeriodo);

  // Período actual
  const { data: orders = [], isLoading: l1 } = useAdminOrders(
    companyId,
    fromDate,
    toDate,
  );
  const { data: gastos = [], isLoading: l2 } = useAdminGastos(
    companyId,
    fromDate,
    toDate,
    token,
  );
  const { data: merma, isLoading: l3 } = useAdminShrinkageSummary(
    companyId,
    fromDate,
    toDate,
    token,
  );
  const { data: courierCost = 0, isLoading: l4 } = useAdminCourierCost(
    storeIds,
    fromDate,
    toDate,
    token,
  );

  // Período anterior
  const { data: ordersPrev = [], isLoading: l5 } = useAdminOrders(
    companyId,
    prevFrom,
    prevTo,
  );
  const { data: gastosPrev = [], isLoading: l6 } = useAdminGastos(
    companyId,
    prevFrom,
    prevTo,
    token,
  );
  const { data: mermaPrev, isLoading: l7 } = useAdminShrinkageSummary(
    companyId,
    prevFrom,
    prevTo,
    token,
  );
  const { data: courierCostPrev = 0, isLoading: l8 } = useAdminCourierCost(
    storeIds,
    prevFrom,
    prevTo,
    token,
  );

  const loading = l1 || l2 || l3 || l4 || l5 || l6 || l7 || l8;

  const pnl = useMemo(() => {
    if (!merma) return null;
    return calcularPnL(
      orders as any[],
      gastos as IGastoOperativo[],
      merma,
      ivaRate,
      courierCost as number,
      powipRate,
    );
  }, [orders, gastos, merma, courierCost, ivaRate, powipRate]);

  const pnlPrev = useMemo(() => {
    if (!mermaPrev) return null;
    return calcularPnL(
      ordersPrev as any[],
      gastosPrev as IGastoOperativo[],
      mermaPrev,
      ivaRate,
      courierCostPrev as number,
      powipRate,
    );
  }, [ordersPrev, gastosPrev, mermaPrev, courierCostPrev, ivaRate, powipRate]);

  // ── Datos derivados para hero + semáforo COD + "resumen del mes" (§7, §7.7) ──
  const derivados = useMemo(() => {
    const todas = orders as any[];
    const entregadas = todas.filter((o) => o.status === "ENTREGADO");
    const unidadesEntregadas = entregadas.reduce(
      (s, o) =>
        s + (o.itemCount || (Array.isArray(o.items) ? o.items.length : 1)),
      0,
    );
    const inversionAds = totalInvertidoEnRango(pautaEntries, fromDate, toDate);
    const cpvNeto =
      unidadesEntregadas > 0 && inversionAds > 0
        ? inversionAds / unidadesEntregadas
        : null;
    const roasPowip =
      inversionAds > 0 ? (pnl?.ventasBrutas ?? 0) / inversionAds : null;
    const adelantosEnCaja = todas
      .filter((o) => o.status !== "ENTREGADO" && o.status !== "ANULADO")
      .reduce((s, o) => s + paidAmount(o), 0);

    const totalCogs = entregadas.reduce(
      (s, o) => s + Number(o.costAmount || 0),
      0,
    );
    const precioProm =
      unidadesEntregadas > 0
        ? entregadas.reduce((s, o) => s + Number(o.grandTotal || 0), 0) /
          unidadesEntregadas
        : 0;
    const costoVarUnit =
      unidadesEntregadas > 0 ? totalCogs / unidadesEntregadas : 0;
    const margenContribucion = precioProm - costoVarUnit;
    const costosFijos = (gastos as any[]).reduce(
      (s, g) => s + Number(g.monto || 0),
      0,
    );
    const puntoEquilibrioUds =
      margenContribucion > 0 ? Math.ceil(costosFijos / margenContribucion) : 0;

    return {
      pedidosEntregados: entregadas.length,
      pedidosTotales: todas.length,
      unidadesEntregadas,
      inversionAds,
      cpvNeto,
      roasPowip,
      adelantosEnCaja,
      puntoEquilibrioUds,
    };
  }, [orders, gastos, pautaEntries, fromDate, toDate, pnl]);

  const metaVentasMes = metas.ventasAnual / 12;
  const metaProfitMes = metas.profitAnual / 12;

  const semaforoCod = useMemo(() => {
    if (!pnl) return [];
    const nivelCpv: Nivel =
      derivados.cpvNeto == null
        ? "sin-datos"
        : derivados.cpvNeto < 18
          ? "verde"
          : derivados.cpvNeto <= 22
            ? "ambar"
            : "rojo";
    const nivelRoas: Nivel =
      derivados.roasPowip == null
        ? "sin-datos"
        : derivados.roasPowip > 4
          ? "verde"
          : derivados.roasPowip >= 3
            ? "ambar"
            : "rojo";
    const nivelMargen: Nivel =
      pnl.margenNeto > 28 ? "verde" : pnl.margenNeto >= 20 ? "ambar" : "rojo";
    return [
      {
        nombre: "CPV neto total",
        valor:
          derivados.cpvNeto != null ? fmt0(derivados.cpvNeto) : "Sin inversión",
        umbral: "< S/18 · 18–22 · > 22",
        nivel: nivelCpv,
      },
      {
        nombre: "ROAS POWIP",
        valor:
          derivados.roasPowip != null
            ? `${derivados.roasPowip.toFixed(1)}×`
            : "Sin inversión",
        umbral: "> 4.0× · 3–4× · < 3×",
        nivel: nivelRoas,
      },
      {
        nombre: "Margen neto",
        valor: `${pnl.margenNeto.toFixed(1)}%`,
        umbral: "> 28% · 20–28% · < 20%",
        nivel: nivelMargen,
      },
    ];
  }, [pnl, derivados]);

  const semaforoFinal = peorNivel(semaforoCod.map((s) => s.nivel));
  const indicadoresEnAlerta = semaforoCod.filter(
    (s) => s.nivel === "ambar" || s.nivel === "rojo",
  ).length;

  const handleSaveRate = async () => {
    if (!companyId || !token) return;
    const pct = parseFloat(rateInput);
    if (isNaN(pct) || pct < 0 || pct > 100) return;
    setSavingRate(true);
    try {
      await updateCompanyApi(companyId, token, {
        powipCommissionRate: pct / 100,
      });
      if (auth?.company?.id)
        updateCompany({
          ...auth.company,
          id: auth.company.id,
          powipCommissionRate: pct / 100,
        });
      setEditingRate(false);
    } catch {
      // fallo silencioso — el valor anterior se mantiene
    } finally {
      setSavingRate(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!pnl) return null;

  // Sin entregas todavía ≠ negocio en riesgo — en COD el dinero/margen real
  // no existe hasta ENTREGADO (§3 doc), así que "0 entregados pero X en
  // camino" es una foto normal de inicio de periodo, no una alerta roja.
  const sinEntregasConPedidos =
    derivados.pedidosEntregados === 0 && derivados.pedidosTotales > 0;

  const heroTone = sinEntregasConPedidos
    ? "from-slate-600 to-slate-800"
    : semaforoFinal === "verde"
      ? "from-emerald-600 to-emerald-800"
      : semaforoFinal === "ambar"
        ? "from-amber-600 to-amber-800"
        : semaforoFinal === "rojo"
          ? "from-red-600 to-red-800"
          : "from-slate-700 to-slate-900";
  const heroTitulo = sinEntregasConPedidos
    ? `⏳ Sin entregas todavía — ${derivados.pedidosTotales} pedido${derivados.pedidosTotales === 1 ? "" : "s"} en camino`
    : semaforoFinal === "verde"
      ? "🟢 Negocio sano"
      : semaforoFinal === "ambar"
        ? "🟡 Atención — 1+ indicador en alerta"
        : semaforoFinal === "rojo"
          ? "🔴 Negocio en riesgo"
          : "⚪ Sin datos suficientes";

  const avanceVentasPct =
    metaVentasMes > 0 ? (pnl.ventasBrutas / metaVentasMes) * 100 : null;
  const avanceProfitPct =
    metaProfitMes > 0 ? (pnl.utilidadNeta / metaProfitMes) * 100 : null;

  const kpis = [
    {
      label: "Ventas brutas",
      valor: pnl.ventasBrutas,
      prev: pnlPrev?.ventasBrutas ?? null,
    },
    {
      label: "Utilidad bruta real",
      valor: pnl.utilidadBruta,
      pct: pnl.margenBruto,
      prev: pnlPrev?.utilidadBruta ?? null,
    },
    {
      label: "Utilidad operativa",
      valor: pnl.utilidadOperativa,
      pct: pnl.margenOperativo,
      prev: pnlPrev?.utilidadOperativa ?? null,
    },
    {
      label: "Utilidad neta",
      valor: pnl.utilidadNeta,
      pct: pnl.margenNeto,
      prev: pnlPrev?.utilidadNeta ?? null,
    },
  ];

  const cascada = [
    {
      label: "Ventas brutas",
      valor: pnl.ventasBrutas,
      tipo: "positivo" as const,
    },
    {
      label: "− COGS (costo de productos)",
      valor: -pnl.cogs,
      tipo: "negativo" as const,
    },
    {
      label: `− Merma de inventario (${pnl.mermaUnidades} u.)`,
      valor: -pnl.mermaCosto,
      tipo: "negativo" as const,
    },
    {
      label: "= Utilidad bruta real",
      valor: pnl.utilidadBruta,
      tipo: "subtotal" as const,
      pct: pnl.margenBruto,
    },
    {
      label: "− Fees marketplace",
      valor: -pnl.feesMarketplace,
      tipo: "negativo" as const,
    },
    {
      label: "− Courier integrado (Shalom/Olva)",
      valor: -pnl.courierIntegrado,
      tipo: "negativo" as const,
    },
    {
      label: "− Publicidad",
      valor: -pnl.gastosMarketing,
      tipo: "negativo" as const,
    },
    {
      label: "− Personal / planilla",
      valor: -pnl.gastosPersonal,
      tipo: "negativo" as const,
    },
    {
      label: "− Courier propio",
      valor: -pnl.gastosCourierPropio,
      tipo: "negativo" as const,
    },
    {
      label: "− Herramientas + oficina",
      valor: -pnl.gastosHerramientas,
      tipo: "negativo" as const,
    },
    {
      label: "− Otros gastos",
      valor: -pnl.gastosOtros,
      tipo: "negativo" as const,
    },
    {
      label: "= Utilidad operativa",
      valor: pnl.utilidadOperativa,
      tipo: "subtotal" as const,
      pct: pnl.margenOperativo,
    },
    {
      label: `− Comisión PowIp (${((auth?.company?.powipCommissionRate ?? 0.005) * 100).toFixed(2)}%)`,
      valor: -pnl.comisionPowip,
      tipo: "negativo" as const,
      editable: true,
    },
    {
      label: `− IGV / IR estimado (${auth?.company?.iva ?? 18}%)`,
      valor: -pnl.igvEstimado,
      tipo: "negativo" as const,
    },
    {
      label: "= Utilidad neta",
      valor: pnl.utilidadNeta,
      tipo: "total" as const,
      pct: pnl.margenNeto,
    },
  ];

  const resumenMes = [
    {
      label: "Pedidos entregados",
      valor: String(derivados.pedidosEntregados),
      sub: `de ${derivados.pedidosTotales} registrados`,
    },
    {
      label: "Adelantos en caja",
      valor: fmt0(derivados.adelantosEnCaja),
      sub: "pasivo · no es utilidad",
    },
    {
      label: "Inversión ADS",
      valor: fmt0(derivados.inversionAds),
      sub:
        derivados.inversionAds > 0
          ? "registrada en Pauta por canal"
          : "sin registrar este periodo",
    },
    {
      label: "Punto de equilibrio",
      valor: `${derivados.puntoEquilibrioUds} uds`,
      sub:
        derivados.puntoEquilibrioUds > 0 && derivados.pedidosEntregados > 0
          ? `${(derivados.unidadesEntregadas / derivados.puntoEquilibrioUds).toFixed(1)}× superado`
          : "ver pestaña Equilibrio",
    },
  ];

  return (
    <div className="p-8 space-y-6">
      <div
        className={cn("rounded-2xl p-6 text-white bg-gradient-to-br", heroTone)}
      >
        <div className="flex justify-between items-start flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold">{heroTitulo}</h2>
            <p className="text-sm opacity-95 mt-1">
              {sinEntregasConPedidos ? (
                "Todavía no hay ventas reconocidas este periodo — en COD la venta cuenta recién cuando el pedido llega a Entregado, no antes."
              ) : (
                <>
                  Margen neto {pnl.margenNeto.toFixed(1)}% · CPV neto{" "}
                  {derivados.cpvNeto != null ? fmt0(derivados.cpvNeto) : "—"} ·
                  ROAS{" "}
                  {derivados.roasPowip != null
                    ? `${derivados.roasPowip.toFixed(1)}×`
                    : "—"}
                  {avanceVentasPct != null
                    ? avanceVentasPct >= 100
                      ? " · Cumpliendo meta"
                      : " · Por debajo de la meta"
                    : ""}
                </>
              )}
            </p>
          </div>
          <div className="text-right text-xs opacity-90">
            Periodo:{" "}
            <b>
              {fromDate} → {toDate}
            </b>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          <div className="bg-white/15 rounded-lg p-3">
            <p className="text-[11px] opacity-85">Ventas entregadas</p>
            <p className="text-lg font-bold mt-0.5">{fmt0(pnl.ventasBrutas)}</p>
          </div>
          <div className="bg-white/15 rounded-lg p-3">
            <p className="text-[11px] opacity-85">Ganancia neta</p>
            <p className="text-lg font-bold mt-0.5">{fmt0(pnl.utilidadNeta)}</p>
          </div>
          <div className="bg-white/15 rounded-lg p-3">
            <p className="text-[11px] opacity-85">Margen neto</p>
            <p className="text-lg font-bold mt-0.5">
              {pnl.margenNeto.toFixed(1)}%
            </p>
          </div>
          <div className="bg-white/15 rounded-lg p-3">
            <p className="text-[11px] opacity-85">Inversión ADS</p>
            <p className="text-lg font-bold mt-0.5">
              {fmt0(derivados.inversionAds)}
            </p>
          </div>
        </div>
      </div>

      {avanceVentasPct != null && (
        <div
          className={cn(
            "rounded-lg border p-3.5 text-sm",
            avanceVentasPct >= 100
              ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
              : "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300",
          )}
        >
          {avanceVentasPct >= 100 ? "✅" : "📈"} <b>Avance del mes:</b>{" "}
          {fmt0(pnl.ventasBrutas)} de meta {fmt0(metaVentasMes)} ={" "}
          <b>{avanceVentasPct.toFixed(1)}%</b>.{" "}
          {avanceVentasPct < 100
            ? `Faltan ${fmt0(Math.max(0, metaVentasMes - pnl.ventasBrutas))}. `
            : ""}
          {avanceProfitPct != null &&
            (avanceProfitPct >= 100
              ? `Meta de profit ya superada (${avanceProfitPct.toFixed(1)}%).`
              : `Meta de profit al ${avanceProfitPct.toFixed(1)}%.`)}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            📦 Semáforo COD del periodo{" "}
            <NivelPill nivel={semaforoFinal}>
              {semaforoFinal === "sin-datos"
                ? "Sin datos suficientes"
                : `${indicadoresEnAlerta} indicador${indicadoresEnAlerta === 1 ? "" : "es"} en alerta`}
            </NivelPill>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {semaforoCod.map((s) => (
              <div
                key={s.nombre}
                className={cn(
                  "rounded-lg border p-3",
                  s.nivel === "ambar" && "border-amber-300",
                  s.nivel === "rojo" && "border-red-300",
                )}
              >
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {s.nombre}
                  </span>
                  <NivelDot nivel={s.nivel} />
                </div>
                <p
                  className={cn(
                    "text-xl font-bold mt-1.5",
                    s.nivel === "ambar" && "text-amber-600",
                    s.nivel === "rojo" && "text-destructive",
                  )}
                >
                  {s.valor}
                </p>
                <p className="text-[10px] text-muted-foreground border-t border-dashed pt-1.5 mt-1.5">
                  {s.umbral}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {kpi.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold font-mono">{fmt(kpi.valor)}</p>
              <div className="flex items-center gap-2 mt-1">
                {kpi.pct !== undefined && (
                  <p className="text-xs text-muted-foreground">
                    {kpi.pct.toFixed(1)}% de margen
                  </p>
                )}
                <DeltaBadge current={kpi.valor} prev={kpi.prev} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              💰 Cascada de utilidad
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {cascada.map((row) => (
              <div
                key={row.label}
                className={`flex items-center justify-between px-3 py-2 rounded-md text-sm ${
                  row.tipo === "subtotal"
                    ? "bg-muted font-semibold"
                    : row.tipo === "total"
                      ? "bg-primary/10 font-bold text-primary"
                      : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={
                      row.tipo === "negativo" ? "text-muted-foreground" : ""
                    }
                  >
                    {row.label}
                  </span>
                  {(row as any).editable && !editingRate && (
                    <button
                      onClick={() => {
                        setRateInput(
                          (
                            (auth?.company?.powipCommissionRate ?? 0.005) * 100
                          ).toFixed(2),
                        );
                        setEditingRate(true);
                      }}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                  {(row as any).editable && editingRate && (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        value={rateInput}
                        onChange={(e) => setRateInput(e.target.value)}
                        className="h-6 w-20 text-xs px-1"
                        autoFocus
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={handleSaveRate}
                        disabled={savingRate}
                      >
                        <Check className="h-3 w-3 text-green-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setEditingRate(false)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {row.pct !== undefined && (
                    <span className="text-xs text-muted-foreground font-mono">
                      {row.pct.toFixed(1)}%
                    </span>
                  )}
                  <span
                    className={`font-mono ${row.valor < 0 ? "text-destructive" : row.tipo === "total" ? "text-primary" : ""}`}
                  >
                    {fmt(row.valor)}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Resumen del periodo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {resumenMes.map((r) => (
                <div key={r.label}>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {r.label}
                  </p>
                  <p className="text-xl font-bold font-mono mt-1">{r.valor}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {r.sub}
                  </p>
                </div>
              ))}
            </div>
            <div className="rounded-lg border bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 p-3 text-xs text-blue-800 dark:text-blue-300 mt-4">
              💡 Los adelantos entran a caja pero no son utilidad hasta que el
              pedido sea Entregado. Los ves separados en Flujo de Caja.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
