"use client";

import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/superadmin/shared";
import { FiltersBar } from "@/components/superadmin/shared/FiltersBar";
import { LogsKpis } from "@/components/superadmin/logs/LogsKpis";
import { LogsTable } from "@/components/superadmin/logs/LogsTable";
import { NivelLog } from "@/interfaces/superadmin";

export default function LogsPage() {
  const [nivel, setNivel] = useState<NivelLog | "todos">("todos");

  return (
    <div>
      <PageHeader title="Logs del sistema" subtitle="Registro técnico de eventos en tiempo real." />

      <div className="mb-5">
        <LogsKpis />
      </div>

      <FiltersBar>
        <Select value={nivel} onValueChange={(v) => setNivel(v as NivelLog | "todos")}>
          <SelectTrigger className="h-9 w-[160px] text-xs">
            <SelectValue placeholder="Nivel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los niveles</SelectItem>
            <SelectItem value="info">info</SelectItem>
            <SelectItem value="warn">warn</SelectItem>
            <SelectItem value="error">error</SelectItem>
          </SelectContent>
        </Select>
      </FiltersBar>

      <LogsTable nivel={nivel} />
    </div>
  );
}
