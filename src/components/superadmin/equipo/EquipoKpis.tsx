"use client";

import { useQuery } from "@tanstack/react-query";
import { Users, Layers, Mail, ShieldCheck } from "lucide-react";
import { getKpisEquipo } from "@/services/superadmin/equipoService";
import { KpiCard, KpiCardSkeleton } from "@/components/superadmin/shared";

export function EquipoKpis() {
  const { data, isLoading } = useQuery({ queryKey: ["superadmin", "equipo", "kpis"], queryFn: getKpisEquipo });

  if (isLoading || !data) {
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
      <KpiCard icon={Users} color="teal" label="Miembros" value={data.total} />
      <KpiCard icon={Layers} color="violet" label="Roles en uso" value={data.roles} />
      <KpiCard icon={Mail} color="blue" label="Invitaciones" value={data.invitaciones} />
      <KpiCard icon={ShieldCheck} color="amber" label="Super Admins" value={data.superAdmins} />
    </div>
  );
}
