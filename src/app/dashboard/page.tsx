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
    <div className="h-full flex flex-col">
      <Header />
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="general" className="h-full flex flex-col">
          <div className="border-b px-4 py-2 bg-card">
            <TabsList className="bg-muted/50 p-1">
              <TabsTrigger
                value="general"
                className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <BarChart3 className="h-4 w-4 text-primary" />
                Resumen General
              </TabsTrigger>
              <TabsTrigger
                value="analysis"
                className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <TrendingUp className="h-4 w-4 text-primary" />
                Análisis Comercial
              </TabsTrigger>
              <TabsTrigger
                value="geography"
                className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <MapPin className="h-4 w-4 text-primary" />
                Geografía & Clientes
              </TabsTrigger>
              <TabsTrigger
                value="team"
                className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Users className="h-4 w-4 text-primary" />
                Gestión de Equipo
              </TabsTrigger>
              <TabsTrigger
                value="finance"
                className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Wallet className="h-4 w-4 text-primary" />
                Finanzas
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="general" className="flex-1 overflow-hidden mt-0">
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
