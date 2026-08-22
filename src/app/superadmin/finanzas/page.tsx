"use client";

import { PageHeader, SectionHeader } from "@/components/superadmin/shared";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FinanzasKpis } from "@/components/superadmin/finanzas/FinanzasKpis";
import { MrrWaterfallCard } from "@/components/superadmin/finanzas/MrrWaterfallCard";
import { IngresosFuenteCard } from "@/components/superadmin/finanzas/IngresosFuenteCard";
import { MetaMesCard } from "@/components/superadmin/finanzas/MetaMesCard";
import { CobrosTable } from "@/components/superadmin/finanzas/CobrosTable";
import { CohortesTable } from "@/components/superadmin/finanzas/CohortesTable";

export default function FinanzasPage() {
  return (
    <div>
      <PageHeader title="Finanzas POWIP" subtitle="P&L y proyección del SaaS — cuánto facturamos y con cuánto cerramos." />

      <FinanzasKpis />

      <Tabs defaultValue="resumen" className="mt-6">
        <TabsList>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="cohortes">Cohortes</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="mt-4">
          <SectionHeader num={1} title="MRR de cierre y fuentes de ingreso" />
          <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[1.6fr_1fr_1fr]">
            <MrrWaterfallCard />
            <IngresosFuenteCard />
            <MetaMesCard />
          </div>

          <SectionHeader num={2} title="Detalle de cobros" className="mt-7" />
          <CobrosTable />
        </TabsContent>

        <TabsContent value="cohortes" className="mt-4">
          <SectionHeader num={1} title="Retención por cohorte de alta" sub="Sección 8.22" />
          <CohortesTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}
