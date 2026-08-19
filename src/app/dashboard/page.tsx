"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { format, startOfMonth, endOfMonth } from "date-fns";
import Header from "@/components/header/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { OverviewTab } from "./components/OverviewTab";

// El resto de las tabs se cargan on-demand (code-splitting): recién bajan su JS
// cuando el usuario las abre, en vez de sumarse al bundle inicial de /dashboard.
const TAB_FALLBACK = <Skeleton className="h-40 w-full m-6" />;
const CodTab = dynamic(() => import("./components/CodTab").then((m) => m.CodTab), { loading: () => TAB_FALLBACK });
const ComercialTab = dynamic(() => import("./components/ComercialTab").then((m) => m.ComercialTab), { loading: () => TAB_FALLBACK });
const GeoTab = dynamic(() => import("./components/GeoTab").then((m) => m.GeoTab), { loading: () => TAB_FALLBACK });
const EquipoTab = dynamic(() => import("./components/EquipoTab").then((m) => m.EquipoTab), { loading: () => TAB_FALLBACK });
const OperacionesTab = dynamic(() => import("./components/OperacionesTab").then((m) => m.OperacionesTab), { loading: () => TAB_FALLBACK });
const CourierTab = dynamic(() => import("./components/CourierTab").then((m) => m.CourierTab), { loading: () => TAB_FALLBACK });
const FinanzasTab = dynamic(() => import("./components/FinanzasTab").then((m) => m.FinanzasTab), { loading: () => TAB_FALLBACK });

// "ready: false" = todavía 100% mock, sin conectar a datos reales — se oculta
// del selector de tabs (el contenido queda en el código, solo no es alcanzable
// desde la UI). Pasar a true cuando esa tab se conecte.
const TABS = [
  { value: "general", label: "Resumen General", ready: true },
  { value: "cod", label: "Gestión COD", ready: false },
  { value: "comercial", label: "Análisis Comercial", ready: true },
  { value: "geo", label: "Geografía & Clientes", ready: true },
  { value: "equipo", label: "Equipo & Upsell", ready: true },
  { value: "operaciones", label: "Operaciones", ready: true },
  { value: "courier", label: "Courier", ready: true },
  { value: "finanzas", label: "Finanzas", ready: true },
];

const VISIBLE_TABS = TABS.filter((tab) => tab.ready);

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("general");
  const [fromDate, setFromDate] = useState<string>(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [toDate, setToDate] = useState<string>(format(endOfMonth(new Date()), "yyyy-MM-dd"));

  const handlePeriodChange = (from: string, to: string) => {
    setFromDate(from);
    setToDate(to);
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <Header />

      {/* Encabezado + filtro de período */}
      <div className="px-8 py-4 flex items-center justify-between border-b border-border bg-card shadow-sm">
        <div>
          <h1 className="text-xl font-black text-foreground tracking-tight">Panel de Control</h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mt-1">
            Resumen general de operaciones
          </p>
        </div>
        <div className="flex items-center gap-4">
          <PeriodSelector onPeriodChange={handlePeriodChange} />
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 gap-0">
          <div className="px-8 border-b border-border bg-background overflow-x-auto scrollbar-none">
            <TabsList className="bg-transparent p-0 gap-6 flex justify-start items-center h-12 w-max">
              {VISIBLE_TABS.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="h-12 p-0 px-1 rounded-none bg-transparent data-[state=active]:bg-transparent border-t-0 border-x-0 border-b-2 border-transparent data-[state=active]:border-violet-600 dark:data-[state=active]:border-violet-500 text-muted-foreground data-[state=active]:text-violet-600 dark:data-[state=active]:text-violet-400 font-semibold transition-all duration-200 shadow-none data-[state=active]:shadow-none whitespace-nowrap"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="general" className="flex-1 overflow-y-auto mt-0 scrollbar-none outline-none">
            <OverviewTab fromDate={fromDate} toDate={toDate} onGoToTab={setActiveTab} />
          </TabsContent>

          <TabsContent value="cod" className="flex-1 overflow-y-auto mt-0 scrollbar-none outline-none">
            <CodTab />
          </TabsContent>

          <TabsContent value="comercial" className="flex-1 overflow-y-auto mt-0 scrollbar-none outline-none">
            <ComercialTab fromDate={fromDate} toDate={toDate} />
          </TabsContent>

          <TabsContent value="geo" className="flex-1 overflow-y-auto mt-0 scrollbar-none outline-none">
            <GeoTab fromDate={fromDate} toDate={toDate} />
          </TabsContent>

          <TabsContent value="equipo" className="flex-1 overflow-y-auto mt-0 scrollbar-none outline-none">
            <EquipoTab fromDate={fromDate} toDate={toDate} />
          </TabsContent>

          <TabsContent value="operaciones" className="flex-1 overflow-y-auto mt-0 scrollbar-none outline-none">
            <OperacionesTab fromDate={fromDate} toDate={toDate} />
          </TabsContent>

          <TabsContent value="courier" className="flex-1 overflow-y-auto mt-0 scrollbar-none outline-none">
            <CourierTab fromDate={fromDate} toDate={toDate} />
          </TabsContent>

          <TabsContent value="finanzas" className="flex-1 overflow-y-auto mt-0 scrollbar-none outline-none">
            <FinanzasTab fromDate={fromDate} toDate={toDate} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
