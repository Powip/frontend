"use client";

import React, { useState } from "react";
import {
  Search,
  Download,
  AlertTriangle,
  Clock,
  CheckCircle2,
  RefreshCcw,
  MoreHorizontal,
  ChevronDown,
  FileText,
  Printer,
  Eye,
  Truck,
  MapPin,
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import { CobroCourierModal } from "./CobroCourierModal";
import { GestionCobroModal } from "./GestionCobroModal";

/* -----------------------------------------
   Mock Data
----------------------------------------- */
const topMetrics = [
  {
    title: "COD PENDIENTE",
    value: "S/ 4,820",
    subtitle: "3 couriers · 19 guías",
    color: "border-amber-400",
    valueColor: "text-amber-500",
  },
  {
    title: "EN AGENCIA (RECOJO)",
    value: "S/ 1,840",
    subtitle: "8 pedidos Shalom ≤30d",
    color: "border-blue-400",
    valueColor: "text-blue-500",
  },
  {
    title: "VENCIDO (+3 DÍAS)",
    value: "S/ 3,240",
    subtitle: "Shalom · 5 días sin rendir",
    color: "border-red-400",
    valueColor: "text-red-500",
  },
  {
    title: "LIQUIDADO ESTE MES",
    value: "S/ 12,340",
    subtitle: "38 guías · Abril 2026",
    color: "border-emerald-400",
    valueColor: "text-emerald-500",
  },
  {
    title: "REASIGNADOS ACTIVOS",
    value: "4",
    subtitle: "En camino nuevo cliente",
    color: "border-purple-400",
    valueColor: "text-purple-500",
  },
];

const courierData = [
  {
    name: "Shalom",
    score: "Problemático",
    scoreColor: "bg-red-100 text-red-700 hover:bg-red-200",
    description: "Empresa courier · 30 guías este mes",
    statusText: "Vencido",
    statusIcon: AlertTriangle,
    statusColor: "text-red-600 bg-red-50 border-red-200",
    rendicion: "4.8d prom. rendición",
    codPend: "S/ 3,240",
    enAgencia: "8",
    guias: "30",
    actionText: "Cobrar S/ 3.240",
    actionColor: "bg-red-600 hover:bg-red-700 text-white",
    chartData: [
      { week: "S1", rendido: 10, pendiente: 0 },
      { week: "S2", rendido: 12, pendiente: 0 },
      { week: "S3", rendido: 8, pendiente: 0 },
      { week: "S4", rendido: 15, pendiente: 0 },
      { week: "S5", rendido: 9, pendiente: 0 },
      { week: "S6", rendido: 18, pendiente: 0 },
      { week: "S7", rendido: 5, pendiente: 10 },
      { week: "S8", rendido: 0, pendiente: 30 },
    ],
  },
  {
    name: "Indriver 2",
    score: "Confiable",
    scoreColor: "bg-green-100 text-green-700 hover:bg-green-200",
    description: "Independiente · 9 guías este mes",
    statusText: "Pendiente",
    statusIcon: Clock,
    statusColor: "text-amber-600 bg-amber-50 border-amber-200",
    rendicion: "1.2d prom. rendición",
    codPend: "S/ 980",
    enAgencia: "—",
    guias: "9",
    actionText: "Ver guías",
    actionColor:
      "bg-white hover:bg-gray-50 text-green-600 border border-green-200",
    chartData: [
      { week: "S1", rendido: 2, pendiente: 0 },
      { week: "S2", rendido: 3, pendiente: 0 },
      { week: "S3", rendido: 4, pendiente: 0 },
      { week: "S4", rendido: 3, pendiente: 0 },
      { week: "S5", rendido: 5, pendiente: 0 },
      { week: "S6", rendido: 4, pendiente: 0 },
      { week: "S7", rendido: 6, pendiente: 2 },
      { week: "S8", rendido: 0, pendiente: 9 },
    ],
  },
  {
    name: "Olva Courier",
    score: "Confiable",
    scoreColor: "bg-green-100 text-green-700 hover:bg-green-200",
    description: "Empresa courier · 4 guías este mes",
    statusText: "Sin COD",
    statusIcon: CheckCircle2,
    statusColor: "text-emerald-600 bg-emerald-50 border-emerald-200",
    rendicion: "2.1d prom. rendición",
    codPend: "S/ 0",
    enAgencia: "—",
    guias: "4",
    actionText: "Ver guías",
    actionColor:
      "bg-white hover:bg-gray-50 text-green-600 border border-green-200",
    chartData: [
      { week: "S1", rendido: 1, pendiente: 0 },
      { week: "S2", rendido: 2, pendiente: 0 },
      { week: "S3", rendido: 1, pendiente: 0 },
      { week: "S4", rendido: 3, pendiente: 0 },
      { week: "S5", rendido: 2, pendiente: 0 },
      { week: "S6", rendido: 2, pendiente: 0 },
      { week: "S7", rendido: 1, pendiente: 0 },
      { week: "S8", rendido: 0, pendiente: 4 },
    ],
  },
];

const tableData = [
  {
    id: "GE-202604-00260",
    date: "15/4/2026",
    courier: "Shalom",
    score: "Problemático",
    tipo: "Courier cobra",
    tipoColor: "text-amber-600 bg-amber-50",
    pedidos: "22",
    pedidosExtra: "(3ag) ⚠️1 🔄1",
    codBruto: "S/ 2748.30",
    adelantos: "-S/ 309.00",
    codNeto: "S/ 2439.30",
    costos: "-S/ 379.76",
    neto: "S/ 2074.54",
    estado: "Vencido",
    estadoColor: "bg-red-100 text-red-700",
    dias: "5d/30d",
    diasColor: "text-red-600 font-medium",
  },
  {
    id: "GE-202604-00274",
    date: "17/4/2026",
    courier: "Indriver 2",
    score: "Confiable",
    tipo: "Negocio cobra",
    tipoColor: "text-blue-600 bg-blue-50",
    pedidos: "2",
    pedidosExtra: "",
    codBruto: "—",
    adelantos: "—",
    codNeto: "—",
    costos: "-S/ 16.00",
    neto: "Flete: S/16.00",
    netoColor: "text-blue-600 font-medium",
    estado: "Pendiente",
    estadoColor: "bg-amber-100 text-amber-700",
    dias: "2d",
    diasColor: "text-gray-500",
  },
  {
    id: "GE-202604-00280",
    date: "18/4/2026",
    courier: "Indriver 2",
    score: "Confiable",
    tipo: "Negocio cobra",
    tipoColor: "text-blue-600 bg-blue-50",
    pedidos: "3",
    pedidosExtra: "⚡2",
    codBruto: "—",
    adelantos: "—",
    codNeto: "—",
    costos: "-S/ 24.00",
    neto: "Flete: S/24.00",
    netoColor: "text-blue-600 font-medium",
    estado: "Pendiente ⚡",
    estadoColor: "bg-amber-100 text-amber-700",
    dias: "1d",
    diasColor: "text-gray-500",
  },
  {
    id: "GE-202604-00273",
    date: "17/4/2026",
    courier: "Olva Courier",
    score: "Confiable",
    tipo: "Prepagado",
    tipoColor: "text-purple-600 bg-purple-50",
    pedidos: "2",
    pedidosExtra: "",
    codBruto: "—",
    adelantos: "—",
    codNeto: "—",
    costos: "-S/ 18.00",
    neto: "S/ 0.00",
    estado: "Sin COD",
    estadoColor: "bg-emerald-100 text-emerald-700",
    dias: "2d",
    diasColor: "text-gray-500",
  },
  {
    id: "GE-202604-00256",
    date: "14/4/2026",
    courier: "Shalom",
    score: "Problemático",
    tipo: "Courier cobra",
    tipoColor: "text-amber-600 bg-amber-50",
    pedidos: "4",
    pedidosExtra: "(1ag)",
    codBruto: "S/ 492.00",
    adelantos: "—",
    codNeto: "S/ 492.00",
    costos: "-S/ 88.00",
    neto: "S/ 404.00",
    estado: "Vencido",
    estadoColor: "bg-red-100 text-red-700",
    dias: "5d/30d",
    diasColor: "text-red-600 font-medium",
  },
  {
    id: "GE-202604-00248",
    date: "13/4/2026",
    courier: "Olva Courier",
    score: "Confiable",
    tipo: "Prepagado",
    tipoColor: "text-purple-600 bg-purple-50",
    pedidos: "3",
    pedidosExtra: "",
    codBruto: "—",
    adelantos: "—",
    codNeto: "—",
    costos: "-S/ 30.30",
    neto: "S/ 0.00",
    estado: "Liquidado",
    estadoColor: "bg-green-100 text-green-700",
    dias: "—",
    diasColor: "text-gray-500",
  },
];

export function LiquidacionesCourierTab() {
  const [activeTab, setActiveTab] = useState("Todas");

  const [tipoFiltro, setTipoFiltro] = useState("Todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [courierFiltro, setCourierFiltro] = useState("all");
  const [fechaFiltro, setFechaFiltro] = useState("Esta semana");
  const [estadoTablaFiltro, setEstadoTablaFiltro] = useState("Todas");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCourierModal, setSelectedCourierModal] = useState<any>(null);
  const [isGestionModalOpen, setIsGestionModalOpen] = useState(false);
  const [selectedRowData, setSelectedRowData] = useState<any>(null);

  const filteredTableData = tableData.filter((row) => {
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
      if (courierFiltro === "shalom" && row.courier !== "Shalom") return false;
      if (courierFiltro === "indriver" && row.courier !== "Indriver 2")
        return false;
      if (courierFiltro === "olva" && row.courier !== "Olva Courier")
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

  const handleCobrarClick = (courier: any) => {
    setSelectedCourierModal(courier);
    setIsModalOpen(true);
  };

  const handleGestionarClick = (row: any) => {
    setSelectedRowData(row);
    setIsGestionModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {topMetrics.map((metric, idx) => (
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

      <Card className="shadow-sm border-border overflow-hidden">
        <div className="p-2 px-4 border-b bg-muted/20 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium text-muted-foreground mr-2">TIPO:</span>
          <Button
            variant={tipoFiltro === "Todos" ? "default" : "ghost"}
            size="sm"
            className="rounded-full h-7 px-4"
            onClick={() => setTipoFiltro("Todos")}
          >
            Todos
          </Button>
          <Button
            variant={tipoFiltro === "Courier cobra" ? "default" : "ghost"}
            size="sm"
            className="rounded-full h-7 px-4"
            onClick={() => setTipoFiltro("Courier cobra")}
          >
            Tipo A — Courier cobra
          </Button>
          <Button
            variant={tipoFiltro === "Negocio cobra" ? "default" : "ghost"}
            size="sm"
            className="rounded-full h-7 px-4"
            onClick={() => setTipoFiltro("Negocio cobra")}
          >
            Tipo B — Cliente al negocio
          </Button>
          <Button
            variant={tipoFiltro === "Prepagado" ? "default" : "ghost"}
            size="sm"
            className="rounded-full h-7 px-4"
            onClick={() => setTipoFiltro("Prepagado")}
          >
            Tipo C — Prepagado
          </Button>
        </div>
        <div className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
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
                <SelectItem value="shalom">Shalom</SelectItem>
                <SelectItem value="indriver">Indriver 2</SelectItem>
                <SelectItem value="olva">Olva Courier</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center rounded-md border border-input p-1 bg-muted/10">
              <Button
                variant={fechaFiltro === "Esta semana" ? "secondary" : "ghost"}
                size="sm"
                className={`h-8 ${fechaFiltro === "Esta semana" ? "shadow-sm" : ""}`}
                onClick={() => setFechaFiltro("Esta semana")}
              >
                Esta semana
              </Button>
              <Button
                variant={fechaFiltro === "Este mes" ? "secondary" : "ghost"}
                size="sm"
                className={`h-8 ${fechaFiltro === "Este mes" ? "shadow-sm" : ""}`}
                onClick={() => setFechaFiltro("Este mes")}
              >
                Este mes
              </Button>
              <Button
                variant={fechaFiltro === "Último mes" ? "secondary" : "ghost"}
                size="sm"
                className={`h-8 ${fechaFiltro === "Último mes" ? "shadow-sm" : ""}`}
                onClick={() => setFechaFiltro("Último mes")}
              >
                Último mes
              </Button>
              <Button
                variant={
                  fechaFiltro === "Personalizado" ? "secondary" : "ghost"
                }
                size="sm"
                className={`h-8 ${fechaFiltro === "Personalizado" ? "shadow-sm" : ""}`}
                onClick={() => setFechaFiltro("Personalizado")}
              >
                Personalizado
              </Button>
            </div>

            <Button
              variant="outline"
              className="h-10 border-input bg-background"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courierData.map((courier, idx) => (
          <Card
            key={idx}
            className="shadow-md hover:shadow-lg transition-all duration-200 border-border/50"
          >
            <CardHeader className="p-5 pb-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center border">
                    <Truck className="h-5 w-5 text-muted-foreground" />
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

              <div className="mb-4">
                <div className="flex justify-between text-[10px] font-semibold uppercase text-muted-foreground mb-1 px-1">
                  <span>Rendición últimas 8 semanas</span>
                  <div className="flex gap-2">
                    <span className="flex items-center">
                      <div className="w-2 h-2 bg-emerald-600 mr-1 rounded-sm"></div>{" "}
                      Rendido
                    </span>
                    <span className="flex items-center">
                      <div className="w-2 h-2 bg-red-400 mr-1 rounded-sm"></div>{" "}
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
                <div className="flex justify-between text-[9px] text-muted-foreground/70 px-2 mt-1">
                  <span>S1</span>
                  <span>S2</span>
                  <span>S3</span>
                  <span>S4</span>
                  <span>S5</span>
                  <span>S6</span>
                  <span>S7</span>
                  <span>S8</span>
                </div>
              </div>

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

      <Card className="shadow-md border-border">
        <CardHeader className="p-4 border-b flex flex-row items-center justify-between bg-muted/10">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Guías con liquidación</CardTitle>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-full border border-input p-1 bg-background shadow-sm">
              <Button
                variant={estadoTablaFiltro === "Todas" ? "secondary" : "ghost"}
                size="sm"
                className="rounded-full h-7 px-4"
                onClick={() => setEstadoTablaFiltro("Todas")}
              >
                Todas
              </Button>
              <Button
                variant={
                  estadoTablaFiltro === "En agencia" ? "secondary" : "ghost"
                }
                size="sm"
                className="rounded-full h-7 px-4"
                onClick={() => setEstadoTablaFiltro("En agencia")}
              >
                En agencia
              </Button>
              <Button
                variant={
                  estadoTablaFiltro === "Pendientes" ? "secondary" : "ghost"
                }
                size="sm"
                className="rounded-full h-7 px-4"
                onClick={() => setEstadoTablaFiltro("Pendientes")}
              >
                Pendientes
              </Button>
              <Button
                variant={
                  estadoTablaFiltro === "Liquidadas" ? "secondary" : "ghost"
                }
                size="sm"
                className="rounded-full h-7 px-4"
                onClick={() => setEstadoTablaFiltro("Liquidadas")}
              >
                Liquidadas
              </Button>
            </div>
            <Button variant="outline" size="sm" className="h-9">
              <FileText className="h-4 w-4 mr-2" /> PDF
            </Button>
          </div>
        </CardHeader>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[130px] font-semibold text-xs tracking-wider uppercase">
                  N° GUÍA
                </TableHead>
                <TableHead className="font-semibold text-xs tracking-wider uppercase">
                  COURIER
                </TableHead>
                <TableHead className="font-semibold text-xs tracking-wider uppercase">
                  SCORE
                </TableHead>
                <TableHead className="font-semibold text-xs tracking-wider uppercase">
                  TIPO
                </TableHead>
                <TableHead className="font-semibold text-xs tracking-wider uppercase">
                  PEDIDOS
                </TableHead>
                <TableHead className="font-semibold text-xs tracking-wider uppercase">
                  COD BRUTO
                </TableHead>
                <TableHead className="font-semibold text-xs tracking-wider uppercase">
                  ADELANTOS
                </TableHead>
                <TableHead className="font-semibold text-xs tracking-wider uppercase">
                  COD NETO
                </TableHead>
                <TableHead className="font-semibold text-xs tracking-wider uppercase">
                  COSTOS
                </TableHead>
                <TableHead className="font-semibold text-xs tracking-wider uppercase">
                  NETO
                </TableHead>
                <TableHead className="font-semibold text-xs tracking-wider uppercase">
                  ESTADO
                </TableHead>
                <TableHead className="font-semibold text-xs tracking-wider uppercase">
                  DÍAS
                </TableHead>
                <TableHead className="font-semibold text-xs tracking-wider uppercase text-right">
                  ACCIONES
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTableData.map((row, idx) => (
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
                  <TableCell className="font-medium">{row.codBruto}</TableCell>
                  <TableCell className="text-emerald-600 dark:text-emerald-500 font-medium">
                    {row.adelantos}
                  </TableCell>
                  <TableCell className="font-bold">{row.codNeto}</TableCell>
                  <TableCell className="text-red-500 font-medium">
                    {row.costos}
                  </TableCell>
                  <TableCell
                    className={`font-bold ${row.netoColor || "text-amber-600 dark:text-amber-500"}`}
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
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="p-4 border-t flex justify-between items-center text-sm">
          <div className="text-muted-foreground">
            Mostrando {filteredTableData.length} guías
          </div>
          <div className="font-bold text-amber-600 dark:text-amber-500">
            Total neto pendiente: S/ 4,134.84
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

      {selectedRowData && (
        <GestionCobroModal
          isOpen={isGestionModalOpen}
          onClose={() => setIsGestionModalOpen(false)}
          data={selectedRowData}
        />
      )}
    </div>
  );
}
