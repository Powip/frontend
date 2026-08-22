"use client";

import { PageHeader } from "@/components/superadmin/shared";
import { AgentesKpis } from "@/components/superadmin/agentes/AgentesKpis";
import { AgentesGrid } from "@/components/superadmin/agentes/AgentesGrid";

export default function AgentesPage() {
  return (
    <div>
      <PageHeader title="Agentes IA" subtitle="Asistentes de IA configurables de la plataforma." />

      <div className="mb-5">
        <AgentesKpis />
      </div>

      <AgentesGrid />
    </div>
  );
}
