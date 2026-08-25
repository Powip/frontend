"use client";

import { Users, Layers, Mail, ShieldCheck } from "lucide-react";
import { useKpisEquipo } from "@/hooks/superadmin/useEquipo";
import { KpiCard, KpiCardSkeleton } from "@/components/superadmin/shared";

export function EquipoKpis() {
  const { data, isLoading, isSimulado } = useKpisEquipo();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard icon={Users} color="teal" label="Miembros" value={data.total} simulado={isSimulado} />
      <KpiCard icon={Layers} color="violet" label="Roles en uso" value={data.roles} simulado={isSimulado} />
      <KpiCard icon={Mail} color="blue" label="Invitaciones" value={data.invitaciones} simulado={isSimulado} />
      <KpiCard icon={ShieldCheck} color="amber" label="Super Admins" value={data.superAdmins} simulado={isSimulado} />
    </div>
  );
}
