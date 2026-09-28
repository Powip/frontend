"use client";

import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { ConfirmadorasSubtab } from "./ConfirmadorasSubtab";
import { VendedorasSubtab } from "./VendedorasSubtab";

export function EquipoView() {
  const { view } = usePanel();
  if (view.access !== "permitido") return null;
  return view.subtab === "confirmadoras" ? <ConfirmadorasSubtab /> : <VendedorasSubtab />;
}
