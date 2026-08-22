"use client";

import { PageHeader, SectionHeader } from "@/components/superadmin/shared";
import { OperacionKpis } from "@/components/superadmin/operacion/OperacionKpis";
import { CajaCodTable } from "@/components/superadmin/operacion/CajaCodTable";
import { SunatGlobalTable } from "@/components/superadmin/operacion/SunatGlobalTable";
import { FraudeAlertasTable } from "@/components/superadmin/operacion/FraudeAlertasTable";

export default function SuperadminOperacionPage() {
  return (
    <div>
      <PageHeader
        title="Operación de Red"
        subtitle="Vigila el dinero en tránsito y el riesgo operativo/regulatorio de toda la red COD."
      />

      <OperacionKpis />

      <SectionHeader num={1} title="Caja & COD de la red" sub="Por empresa — GMV, COD en tránsito y liquidación pendiente" className="mt-7" />
      <CajaCodTable />

      <SectionHeader num={2} title="Monitor SUNAT global" className="mt-7" />
      <SunatGlobalTable />

      <SectionHeader num={3} title="Fraude / anomalías" className="mt-7 mb-7" />
      <FraudeAlertasTable />
    </div>
  );
}
