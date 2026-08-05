"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CalendarClock, ClipboardList, Radar, Settings2, PackagePlus, ScanLine } from "lucide-react";
import GuiasKpiRow from "./_components/GuiasKpiRow";
import PlanificacionTab from "./_components/PlanificacionTab";
import GuiasActivasTab from "./_components/GuiasActivasTab";
import RastreoCourierTab from "./_components/RastreoCourierTab";
import CouriersTarifasTab from "./_components/CouriersTarifasTab";
import NuevaGuiaDialog from "./_components/NuevaGuiaDialog";
import { GlobalScanner } from "../_shared/GlobalScanner";
import { PowipPulseLoader } from "../_shared/PowipPulseLoader";

/* -----------------------------------------------------------------------
   Guías & Courier — pantalla del módulo Operaciones nuevo.
   4 pestañas (mockup v6 — "Armar Guía" dejó de ser pestaña propia): Planificación
   (confirma agendados hacia Preparados), Guías Activas (tabla + gestión),
   Rastreo Courier (Shalom/Aliclik/EVA/Todos) y Couriers & Tarifas (tarifario
   de transporte + integraciones fulfillment). Armar una guía ahora se hace
   únicamente desde Pedidos › Por Despachar, o desde el botón "+ Nueva guía"
   de este header (mismo picker, como diálogo en vez de pestaña).

   Contrato de query params (useSearchParams):
   - tab: agenda|activas|rastreo|config
   - qf: filtro rápido que manda el Tablero (ej. "sin-tracking" → Rastreo Courier)
------------------------------------------------------------------------ */

type GuiasTabKey = "agenda" | "activas" | "rastreo" | "config";

const TABS: { key: GuiasTabKey; label: string; icon: React.ReactNode }[] = [
  { key: "agenda", label: "Planificación", icon: <CalendarClock className="h-4 w-4" /> },
  { key: "activas", label: "Guías Activas", icon: <ClipboardList className="h-4 w-4" /> },
  { key: "rastreo", label: "Rastreo Courier", icon: <Radar className="h-4 w-4" /> },
  { key: "config", label: "Couriers & Tarifas", icon: <Settings2 className="h-4 w-4" /> },
];

function GuiasPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [nuevaGuiaOpen, setNuevaGuiaOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  const tabParam = searchParams.get("tab");
  const activeTab: GuiasTabKey = TABS.some((t) => t.key === tabParam)
    ? (tabParam as GuiasTabKey)
    : "agenda";
  const qf = searchParams.get("qf") || undefined;

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    // qf solo tiene sentido para la pestaña a la que apuntó el Tablero; al
    // cambiar de pestaña a mano lo limpiamos para no arrastrar un filtro fantasma.
    if (value !== activeTab) params.delete("qf");
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Guías &amp; Courier</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Planifica lo que sale, controla las guías activas y su rastreo, y administra couriers y tarifas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className="gap-1.5 bg-violet-600 text-white hover:bg-violet-700"
            onClick={() => setScannerOpen(true)}
          >
            <ScanLine className="h-4 w-4" />
            Escanear
          </Button>
          <Button className="gap-1.5 bg-teal-600 text-white hover:bg-teal-700" onClick={() => setNuevaGuiaOpen(true)}>
            <PackagePlus className="h-4 w-4" />
            Nueva guía
          </Button>
        </div>
      </div>

      <GuiasKpiRow />

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="h-auto w-full gap-1 bg-muted/60 p-1">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key} className="flex-1 gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium sm:text-sm">
              {t.icon}
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="agenda" className="mt-4">
          <PlanificacionTab />
        </TabsContent>
        <TabsContent value="activas" className="mt-4">
          <GuiasActivasTab />
        </TabsContent>
        <TabsContent value="rastreo" className="mt-4">
          <RastreoCourierTab qf={qf} />
        </TabsContent>
        <TabsContent value="config" className="mt-4">
          <CouriersTarifasTab />
        </TabsContent>
      </Tabs>

      <NuevaGuiaDialog open={nuevaGuiaOpen} onOpenChange={setNuevaGuiaOpen} />
      <GlobalScanner open={scannerOpen} onOpenChange={setScannerOpen} />
    </div>
  );
}

export default function GuiasPage() {
  return (
    <Suspense fallback={<PowipPulseLoader label="Cargando guías..." />}>
      <GuiasPageInner />
    </Suspense>
  );
}
