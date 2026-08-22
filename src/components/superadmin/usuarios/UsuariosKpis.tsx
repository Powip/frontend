"use client";

import { useQuery } from "@tanstack/react-query";
import { Users, ShieldCheck, UserCog, UserPlus } from "lucide-react";
import { getKpisUsuarios } from "@/services/superadmin/empresasService";
import { KpiCard, KpiCardSkeleton } from "@/components/superadmin/shared";

export function UsuariosKpis() {
  const { data, isLoading } = useQuery({ queryKey: ["superadmin", "usuarios", "kpis"], queryFn: getKpisUsuarios });

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <KpiCardSkeleton key={i} />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard icon={Users} color="teal" label="Totales" value={data.total} />
      <KpiCard icon={ShieldCheck} color="violet" label="Super Admins" value={data.superAdmins} />
      <KpiCard icon={UserCog} color="blue" label="Admins vinculados" value={data.admins} />
      <KpiCard icon={UserPlus} color="green" label="Nuevos 7d" value={data.nuevos7d} />
    </div>
  );
}
