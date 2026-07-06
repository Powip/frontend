"use client";

import React, { useMemo, useState } from "react";
import {
  Search,
  Download,
  AlertTriangle,
  Clock,
  CheckCircle2,
  RefreshCcw,
  ChevronDown,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import { CobroCourierModal } from "./CobroCourierModal";
import { GestionCobroModal } from "./GestionCobroModal";
import { NotificacionClienteModal } from "./NotificacionClienteModal";
import { useAuth } from "@/contexts/AuthContext";
import {
  useEnAgencia,
  useReassigned,
  useTopMetrics,
  useCourierPerformance,
  useLiquidationsTable,
} from "@/hooks/finanzas/useLiquidaciones";
import type {
  CourierPerformanceItem,
  TableRow as ApiTableRow,
  TopMetricsData,
} from "@/api/Courier";

/* -----------------------------------------
   UI derivation helpers
----------------------------------------- */

function fmtMoney(n: number): string {
  if (n === 0) return "S/ 0";
  return `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function scoreColors(score: string) {
  if (score === "Problemático")
    return "bg-red-100 text-red-700 hover:bg-red-200";
  return "bg-green-100 text-green-700 hover:bg-green-200";
}

function statusProps(status: string) {
  if (status === "Vencido")
    return {
      statusText: "Vencido",
      statusIcon: AlertTriangle,
      statusColor: "text-red-600 bg-red-50 border-red-200",
    };
  if (status === "Sin COD")
    return {
      statusText: "Sin COD",
      statusIcon: CheckCircle2,
      statusColor: "text-emerald-600 bg-emerald-50 border-emerald-200",
    };
  return {
    statusText: "Pendiente",
    statusIcon: Clock,
    statusColor: "text-amber-600 bg-amber-50 border-amber-200",
  };
}

function actionProps(codPendiente: number, score: string) {
  if (codPendiente > 0 && score === "Problemático")
    return {
      actionText: `Cobrar ${fmtMoney(codPendiente)}`,
      actionColor: "bg-red-600 hover:bg-red-700 text-white",
    };
  return {
    actionText: "Ver guías",
    actionColor:
      "bg-white hover:bg-gray-50 text-green-600 border border-green-200",
  };
}

function tipoColors(tipo: string): string {
  if (tipo === "Courier cobra") return "text-amber-600 bg-amber-50";
  if (tipo === "Negocio cobra") return "text-blue-600 bg-blue-50";
  return "text-purple-600 bg-purple-50";
}

function estadoColors(estado: string): string {
  if (estado.toLowerCase().includes("vencido"))
    return "bg-red-100 text-red-700";
  if (estado.toLowerCase().includes("liquidado"))
    return "bg-green-100 text-green-700";
  if (estado.toLowerCase().includes("sin cod"))
    return "bg-emerald-100 text-emerald-700";
  return "bg-amber-100 text-amber-700";
}

function diasColors(estado: string): string {
  if (estado.toLowerCase().includes("vencido"))
    return "text-red-600 font-medium";
  return "text-gray-500";
}

function fmtDias(
  diasPendiente: number,
  diasMaximo: number,
  estado: string,
): string {
  if (estado === "Liquidado" || estado === "Sin COD") return "—";
  if (diasMaximo > 0) return `${diasPendiente}d/${diasMaximo}d`;
  return `${diasPendiente}d`;
}

function buildPedidosExtra(row: ApiTableRow): string {
  const parts: string[] = [];
  if (row.pedidosEnAgencia > 0) parts.push(`(${row.pedidosEnAgencia}ag)`);
  if (row.pedidosConAlerta > 0) parts.push(`⚠️${row.pedidosConAlerta}`);
  if (row.pedidosReasignados > 0) parts.push(`🔄${row.pedidosReasignados}`);
  return parts.join(" ");
}

function fmtField(
  n: number,
  tipo: string,
  field: "codBruto" | "adelantos" | "codNeto",
): string {
  if (tipo !== "Courier cobra") return "—";
  if (n === 0) return "—";
  if (field === "adelantos") return `-${fmtMoney(n)}`;
  return fmtMoney(n);
}

function fmtNeto(row: ApiTableRow): { neto: string; netoColor?: string } {
  if (row.tipo === "Negocio cobra")
    return {
      neto: `Flete: ${fmtMoney(row.costos)}`,
      netoColor: "text-blue-600 font-medium",
    };
  return { neto: fmtMoney(row.neto) };
}

function fmtCostos(n: number): string {
  if (n === 0) return "—";
  return `-${fmtMoney(n)}`;
}

/* -----------------------------------------
   Derived data builders
----------------------------------------- */

interface TopMetric {
  title: string;
  value: string;
  subtitle: string;
  color: string;
  valueColor: string;
}

function buildTopMetrics(
  enAgencia:
    | { amount: number; count: number; carrier: string | null }
    | undefined,
  reassigned: { count: number; subtitle: string } | undefined,
  topMetrics: TopMetricsData | undefined,
  couriersWithPendingCod?: number,
): TopMetric[] {
  const pendingAmount = topMetrics?.pendingCod?.amount ?? 0;
  const pendingCount = topMetrics?.pendingCod?.count ?? 0;

  const overdueAmount = topMetrics?.overdue?.amount ?? 0;
  const overdueCount = topMetrics?.overdue?.count ?? 0;
  const overdueCourier = topMetrics?.overdue?.courier;

  const liquidatedAmount = topMetrics?.liquidatedThisMonth?.amount ?? 0;
  const liquidatedCount = topMetrics?.liquidatedThisMonth?.count ?? 0;
  const liquidatedMonth = topMetrics?.liquidatedThisMonth?.month ?? "";
  const liquidatedYear = topMetrics?.liquidatedThisMonth?.year ?? 0;
  const liquidatedMonthCap = liquidatedMonth
    ? liquidatedMonth.charAt(0).toUpperCase() + liquidatedMonth.slice(1)
    : "";

  const pendingSubtitle = couriersWithPendingCod
    ? `${couriersWithPendingCod} courier${couriersWithPendingCod > 1 ? "s" : ""} · ${pendingCount} guías`
    : `${pendingCount} guías con COD activo`;

  return [
    {
      title: "COD PENDIENTE",
      value: fmtMoney(pendingAmount),
      subtitle: pendingSubtitle,
      color: "border-amber-400",
      valueColor: "text-amber-500",
    },
    {
      title: "EN AGENCIA (RECOJO)",
      value: fmtMoney(enAgencia?.amount ?? 0),
      subtitle: enAgencia
        ? `${enAgencia.count} pedidos${enAgencia.carrier ? ` · ${enAgencia.carrier}` : ""}`
        : "—",
      color: "border-blue-400",
      valueColor: "text-blue-500",
    },
    {
      title: "VENCIDO (+3 DÍAS)",
      value: fmtMoney(overdueAmount),
      subtitle: overdueCourier
        ? `${overdueCourier} · con retraso`
        : "con retraso",
      color: "border-red-400",
      valueColor: "text-red-500",
    },
    {
      title: "LIQUIDADO ESTE MES",
      value: fmtMoney(liquidatedAmount),
      subtitle: liquidatedMonthCap
        ? `${liquidatedCount} guías · ${liquidatedMonthCap} ${liquidatedYear}`
        : "cobrado este mes",
      color: "border-emerald-400",
      valueColor: "text-emerald-500",
    },
    {
      title: "REASIGNADOS ACTIVOS",
      value: String(reassigned?.count ?? 0),
      subtitle: reassigned?.subtitle ?? "en camino",
      color: "border-purple-400",
      valueColor: "text-purple-500",
    },
  ];
}

interface DerivedCourier {
  name: string;
  score: string;
  scoreColor: string;
  description: string;
  statusText: string;
  statusIcon: typeof AlertTriangle;
  statusColor: string;
  rendicion: string;
  codPend: string;
  enAgencia: string;
  guias: string;
  actionText: string;
  actionColor: string;
  chartData: { week: string; rendido: number; pendiente: number }[];
}

function buildCourierData(items: CourierPerformanceItem[]): DerivedCourier[] {
  return items.map((item) => {
    const status = item.status ?? "Pendiente";
    const sp = statusProps(status);
    const ap = actionProps(item.codPendiente, item.score);
    console.log("item", item);
    return {
      name: item.name,
      score: item.score,
      scoreColor: scoreColors(item.score),
      description: item.description ?? `${item.totalGuias} guías este mes`,
      ...sp,
      rendicion: `${item.avgRenditionDays.toFixed(1)}d prom. rendición`,
      codPend: item.codPendiente > 0 ? fmtMoney(item.codPendiente) : "S/ 0",
      enAgencia: item.enAgencia > 0 ? String(item.enAgencia) : "—",
      guias: String(item.totalGuias),
      ...ap,
      chartData: Array.isArray(item.weeklyData) ? item.weeklyData : [],
    };
  });
}

interface DerivedTableRow {
  id: string;
  date: string;
  courier: string;
  score: string;
  tipo: string;
  tipoColor: string;
  pedidos: string;
  pedidosExtra: string;
  codBruto: string;
  adelantos: string;
  codNeto: string;
  costos: string;
  neto: string;
  netoColor?: string;
  estado: string;
  estadoColor: string;
  dias: string;
  diasColor: string;
}

function buildTableData(rows: ApiTableRow[]): DerivedTableRow[] {
  return rows.map((row) => {
    const courier = row.courierName ?? row.courier ?? "—";
    const score = row.courierScore ?? row.score ?? "—";
    const { neto, netoColor } = fmtNeto(row);
    const estado = row.estado ?? "Pendiente";
    return {
      id: row.id,
      date: row.date ? new Date(row.date).toLocaleDateString("es-PE") : "—",
      courier,
      score,
      tipo: row.tipo,
      tipoColor: tipoColors(row.tipo),
      pedidos: String(row.pedidosCount),
      pedidosExtra: buildPedidosExtra(row),
      codBruto: fmtField(row.codBruto, row.tipo, "codBruto"),
      adelantos: fmtField(row.adelantos, row.tipo, "adelantos"),
      codNeto: fmtField(row.codNeto, row.tipo, "codNeto"),
      costos: fmtCostos(row.costos),
      neto,
      netoColor,
      estado,
      estadoColor: estadoColors(estado),
      dias: fmtDias(row.diasPendiente, row.diasMaximo, estado),
      diasColor: diasColors(estado),
    };
  });
}

/* -----------------------------------------
   Skeleton loader
----------------------------------------- */

function MetricSkeleton() {
  return (
    <div className="h-24 rounded-lg border-t-4 border-muted bg-muted/30 animate-pulse" />
  );
}

/* -----------------------------------------
   Component
----------------------------------------- */

export function LiquidacionesCourierTab() {
  const { selectedStoreId } = useAuth();

  const [tipoFiltro, setTipoFiltro] = useState("Todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [courierFiltro, setCourierFiltro] = useState("all");
  const [fechaFiltro, setFechaFiltro] = useState("Esta semana");
  const [estadoTablaFiltro, setEstadoTablaFiltro] = useState("Todas");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCourierModal, setSelectedCourierModal] =
    useState<DerivedCourier | null>(null);
  const [isGestionModalOpen, setIsGestionModalOpen] = useState(false);
  const [selectedRowData, setSelectedRowData] = useState<ApiTableRow | null>(
    null,
  );
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
  const [selectedNotifRow, setSelectedNotifRow] = useState<ApiTableRow | null>(
    null,
  );

  const { data: enAgenciaData, isLoading: loadingEnAgencia } =
    useEnAgencia(selectedStoreId);
  const { data: reassignedData, isLoading: loadingReassigned } =
    useReassigned(selectedStoreId);
  const { data: topMetricsData, isLoading: loadingTopMetrics } =
    useTopMetrics(selectedStoreId);
  const { data: courierRaw, isLoading: loadingCouriers } =
    useCourierPerformance(selectedStoreId);
  const { data: tableRaw, isLoading: loadingTable } =
    useLiquidationsTable(selectedStoreId);

  const loadingMetrics =
    loadingEnAgencia || loadingReassigned || loadingTopMetrics;

  const topMetrics = useMemo(() => {
    const couriersWithPendingCod = (courierRaw ?? []).filter(
      (c) => Number(c.pendingCod ?? c.codPendiente ?? c.codPend ?? 0) > 0,
    ).length;
    return buildTopMetrics(
      enAgenciaData,
      reassignedData,
      topMetricsData,
      couriersWithPendingCod,
    );
  }, [enAgenciaData, reassignedData, topMetricsData, courierRaw]);

  const courierData = useMemo(
    () => buildCourierData(courierRaw ?? []),
    [courierRaw],
  );

  const filteredByDateRaw = useMemo(() => {
    const rows = tableRaw ?? [];
    if (fechaFiltro === "Esta semana") {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      return rows.filter((r) => new Date(r.date) >= cutoff);
    }
    if (fechaFiltro === "Este mes") {
      const now = new Date();
      const cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
      return rows.filter((r) => new Date(r.date) >= cutoff);
    }
    if (fechaFiltro === "Último mes") {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      return rows.filter((r) => {
        const d = new Date(r.date);
        return d >= from && d <= to;
      });
    }
    return rows; // "Personalizado" y default: sin filtrar
  }, [tableRaw, fechaFiltro]);

  console.log("tableRaw", tableRaw);

  const tableData = useMemo(
    () => buildTableData(filteredByDateRaw),
    [filteredByDateRaw],
  );

  const filteredTableData = useMemo(() => {
    return tableData.filter((row) => {
      if (tipoFiltro !== "Todos" && row.tipo !== tipoFiltro) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !row.id.toLowerCase().includes(q) &&
          !row.courier.toLowerCase().includes(q)
        )
          return false;
      }

      if (courierFiltro !== "all") {
        if (!row.courier.toLowerCase().includes(courierFiltro.toLowerCase()))
          return false;
      }

      if (estadoTablaFiltro === "En agencia") {
        if (!row.pedidosExtra.includes("ag")) return false;
      }
      if (estadoTablaFiltro === "Pendientes") {
        if (
          !row.estado.toLowerCase().includes("pendiente") &&
          !row.estado.toLowerCase().includes("vencido")
        )
          return false;
      }
      if (estadoTablaFiltro === "Liquidadas") {
        if (
          !row.estado.toLowerCase().includes("liquidado") &&
          !row.estado.toLowerCase().includes("sin cod")
        )
          return false;
      }

      return true;
    });
  }, [tableData, tipoFiltro, searchQuery, courierFiltro, estadoTablaFiltro]);

  const uniqueCouriers = useMemo(
    () => [...new Set(tableData.map((r) => r.courier))],
    [tableData],
  );

  const handleCobrarClick = (courier: DerivedCourier) => {
    setSelectedCourierModal(courier);
    setIsModalOpen(true);
  };

  const handleGestionarClick = (derivedRow: DerivedTableRow) => {
    const rawRow = tableRaw?.find((r) => r.id === derivedRow.id);
    if (rawRow) {
      setSelectedRowData(rawRow);
      setIsGestionModalOpen(true);
    }
  };

  const handleNotificacionClick = (derivedRow: DerivedTableRow) => {
    const rawRow = tableRaw?.find((r) => r.id === derivedRow.id);
    if (rawRow) {
      setSelectedNotifRow(rawRow);
      setIsNotifModalOpen(true);
    }
  };
  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* ----- Top metrics ----- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {loadingMetrics
          ? Array.from({ length: 5 }).map((_, i) => <MetricSkeleton key={i} />)
          : topMetrics.map((metric, idx) => (
              <Card
                key={idx}
                className={`border-t-4 shadow-sm ${metric.color} dark:bg-card/50`}
              >
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {metric.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className={`text-2xl font-bold ${metric.valueColor}`}>
                    {metric.value}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">
                    {metric.subtitle}
                  </p>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* ----- Courier cards ----- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loadingCouriers
          ? Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-56 rounded-lg border bg-muted/30 animate-pulse"
              />
            ))
          : courierData.map((courier, idx) => (
              <Card
                key={idx}
                className="shadow-md hover:shadow-lg transition-all duration-200 border-border/50"
              >
                <CardHeader className="p-5 pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center border">
                        <RefreshCcw className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-lg">{courier.name}</h3>
                          <Badge
                            variant="secondary"
                            className={`${courier.scoreColor} border-0 text-[10px] px-2 py-0.5`}
                          >
                            {courier.score === "Problemático" && (
                              <AlertTriangle className="h-3 w-3 mr-1 inline" />
                            )}
                            {courier.score === "Confiable" && (
                              <CheckCircle2 className="h-3 w-3 mr-1 inline" />
                            )}
                            {courier.score}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {courier.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <div
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold ${courier.statusColor}`}
                      >
                        <courier.statusIcon className="h-3.5 w-3.5" />
                        {courier.statusText}
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-1 flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {courier.rendicion}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-5 pt-2">
                  <div className="grid grid-cols-3 gap-4 mb-4 text-center mt-2">
                    <div>
                      <div
                        className={`text-lg font-bold ${courier.codPend !== "S/ 0" ? "text-red-600 dark:text-red-500" : "text-emerald-600 dark:text-emerald-500"}`}
                      >
                        {courier.codPend}
                      </div>
                      <div className="text-[10px] font-semibold text-muted-foreground tracking-wider uppercase">
                        COD PEND.
                      </div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-blue-600 dark:text-blue-500">
                        {courier.enAgencia}
                      </div>
                      <div className="text-[10px] font-semibold text-muted-foreground tracking-wider uppercase">
                        EN AGENCIA
                      </div>
                    </div>
                    <div>
                      <div className="text-lg font-bold">{courier.guias}</div>
                      <div className="text-[10px] font-semibold text-muted-foreground tracking-wider uppercase">
                        GUÍAS
                      </div>
                    </div>
                  </div>

                  {courier.chartData.length > 0 && (
                    <div className="mb-4">
                      <div className="flex justify-between text-[10px] font-semibold uppercase text-muted-foreground mb-1 px-1">
                        <span>Rendición últimas 8 semanas</span>
                        <div className="flex gap-2">
                          <span className="flex items-center">
                            <div className="w-2 h-2 bg-emerald-600 mr-1 rounded-sm" />{" "}
                            Rendido
                          </span>
                          <span className="flex items-center">
                            <div className="w-2 h-2 bg-red-400 mr-1 rounded-sm" />{" "}
                            Pendiente
                          </span>
                        </div>
                      </div>
                      <div className="h-[40px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={courier.chartData} barGap={1}>
                            <RechartsTooltip
                              cursor={{ fill: "rgba(0,0,0,0.05)" }}
                              contentStyle={{
                                fontSize: "12px",
                                borderRadius: "8px",
                                border: "none",
                                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                              }}
                            />
                            <Bar
                              dataKey="rendido"
                              stackId="a"
                              fill="#059669"
                              radius={[0, 0, 2, 2]}
                            />
                            <Bar
                              dataKey="pendiente"
                              stackId="a"
                              fill="#f87171"
                              radius={[2, 2, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700 bg-background"
                    >
                      Ver guías <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                    {courier.actionText.includes("Cobrar") ? (
                      <Button
                        size="sm"
                        className={courier.actionColor}
                        onClick={() => handleCobrarClick(courier)}
                      >
                        {courier.actionText}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground font-medium">
                        Sin deuda pendiente
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* ----- Unified Card: Filters + Table ----- */}
      <Card className="shadow-md border-border overflow-hidden">
        {/* ----- Top bar (tipo + estado + acciones) ----- */}
        <div className="p-3 border-b bg-muted/20 flex flex-col gap-3">
          {/* Row 1: Tipo + estados + acciones */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Tipo */}
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-muted-foreground">TIPO:</span>
              {["Todos", "Courier cobra", "Negocio cobra", "Prepagado"].map(
                (t) => (
                  <Button
                    key={t}
                    variant={tipoFiltro === t ? "default" : "ghost"}
                    size="sm"
                    className="rounded-full h-7 px-4"
                    onClick={() => setTipoFiltro(t)}
                  >
                    {t === "Todos"
                      ? "Todos"
                      : t === "Courier cobra"
                        ? "Tipo A — Courier cobra"
                        : t === "Negocio cobra"
                          ? "Tipo B — Cliente al negocio"
                          : "Tipo C — Prepagado"}
                  </Button>
                ),
              )}
            </div>

            {/* Estados + acción */}
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-full border border-input p-1 bg-background shadow-sm">
                {["Todas", "En agencia", "Pendientes", "Liquidadas"].map(
                  (f) => (
                    <Button
                      key={f}
                      variant={estadoTablaFiltro === f ? "secondary" : "ghost"}
                      size="sm"
                      className="rounded-full h-7 px-4"
                      onClick={() => setEstadoTablaFiltro(f)}
                    >
                      {f}
                    </Button>
                  ),
                )}
              </div>

              <Button variant="outline" size="sm" className="h-9">
                <FileText className="h-4 w-4 mr-2" /> PDF
              </Button>
            </div>
          </div>

          {/* Row 2: búsqueda + filtros */}
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:max-w-[400px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por N° Guía, courier..."
                className="pl-9 bg-background"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <Select value={courierFiltro} onValueChange={setCourierFiltro}>
                <SelectTrigger className="w-[180px] bg-background">
                  <SelectValue placeholder="Todos los couriers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los couriers</SelectItem>
                  {uniqueCouriers.map((c) => (
                    <SelectItem key={c} value={c.toLowerCase()}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center rounded-md border border-input p-1 bg-background">
                {["Esta semana", "Este mes", "Último mes", "Personalizado"].map(
                  (f) => (
                    <Button
                      key={f}
                      variant={fechaFiltro === f ? "secondary" : "ghost"}
                      size="sm"
                      className={`h-8 ${fechaFiltro === f ? "shadow-sm" : ""}`}
                      onClick={() => setFechaFiltro(f)}
                    >
                      {f}
                    </Button>
                  ),
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ----- Title (más liviano, integrado) ----- */}
        <div className="px-4 py-3 border-b bg-muted/10 flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-semibold">Guías con liquidación</span>
        </div>

        {/* ----- Table ----- */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                {[
                  "N° GUÍA",
                  "COURIER",
                  "SCORE",
                  "TIPO",
                  "PEDIDOS",
                  "COD BRUTO",
                  "ADELANTOS",
                  "COD NETO",
                  "COSTOS",
                  "NETO",
                  "ESTADO",
                  "DÍAS",
                  "ACCIONES",
                ].map((h) => (
                  <TableHead
                    key={h}
                    className={`font-semibold text-xs tracking-wider uppercase ${
                      h === "ACCIONES" ? "text-right" : ""
                    }`}
                  >
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>

            <TableBody>
              {loadingTable ? (
                <TableRow>
                  <TableCell
                    colSpan={13}
                    className="text-center py-12 text-muted-foreground"
                  >
                    Cargando guías...
                  </TableCell>
                </TableRow>
              ) : filteredTableData.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={13}
                    className="text-center py-12 text-muted-foreground"
                  >
                    No hay guías para los filtros seleccionados.
                  </TableCell>
                </TableRow>
              ) : (
                filteredTableData.map((row, idx) => (
                  <TableRow key={idx} className="hover:bg-muted/20">
                    <TableCell>
                      <div className="font-bold text-sm">{row.id}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.date}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{row.courier}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`${row.score === "Problemático" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"} border-0 text-[10px]`}
                      >
                        {row.score === "Problemático" && (
                          <AlertTriangle className="h-3 w-3 mr-1 inline" />
                        )}
                        {row.score === "Confiable" && (
                          <CheckCircle2 className="h-3 w-3 mr-1 inline" />
                        )}
                        {row.score}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${row.tipoColor}`}
                      >
                        {row.tipo}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 font-semibold">
                        {row.pedidos}{" "}
                        <span className="text-blue-500 font-normal text-xs">
                          {row.pedidosExtra}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {row.codBruto}
                    </TableCell>
                    <TableCell className="text-emerald-600 dark:text-emerald-500 font-medium">
                      {row.adelantos}
                    </TableCell>
                    <TableCell className="font-bold">{row.codNeto}</TableCell>
                    <TableCell className="text-red-500 font-medium">
                      {row.costos}
                    </TableCell>
                    <TableCell
                      className={`font-bold ${row.netoColor ?? "text-amber-600 dark:text-amber-500"}`}
                    >
                      {row.neto}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`${row.estadoColor} border-0`}
                      >
                        {row.estado}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-xs ${row.diasColor}`}>
                      {row.dias}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-1">
                        {row.estado === "Liquidado" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs bg-background"
                          >
                            Ver
                          </Button>
                        ) : (
                          <Button
                            variant="default"
                            size="sm"
                            className="h-7 text-xs bg-amber-500 hover:bg-amber-600 text-white border-0 shadow-sm"
                            onClick={() => handleGestionarClick(row)}
                          >
                            <span className="font-bold mr-1">$</span> Gestionar
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 rounded border-green-200 text-green-600 bg-green-50 hover:bg-green-100"
                          onClick={() => handleNotificacionClick(row)}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="h-4 w-4"
                          >
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                          </svg>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* ----- Footer ----- */}
        <div className="p-4 border-t flex justify-between items-center text-sm">
          <div className="text-muted-foreground">
            Mostrando {filteredTableData.length} guías
          </div>

          <div className="font-bold text-amber-600 dark:text-amber-500">
            Total neto pendiente:{" "}
            {fmtMoney(
              filteredTableData
                .filter(
                  (r) => r.estado !== "Liquidado" && r.estado !== "Sin COD",
                )
                .reduce((acc, r) => {
                  const n = parseFloat(r.neto.replace(/[^0-9.]/g, "")) || 0;
                  return acc + n;
                }, 0),
            )}
          </div>
        </div>
      </Card>
      {selectedCourierModal && (
        <CobroCourierModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          courierName={selectedCourierModal.name}
          montoPendiente={selectedCourierModal.codPend}
          diasSinRendir={5}
        />
      )}

      {isGestionModalOpen && selectedRowData && (
        <GestionCobroModal
          isOpen={isGestionModalOpen}
          onClose={() => setIsGestionModalOpen(false)}
          data={selectedRowData}
        />
      )}

      {isNotifModalOpen && selectedNotifRow && (
        <NotificacionClienteModal
          isOpen={isNotifModalOpen}
          onClose={() => setIsNotifModalOpen(false)}
          data={selectedNotifRow}
        />
      )}
    </div>
  );
}
