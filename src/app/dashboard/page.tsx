"use client";
import { useState } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Stats } from "@/components/dashboard/stats";
import Header from "@/components/header/Header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Analysis } from "@/components/dashboard/analysis";
import { Geography } from "@/components/dashboard/geography";
import { TeamManagement } from "@/components/dashboard/TeamManagement";
import { FinanceStats } from "@/components/dashboard/FinanceStats";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { useDashboardScope } from "@/contexts/DashboardScopeContext";

export default function DashboardPage() {
  return <DashboardContent />;
}

function DashboardContent() {
  const { scope, scopeParams } = useDashboardScope();
  const [fromDate, setFromDate] = useState<string>(
    format(startOfMonth(new Date()), "yyyy-MM-dd")
  );
  const [toDate, setToDate] = useState<string>(
    format(endOfMonth(new Date()), "yyyy-MM-dd")
  );
  const panelKey = JSON.stringify([scopeParams, fromDate, toDate]);

  const handlePeriodChange = (from: string, to: string) => {
    setFromDate(from);
    setToDate(to);
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <Header />
      
      {/* Global Date Filter Header */}
      <div className="px-8 py-4 flex items-center justify-between border-b border-border bg-card shadow-sm">
        <div>
          <h1 className="text-xl font-black text-foreground tracking-tight flex items-center gap-2">
            PANEL DE CONTROL
          </h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mt-1">
            {scope === "business" ? "Resumen de todas las tiendas del negocio" : "Resumen de la tienda seleccionada"}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <PeriodSelector onPeriodChange={handlePeriodChange} />
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <Tabs defaultValue="general" className="flex-1 flex flex-col min-h-0 gap-0">
          <div className="px-8 border-b border-border bg-background">
            <TabsList className="bg-transparent p-0 gap-8 flex justify-start items-center h-12">
              <TabsTrigger
                value="general"
                className="h-12 p-0 px-2 rounded-none bg-transparent data-[state=active]:bg-transparent border-t-0 border-x-0 border-b-2 border-transparent data-[state=active]:border-[#00f2ad] dark:data-[state=active]:border-[#00f2ad] text-muted-foreground data-[state=active]:text-foreground font-medium transition-all duration-300 shadow-none data-[state=active]:shadow-none"
              >
                Resumen General
              </TabsTrigger>
              <TabsTrigger
                value="analysis"
                className="h-12 p-0 px-2 rounded-none bg-transparent data-[state=active]:bg-transparent border-t-0 border-x-0 border-b-2 border-transparent data-[state=active]:border-[#00f2ad] dark:data-[state=active]:border-[#00f2ad] text-muted-foreground data-[state=active]:text-foreground font-medium transition-all duration-300 shadow-none data-[state=active]:shadow-none"
              >
                Análisis Comercial
              </TabsTrigger>
              <TabsTrigger
                value="geography"
                className="h-12 p-0 px-2 rounded-none bg-transparent data-[state=active]:bg-transparent border-t-0 border-x-0 border-b-2 border-transparent data-[state=active]:border-[#00f2ad] dark:data-[state=active]:border-[#00f2ad] text-muted-foreground data-[state=active]:text-foreground font-medium transition-all duration-300 shadow-none data-[state=active]:shadow-none"
              >
                Geografía & Clientes
              </TabsTrigger>
              <TabsTrigger
                value="team"
                className="h-12 p-0 px-2 rounded-none bg-transparent data-[state=active]:bg-transparent border-t-0 border-x-0 border-b-2 border-transparent data-[state=active]:border-[#00f2ad] dark:data-[state=active]:border-[#00f2ad] text-muted-foreground data-[state=active]:text-foreground font-medium transition-all duration-300 shadow-none data-[state=active]:shadow-none"
              >
                Gestión de Equipo
              </TabsTrigger>
              <TabsTrigger
                value="finance"
                className="h-12 p-0 px-2 rounded-none bg-transparent data-[state=active]:bg-transparent border-t-0 border-x-0 border-b-2 border-transparent data-[state=active]:border-[#00f2ad] dark:data-[state=active]:border-[#00f2ad] text-muted-foreground data-[state=active]:text-foreground font-medium transition-all duration-300 shadow-none data-[state=active]:shadow-none"
              >
                Finanzas
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="general" className="flex-1 overflow-auto mt-0 scrollbar-none outline-none">
            <Stats key={panelKey} fromDate={fromDate} toDate={toDate} />
          </TabsContent>

          <TabsContent value="analysis" className="flex-1 overflow-hidden mt-0">
            <Analysis key={panelKey} fromDate={fromDate} toDate={toDate} />
          </TabsContent>

          <TabsContent value="geography" className="flex-1 overflow-hidden mt-0">
            <Geography key={panelKey} fromDate={fromDate} toDate={toDate} />
          </TabsContent>

          <TabsContent value="team" className="flex-1 overflow-hidden mt-0">
            <TeamManagement key={panelKey} fromDate={fromDate} toDate={toDate} />
          </TabsContent>

          <TabsContent value="finance" className="flex-1 overflow-hidden mt-0">
            <FinanceStats key={panelKey} fromDate={fromDate} toDate={toDate} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
