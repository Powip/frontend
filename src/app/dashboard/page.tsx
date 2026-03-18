"use client";
import { useState } from "react";
import { Stats } from "@/components/dashboard/stats";
import Header from "@/components/header/Header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Analysis } from "@/components/dashboard/analysis";
import { Geography } from "@/components/dashboard/geography";
import { TeamManagement } from "@/components/dashboard/TeamManagement";
import { FinanceStats } from "@/components/dashboard/FinanceStats";
import { BarChart3, TrendingUp, MapPin, Users, Wallet } from "lucide-react";

export default function DashboardPage() {
  console.log("[DEBUG] DashboardPage renderizando");

  return (
    <div className="h-full flex flex-col bg-background">
      <Header />
      <div className="flex-1 overflow-hidden flex flex-col">
        <Tabs defaultValue="general" className="flex-1 flex flex-col min-h-0">
          <div className="px-8 border-b border-border bg-background">
            <TabsList className="bg-transparent p-0 gap-8 flex justify-start items-center h-12">
              <TabsTrigger
                value="general"
                className="h-12 p-0 px-2 rounded-none bg-transparent data-[state=active]:bg-transparent border-t-0 border-x-0 border-b-2 border-transparent data-[state=active]:border-[#00f2ad] text-muted-foreground data-[state=active]:text-foreground font-medium transition-all duration-300 shadow-none data-[state=active]:shadow-none"
              >
                Resumen General
              </TabsTrigger>
              <TabsTrigger
                value="analysis"
                className="h-12 p-0 px-2 rounded-none bg-transparent data-[state=active]:bg-transparent border-t-0 border-x-0 border-b-2 border-transparent data-[state=active]:border-[#00f2ad] text-muted-foreground data-[state=active]:text-foreground font-medium transition-all duration-300 shadow-none data-[state=active]:shadow-none"
              >
                Análisis Comercial
              </TabsTrigger>
              <TabsTrigger
                value="geography"
                className="h-12 p-0 px-2 rounded-none bg-transparent data-[state=active]:bg-transparent border-t-0 border-x-0 border-b-2 border-transparent data-[state=active]:border-[#00f2ad] text-muted-foreground data-[state=active]:text-foreground font-medium transition-all duration-300 shadow-none data-[state=active]:shadow-none"
              >
                Geografía & Clientes
              </TabsTrigger>
              <TabsTrigger
                value="team"
                className="h-12 p-0 px-2 rounded-none bg-transparent data-[state=active]:bg-transparent border-t-0 border-x-0 border-b-2 border-transparent data-[state=active]:border-[#00f2ad] text-muted-foreground data-[state=active]:text-foreground font-medium transition-all duration-300 shadow-none data-[state=active]:shadow-none"
              >
                Gestión de Equipo
              </TabsTrigger>
              <TabsTrigger
                value="finance"
                className="h-12 p-0 px-2 rounded-none bg-transparent data-[state=active]:bg-transparent border-t-0 border-x-0 border-b-2 border-transparent data-[state=active]:border-[#00f2ad] text-muted-foreground data-[state=active]:text-foreground font-medium transition-all duration-300 shadow-none data-[state=active]:shadow-none"
              >
                Finanzas
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="general" className="flex-1 overflow-auto mt-0 scrollbar-none outline-none">
            <Stats />
          </TabsContent>

          <TabsContent value="analysis" className="flex-1 overflow-hidden mt-0">
            <Analysis />
          </TabsContent>

          <TabsContent
            value="geography"
            className="flex-1 overflow-hidden mt-0"
          >
            <Geography />
          </TabsContent>

          <TabsContent value="team" className="flex-1 overflow-hidden mt-0">
            <TeamManagement />
          </TabsContent>

          <TabsContent value="finance" className="flex-1 overflow-hidden mt-0">
            <FinanceStats />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
