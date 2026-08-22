"use client";

import { PageHeader, SectionHeader } from "@/components/superadmin/shared";
import { OportunidadesKpis } from "@/components/superadmin/oportunidades/OportunidadesKpis";
import { AlertasProactivasCard } from "@/components/superadmin/oportunidades/AlertasProactivasCard";
import { RadarUpsellTable } from "@/components/superadmin/oportunidades/RadarUpsellTable";
import { CouriersRedCard } from "@/components/superadmin/oportunidades/CouriersRedCard";
import { SegmentacionRedCard } from "@/components/superadmin/oportunidades/SegmentacionRedCard";
import { CanalesRedCard } from "@/components/superadmin/dashboard/CanalesRedCard";

export default function SuperadminOportunidadesPage() {
  return (
    <div>
      <PageHeader
        title="Oportunidades"
        subtitle="Vista transversal de crecimiento de toda la red: upsell, recaudo, riesgos y canales."
      />

      <OportunidadesKpis />

      <SectionHeader num={1} title="Alertas proactivas" className="mt-7" />
      <AlertasProactivasCard />

      <SectionHeader num={2} title="Radar de upsell" sub="Ordenado por MRR potencial" className="mt-7" />
      <RadarUpsellTable />

      <SectionHeader num={3} title="Couriers y segmentación de la red" className="mt-7" />
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <CouriersRedCard />
        <SegmentacionRedCard />
      </div>

      <SectionHeader num={4} title="Canales de venta de la red" className="mt-7 mb-7" />
      <CanalesRedCard />
    </div>
  );
}
