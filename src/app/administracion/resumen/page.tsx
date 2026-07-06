"use client";

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
import { IGastoOperativo, IPnL } from "@/interfaces/IAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrendingUp, TrendingDown, Minus, Pencil, Check, X } from "lucide-react";

function calcularPnL(
  orders: any[],
  gastos: IGastoOperativo[],
  merma: { totalUnidades: number; costoEstimado: number },
  ivaRate: number,
  courierIntegrado: number = 0,
  powipRate: number = 0.005,
): IPnL {
  const entregadas = orders.filter((o) => o.status === "ENTREGADO");
  const ventasBrutas = entregadas.reduce((sum: number, o: any) => sum + (Number(o.grandTotal) || 0), 0);
  const cogs = entregadas.reduce((sum: number, o: any) => sum + (Number(o.costAmount) || 0), 0);
  const utilidadBruta = ventasBrutas - cogs - merma.costoEstimado;
  const margenBruto = ventasBrutas > 0 ? (utilidadBruta / ventasBrutas) * 100 : 0;
  const feesMarketplace = entregadas.reduce((sum: number, o: any) => sum + (Number(o.channelFee) || 0), 0);
  const gastosPlanilla = gastos.filter((g) => g.categoria === "PLANILLA").reduce((s, g) => s + Number(g.monto), 0);
  const gastosHerramientas = gastos.filter((g) => g.categoria === "HERRAMIENTAS").reduce((s, g) => s + Number(g.monto), 0);
  const gastosCourierPropio = gastos.filter((g) => g.categoria === "COURIER_PROPIO").reduce((s, g) => s + Number(g.monto), 0);
  const gastosMarketing = gastos.filter((g) => g.categoria === "PUBLICIDAD").reduce((s, g) => s + Number(g.monto), 0);
  const gastosOtros = gastos.filter((g) => g.categoria === "OTRO").reduce((s, g) => s + Number(g.monto), 0);
  const totalGastosOperativos = feesMarketplace + gastosPlanilla + gastosHerramientas + gastosCourierPropio + gastosMarketing + gastosOtros + courierIntegrado;
  const utilidadOperativa = utilidadBruta - totalGastosOperativos;
  const margenOperativo = ventasBrutas > 0 ? (utilidadOperativa / ventasBrutas) * 100 : 0;
  const comisionPowip = ventasBrutas * powipRate;
  const igvEstimado = utilidadOperativa > 0 ? (utilidadOperativa - comisionPowip) * ivaRate : 0;
  const utilidadNeta = utilidadOperativa - comisionPowip - igvEstimado;
  const margenNeto = ventasBrutas > 0 ? (utilidadNeta / ventasBrutas) * 100 : 0;
  return {
    ventasBrutas, cogs, utilidadBruta, margenBruto,
    gastosMarketing, gastosPersonal: gastosPlanilla,
    gastosHerramientas, gastosCourierPropio, gastosOtros,
    feesMarketplace, courierIntegrado,
    mermaUnidades: merma.totalUnidades, mermaCosto: merma.costoEstimado,
    totalGastosOperativos,
    utilidadOperativa, margenOperativo,
    comisionPowip, igvEstimado,
    utilidadNeta, margenNeto,
  };
}

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
  return `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function DeltaBadge({ current, prev }: { current: number; prev: number | null }) {
  if (prev === null) return null;
  const delta = pctChange(current, prev);
  if (delta === null) return null;
  const abs = Math.abs(delta).toFixed(1);
  if (delta > 0) return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-green-600">
      <TrendingUp className="h-3 w-3" />+{abs}%
    </span>
  );
  if (delta < 0) return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-destructive">
      <TrendingDown className="h-3 w-3" />-{abs}%
    </span>
  );
  return <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground"><Minus className="h-3 w-3" />0%</span>;
}

export default function ResumenAdminPage() {
  const { auth, updateCompany } = useAuth();
  const { fromDate, toDate } = useAdminPeriod();
  const [editingRate, setEditingRate] = useState(false);
  const [rateInput, setRateInput] = useState("");
  const [savingRate, setSavingRate] = useState(false);

  const companyId = auth?.company?.id ?? "";
  const storeIds = useMemo(() => (auth?.company?.stores ?? []).map((s) => s.id), [auth?.company?.stores]);
  const ivaRate = (auth?.company?.iva ?? 18) / 100;
  const powipRate = auth?.company?.powipCommissionRate ?? 0.005;
  const { prevFrom, prevTo } = useMemo(() => shiftPeriod(fromDate, toDate), [fromDate, toDate]);

  // Período actual
  const { data: orders = [], isLoading: l1 } = useAdminOrders(companyId, fromDate, toDate);
  const { data: gastos = [], isLoading: l2 } = useAdminGastos(companyId, fromDate, toDate);
  const { data: merma, isLoading: l3 } = useAdminShrinkageSummary(companyId, fromDate, toDate);
  const { data: courierCost = 0, isLoading: l4 } = useAdminCourierCost(storeIds, fromDate, toDate);

  // Período anterior
  const { data: ordersPrev = [], isLoading: l5 } = useAdminOrders(companyId, prevFrom, prevTo);
  const { data: gastosPrev = [], isLoading: l6 } = useAdminGastos(companyId, prevFrom, prevTo);
  const { data: mermaPrev, isLoading: l7 } = useAdminShrinkageSummary(companyId, prevFrom, prevTo);
  const { data: courierCostPrev = 0, isLoading: l8 } = useAdminCourierCost(storeIds, prevFrom, prevTo);

  const loading = l1 || l2 || l3 || l4 || l5 || l6 || l7 || l8;

  const pnl = useMemo(() => {
    if (!merma) return null;
    return calcularPnL(orders as any[], gastos as IGastoOperativo[], merma, ivaRate, courierCost as number, powipRate);
  }, [orders, gastos, merma, courierCost, ivaRate, powipRate]);

  const pnlPrev = useMemo(() => {
    if (!mermaPrev) return null;
    return calcularPnL(ordersPrev as any[], gastosPrev as IGastoOperativo[], mermaPrev, ivaRate, courierCostPrev as number, powipRate);
  }, [ordersPrev, gastosPrev, mermaPrev, courierCostPrev, ivaRate, powipRate]);

  const handleSaveRate = async () => {
    if (!companyId) return;
    const pct = parseFloat(rateInput);
    if (isNaN(pct) || pct < 0 || pct > 100) return;
    setSavingRate(true);
    try {
      await updateCompanyApi(companyId, { powipCommissionRate: pct / 100 });
      if (auth?.company?.id) updateCompany({ ...auth.company, id: auth.company.id, powipCommissionRate: pct / 100 });
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

  const kpis = [
    { label: "Ventas brutas", valor: pnl.ventasBrutas, prev: pnlPrev?.ventasBrutas ?? null },
    { label: "Utilidad bruta real", valor: pnl.utilidadBruta, pct: pnl.margenBruto, prev: pnlPrev?.utilidadBruta ?? null },
    { label: "Utilidad operativa", valor: pnl.utilidadOperativa, pct: pnl.margenOperativo, prev: pnlPrev?.utilidadOperativa ?? null },
    { label: "Utilidad neta", valor: pnl.utilidadNeta, pct: pnl.margenNeto, prev: pnlPrev?.utilidadNeta ?? null },
  ];

  const cascada = [
    { label: "Ventas brutas", valor: pnl.ventasBrutas, tipo: "positivo" as const },
    { label: "− COGS (costo de productos)", valor: -pnl.cogs, tipo: "negativo" as const },
    { label: `− Merma de inventario (${pnl.mermaUnidades} u.)`, valor: -pnl.mermaCosto, tipo: "negativo" as const },
    { label: "= Utilidad bruta real", valor: pnl.utilidadBruta, tipo: "subtotal" as const, pct: pnl.margenBruto },
    { label: "− Fees marketplace", valor: -pnl.feesMarketplace, tipo: "negativo" as const },
    { label: "− Courier integrado (Shalom/Olva)", valor: -pnl.courierIntegrado, tipo: "negativo" as const },
    { label: "− Publicidad", valor: -pnl.gastosMarketing, tipo: "negativo" as const },
    { label: "− Personal / planilla", valor: -pnl.gastosPersonal, tipo: "negativo" as const },
    { label: "− Courier propio", valor: -pnl.gastosCourierPropio, tipo: "negativo" as const },
    { label: "− Herramientas + oficina", valor: -pnl.gastosHerramientas, tipo: "negativo" as const },
    { label: "− Otros gastos", valor: -pnl.gastosOtros, tipo: "negativo" as const },
    { label: "= Utilidad operativa", valor: pnl.utilidadOperativa, tipo: "subtotal" as const, pct: pnl.margenOperativo },
    { label: `− Comisión PowIp (${((auth?.company?.powipCommissionRate ?? 0.005) * 100).toFixed(2)}%)`, valor: -pnl.comisionPowip, tipo: "negativo" as const, editable: true },
    { label: `− IGV / IR estimado (${auth?.company?.iva ?? 18}%)`, valor: -pnl.igvEstimado, tipo: "negativo" as const },
    { label: "= Utilidad neta", valor: pnl.utilidadNeta, tipo: "total" as const, pct: pnl.margenNeto },
  ];

  return (
    <div className="p-8 space-y-6">
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
                  <p className="text-xs text-muted-foreground">{kpi.pct.toFixed(1)}% de margen</p>
                )}
                <DeltaBadge current={kpi.valor} prev={kpi.prev} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Cascada de utilidad</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {cascada.map((row) => (
            <div
              key={row.label}
              className={`flex items-center justify-between px-3 py-2 rounded-md text-sm ${
                row.tipo === "subtotal" ? "bg-muted font-semibold"
                : row.tipo === "total" ? "bg-primary/10 font-bold text-primary" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={row.tipo === "negativo" ? "text-muted-foreground" : ""}>{row.label}</span>
                {(row as any).editable && !editingRate && (
                  <button
                    onClick={() => { setRateInput(((auth?.company?.powipCommissionRate ?? 0.005) * 100).toFixed(2)); setEditingRate(true); }}
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
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleSaveRate} disabled={savingRate}>
                      <Check className="h-3 w-3 text-green-600" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingRate(false)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                {row.pct !== undefined && (
                  <span className="text-xs text-muted-foreground font-mono">{row.pct.toFixed(1)}%</span>
                )}
                <span className={`font-mono ${row.valor < 0 ? "text-destructive" : row.tipo === "total" ? "text-primary" : ""}`}>
                  {fmt(row.valor)}
                </span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
