"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, ExportButton, SectionHeader } from "@/components/superadmin/shared";
import { EquipoKpis } from "@/components/superadmin/equipo/EquipoKpis";
import { EquipoTable } from "@/components/superadmin/equipo/EquipoTable";
import { MatrizPermisos } from "@/components/superadmin/equipo/MatrizPermisos";
import { InvitarMiembroModal } from "@/components/superadmin/equipo/InvitarMiembroModal";
import { useEquipo } from "@/hooks/superadmin/useEquipo";
import { ROL_LABEL } from "@/interfaces/superadmin";

export default function EquipoPage() {
  const [open, setOpen] = useState(false);
  const { data: equipo } = useEquipo();

  return (
    <div>
      <PageHeader
        title="Equipo & Permisos"
        subtitle="Equipo interno de POWIP, roles y matriz de permisos."
        actions={
          <>
            <ExportButton
              filename="equipo"
              rows={equipo.map((m) => ({
                Nombre: m.nombre,
                Email: m.email,
                Rol: ROL_LABEL[m.rol],
                Estado: m.estado,
              }))}
            />
            <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
              <UserPlus className="h-3.5 w-3.5" />
              Invitar miembro
            </Button>
          </>
        }
      />

      <div className="mb-5">
        <EquipoKpis />
      </div>

      <div className="mb-6">
        <SectionHeader title="Equipo" sub="Miembros internos y su acceso por rol." />
        <EquipoTable />
      </div>

      <SectionHeader title="Matriz de permisos" sub="Click en una celda para simular el toggle de acceso." />
      <MatrizPermisos />

      <InvitarMiembroModal open={open} onOpenChange={setOpen} />
    </div>
  );
}
