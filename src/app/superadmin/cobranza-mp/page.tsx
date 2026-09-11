"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, SectionHeader } from "@/components/superadmin/shared";
import { ComisionesMpKpis } from "@/components/superadmin/comisionesMp/ComisionesMpKpis";
import { ComisionesPorFuenteCard } from "@/components/superadmin/comisionesMp/ComisionesPorFuenteCard";
import { ComisionesPorEmpresaTable } from "@/components/superadmin/comisionesMp/ComisionesPorEmpresaTable";
import { CuentasMpTable } from "@/components/superadmin/comisionesMp/CuentasMpTable";
import { LiquidacionesMpTable } from "@/components/superadmin/comisionesMp/LiquidacionesMpTable";
import { MetodosPagoTable } from "@/components/superadmin/comisionesMp/MetodosPagoTable";

export default function CobranzaMpPage() {
  return (
    <div>
      <PageHeader
        title="Cobranza MP"
        subtitle="El 0.5% que nace en cada pago con Mercado Pago, más las cuentas conectadas y liquidaciones del modo temporal. Yape directo no genera comisión."
      />

      <div className="mb-6">
        <ComisionesMpKpis />
      </div>

      <Tabs defaultValue="comisiones">
        <TabsList className="mb-4 flex-wrap h-auto justify-start gap-1 bg-transparent p-0">
          {[
            ["comisiones", "Comisiones"],
            ["cuentas", "Cuentas MP"],
            ["liquidaciones", "Liquidaciones"],
            ["metodos", "Métodos de pago"],
          ].map(([value, label]) => (
            <TabsTrigger key={value} value={value} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="comisiones">
          <SectionHeader num={1} title="Comisión por fuente del cobro" />
          <div className="mb-7 grid grid-cols-1 gap-3.5 xl:grid-cols-[1fr_1.6fr]">
            <ComisionesPorFuenteCard />
            <div className="rounded-xl border bg-card p-4 text-xs leading-relaxed text-muted-foreground shadow-sm">
              <b className="text-foreground">El 0.5% aplica solo a pagos por Mercado Pago</b> — tarjeta y también Yape
              dentro de MP (checkout marketplace/split, 99.5% al negocio / 0.5% a Powip). El Yape directo al número
              del negocio no pasa por la pasarela y genera 0% de comisión.
            </div>
          </div>

          <SectionHeader num={2} title="Comisión por negocio" className="mt-7" />
          <ComisionesPorEmpresaTable />
        </TabsContent>

        <TabsContent value="cuentas">
          <SectionHeader title="Cuentas Mercado Pago por negocio" sub="Modo propia (split automático) o powip_temporal (liquidación manual)" />
          <CuentasMpTable />
        </TabsContent>

        <TabsContent value="liquidaciones">
          <SectionHeader title="Liquidar negocios en modo powip_temporal" sub="Negocios sin cuenta MP propia — el 100% entra a Powip y se liquida el 99.5% manual" />
          <LiquidacionesMpTable />
        </TabsContent>

        <TabsContent value="metodos">
          <SectionHeader title="Métodos de pago por negocio" sub="Control exclusivo de Super Admin — el negocio no puede activarlos por su cuenta" />
          <MetodosPagoTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}
