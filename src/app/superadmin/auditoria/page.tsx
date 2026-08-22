"use client";

import { useState } from "react";
import { PageHeader, ExportButton } from "@/components/superadmin/shared";
import { FiltersBar, SearchInput } from "@/components/superadmin/shared/FiltersBar";
import { formatDateTime } from "@/components/superadmin/shared/format";
import { AuditoriaTable } from "@/components/superadmin/auditoria/AuditoriaTable";
import { auditLogMock } from "@/mocks/superadmin";
import { matchesQuery } from "@/services/superadmin/shared";

export default function AuditoriaPage() {
  const [q, setQ] = useState("");

  const exportRows = auditLogMock
    .filter((a) => matchesQuery([a.actorNombre, a.accion, a.entidad], q))
    .map((a) => ({
      Fecha: formatDateTime(a.ts),
      Usuario: a.actorNombre,
      Acción: a.accion,
      Entidad: a.entidad,
      "Entidad ID": a.entidadId,
      Antes: a.antes ? JSON.stringify(a.antes) : "—",
      Después: a.despues ? JSON.stringify(a.despues) : "—",
      IP: a.ip,
    }));

  return (
    <div>
      <PageHeader
        title="Auditoría"
        subtitle="Trazabilidad de acciones sensibles."
        actions={<ExportButton filename="auditoria" rows={exportRows} />}
      />

      <div className="mb-4 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2.5 text-xs font-medium text-blue-800 dark:text-blue-300">
        Todo cambio de plan, estado, %, e impersonación queda registrado aquí.
      </div>

      <FiltersBar>
        <SearchInput value={q} onChange={setQ} placeholder="Buscar por usuario, acción o entidad…" />
      </FiltersBar>

      <AuditoriaTable q={q} />
    </div>
  );
}
