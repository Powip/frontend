"use client";

import { PageHeader, SectionHeader } from "@/components/superadmin/shared";
import { BusinessOverviewSection } from "@/components/superadmin/dashboard/BusinessOverviewSection";
import { ComposicionClientesCard } from "@/components/superadmin/dashboard/ComposicionClientesCard";
import { SaludPlataformaCard } from "@/components/superadmin/dashboard/SaludPlataformaCard";
import { ActividadRecienteCard } from "@/components/superadmin/dashboard/ActividadRecienteCard";
import { ClientesTopCard } from "@/components/superadmin/dashboard/ClientesTopCard";
import { ClientesEnRiesgoCard } from "@/components/superadmin/dashboard/ClientesEnRiesgoCard";
import { EmbudoProductoSoporteRow } from "@/components/superadmin/dashboard/EmbudoProductoSoporteRow";
import { CentroAccionCard } from "@/components/superadmin/dashboard/CentroAccionCard";
import { CanalesRedCard } from "@/components/superadmin/dashboard/CanalesRedCard";

export default function SuperadminDashboardPage() {
  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Cómo va el negocio hoy — y qué atender." />

      <BusinessOverviewSection />

      <SectionHeader num={2} title="Composición de clientes & Salud de la plataforma" className="mt-7" />
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <ComposicionClientesCard />
        <SaludPlataformaCard />
      </div>

      <SectionHeader num={3} title="Actividad en tiempo real & Clientes" className="mt-7" />
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <ActividadRecienteCard />
        <ClientesTopCard />
      </div>

      <SectionHeader num={4} title="Clientes en riesgo" className="mt-7" />
      <ClientesEnRiesgoCard />

      <SectionHeader num={5} title="Embudo comercial, producto y soporte" className="mt-7" />
      <EmbudoProductoSoporteRow />

      <SectionHeader num={6} title="Centro de Acción" className="mt-7" />
      <CentroAccionCard />

      <SectionHeader num={7} title="Canales de venta de la red" className="mt-7 mb-7" />
      <CanalesRedCard />
    </div>
  );
}
