"use client";
import { useState } from "react";
import { Stats } from "@/components/dashboard/stats";
import Header from "@/components/header/Header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Analysis } from "@/components/dashboard/analysis";
import { Geography } from "@/components/dashboard/geography";
import { TeamManagement } from "@/components/dashboard/TeamManagement";
import { FinanceStats } from "@/components/dashboard/FinanceStats";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";

export default function DashboardPage() {
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  console.log("[DEBUG] DashboardPage renderizando");

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
            Resumen General de Operaciones
          </p>
        </div>
        <div className="flex items-center gap-4">
          <PeriodSelector onPeriodChange={handlePeriodChange} />
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <Tabs defaultValue="general" className="flex-1 flex flex-col min-h-0">
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
            <Stats fromDate={fromDate} toDate={toDate} />
          </TabsContent>

          <TabsContent value="analysis" className="flex-1 overflow-hidden mt-0">
            <Analysis fromDate={fromDate} toDate={toDate} />
          </TabsContent>

          <TabsContent value="geography" className="flex-1 overflow-hidden mt-0">
            <Geography fromDate={fromDate} toDate={toDate} />
          </TabsContent>

          <TabsContent value="team" className="flex-1 overflow-hidden mt-0">
            <TeamManagement fromDate={fromDate} toDate={toDate} />
          </TabsContent>

          <TabsContent value="finance" className="flex-1 overflow-hidden mt-0">
            <FinanceStats fromDate={fromDate} toDate={toDate} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
