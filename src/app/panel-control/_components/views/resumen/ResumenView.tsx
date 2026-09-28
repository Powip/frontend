"use client";

import { useRef } from "react";
import { usePanelContract } from "@/features/panel-control/shared/hooks/use-panel-contract";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { AccionesHoyCard } from "./AccionesHoyCard";
import { ClientesCard } from "./ClientesCard";
import { FlujoPedidos } from "./FlujoPedidos";
import { InventarioCard } from "./InventarioCard";
import { ResumenHero } from "./ResumenHero";
import { VentasDiariasCard } from "./VentasDiariasCard";
import { VentasPorCanalCard } from "./VentasPorCanalCard";

export function ResumenView() {
  const { view } = usePanel();
  const resumen = usePanelContract("resumen", view.access === "permitido" ? view.query : null);
  const tituloAcciones = useRef<HTMLHeadingElement>(null);

  const verTareas = () => {
    const titulo = tituloAcciones.current;
    if (!titulo) return;
    titulo.scrollIntoView({ behavior: "smooth", block: "center" });
    titulo.focus({ preventScroll: true });
  };

  return (
    <div className="space-y-3.5">
      <ResumenHero state={resumen} onVerTareas={verTareas} />
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <AccionesHoyCard ref={tituloAcciones} state={resumen} />
        <VentasDiariasCard state={resumen} />
      </div>
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
        <VentasPorCanalCard state={resumen} />
        <ClientesCard state={resumen} />
        <InventarioCard state={resumen} />
      </div>
      <FlujoPedidos state={resumen} />
    </div>
  );
}
