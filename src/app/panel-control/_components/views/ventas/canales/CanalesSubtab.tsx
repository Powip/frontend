"use client";

import { useRef, useState } from "react";
import type { VistaComparativo } from "@/features/panel-control/canales/models/canales-comparativo.model";
import { usePanelContract } from "@/features/panel-control/shared/hooks/use-panel-contract";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { OrigenCanalesNota } from "../OrigenCanalesNota";
import { CanalesLista } from "./CanalesLista";
import { CanalSeleccionado } from "./CanalSeleccionado";
import { ComparativoCanales } from "./ComparativoCanales";
import { TendenciaFamilias } from "./TendenciaFamilias";

export function CanalesSubtab() {
  const { view } = usePanel();
  const query = view.access === "permitido" ? view.query : null;
  const verGanancia = view.access === "permitido" && view.capabilities.has("ver_costos");
  const [vistaElegida, setVista] = useState<VistaComparativo>("ventas");
  const [elegido, setElegido] = useState<string | null>(null);
  const detalleRef = useRef<HTMLDivElement>(null);
  const vista = vistaElegida === "ganancia" && !verGanancia ? "ventas" : vistaElegida;

  const ventas = usePanelContract(
    "canales-comparativo",
    query ? { ...query, vista: "ventas" } : null,
  );
  const entregas = usePanelContract(
    "canales-comparativo",
    query ? { ...query, vista: "entregas" } : null,
  );
  const ganancia = usePanelContract(
    "canales-comparativo",
    query && vista === "ganancia" ? { ...query, vista: "ganancia" } : null,
  );
  const comparativo = vista === "ventas" ? ventas : vista === "entregas" ? entregas : ganancia;

  const ventasActual = ventas.data?.actual;
  const candidatos =
    ventasActual?.vista === "ventas"
      ? [...ventasActual.filas]
          .filter((fila): fila is typeof fila & { canalId: string } => fila.canalId !== null)
          .sort((a, b) => b.facturacion - a.facturacion)
          .map((fila) => fila.canalId)
      : [];
  const existentes = new Set(ventasActual?.canales.map((ficha) => ficha.id) ?? []);
  const filtrado = query?.canal && existentes.has(query.canal) ? query.canal : null;
  const seleccionado =
    filtrado ??
    (elegido && existentes.has(elegido)
      ? elegido
      : (candidatos[0] ?? ventasActual?.canales[0]?.id ?? null));

  const detalle = usePanelContract(
    "canales-detalle",
    query && seleccionado ? { ...query, canal_id: seleccionado } : null,
  );

  const seleccionar = (canalId: string) => {
    setElegido(canalId);
    const destino = detalleRef.current;
    if (destino && destino.getBoundingClientRect().top > window.innerHeight * 0.6) {
      destino.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="space-y-3.5">
      <OrigenCanalesNota state={ventas} />
      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[minmax(280px,340px)_1fr]">
        <CanalesLista
          ventas={ventas}
          entregas={entregas}
          seleccionado={seleccionado}
          onSeleccionar={seleccionar}
        />
        <div ref={detalleRef} className="min-w-0 scroll-mt-4">
          <CanalSeleccionado state={detalle} />
        </div>
      </div>
      <ComparativoCanales
        state={comparativo}
        vista={vista}
        onVista={setVista}
        verGanancia={verGanancia}
      />
      <TendenciaFamilias state={ventas} />
    </div>
  );
}
