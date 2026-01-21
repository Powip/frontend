"use client";
import { useState } from "react";
import { Stats } from "@/components/dashboard/stats";
import Header from "@/components/header/Header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BarChart3, TrendingUp, MapPin } from "lucide-react";
import { Analysis } from "@/components/dashboard/analysis";
import { Geography } from "@/components/dashboard/geography";

export default function DashboardPage() {
  return (
    <div className="h-full flex flex-col">
      <Header />
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="general" className="h-full flex flex-col">
          <div className="border-b px-4 py-2">
            <TabsList>
              <TabsTrigger value="general" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                Dashboard General
              </TabsTrigger>
              <TabsTrigger value="analysis" className="gap-2">
                <TrendingUp className="h-4 w-4" />
                Análisis Comercial
              </TabsTrigger>
              <TabsTrigger value="geography" className="gap-2">
                <MapPin className="h-4 w-4" />
                Geografía & Facturación
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="general" className="flex-1 overflow-hidden">
            <Stats />
          </TabsContent>
          
          <TabsContent value="analysis" className="flex-1 overflow-hidden">
            <Analysis />
          </TabsContent>
          
          <TabsContent value="geography" className="flex-1 overflow-hidden">
            <Geography />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

