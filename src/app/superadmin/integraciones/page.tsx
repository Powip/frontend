"use client";

import { PageHeader } from "@/components/superadmin/shared";
import { IntegracionesKpis } from "@/components/superadmin/integraciones/IntegracionesKpis";
import { IntegracionesGrid } from "@/components/superadmin/integraciones/IntegracionesGrid";

export default function IntegracionesPage() {
  return (
    <div>
      <PageHeader
        title="Integraciones"
        subtitle="Estado y control de las integraciones de la plataforma."
      />

      <div className="mb-5">
        <IntegracionesKpis />
      </div>

      <IntegracionesGrid />
    </div>
  );
}
