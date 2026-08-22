"use client";

import { useState } from "react";
import { Plus, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/superadmin/shared";
import { CampanasKpis } from "@/components/superadmin/campanas/CampanasKpis";
import { CampanasTable } from "@/components/superadmin/campanas/CampanasTable";
import { NuevaCampanaModal } from "@/components/superadmin/campanas/NuevaCampanaModal";

export default function CampanasPage() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <PageHeader
        title="Campañas"
        subtitle="Envío segmentado por WhatsApp y email a los negocios de la red."
        actions={
          <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Nueva campaña
          </Button>
        }
      />

      <div className="mb-5">
        <CampanasKpis />
      </div>

      <div className="mb-3.5 flex items-start gap-2 rounded-lg border bg-muted/40 px-3.5 py-2.5 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>WhatsApp usa plantillas aprobadas (UTILITY/MARKETING); respeta opt-out.</span>
      </div>

      <CampanasTable />

      <NuevaCampanaModal open={open} onOpenChange={setOpen} />
    </div>
  );
}
