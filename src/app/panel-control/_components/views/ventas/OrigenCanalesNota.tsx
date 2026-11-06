"use client";

import type { PanelContractState } from "@/features/panel-control/shared/hooks/use-panel-contract";
import { usePanelOptions } from "@/features/panel-control/shared/hooks/use-panel-options";
import type { PanelContractId } from "@/features/panel-control/shared/models/panel-contract.model";

export function OrigenCanalesNota<K extends PanelContractId>({
  state,
}: {
  state: PanelContractState<K>;
}) {
  const { canales } = usePanelOptions();
  if (state.status !== "listo" || state.origin.kind !== "demo") return null;
  const nombresReales =
    canales.status === "listo" && canales.origin.kind === "real" && (canales.data?.length ?? 0) > 0;
  return (
    <p
      role="note"
      className="rounded-xl border border-pc-demo/30 bg-pc-demo-soft px-3 py-2 text-xs text-pc-demo"
    >
      <b>Cifras demo.</b>{" "}
      {nombresReales
        ? "Los nombres de canal vienen de tu catálogo real, pero los montos, pedidos, la familia, la comisión, la pasarela y la meta de cada canal son de demostración."
        : "Canales, montos y pedidos son de demostración."}{" "}
      Endpoint pendiente: {state.origin.endpoint}.
    </p>
  );
}
