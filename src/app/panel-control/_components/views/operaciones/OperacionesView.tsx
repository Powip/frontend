"use client";

import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { ColaSubtab } from "./ColaSubtab";
import { CouriersSubtab } from "./CouriersSubtab";
import { InventarioSubtab } from "./InventarioSubtab";

export function OperacionesView() {
  const { view } = usePanel();
  if (view.access !== "permitido") return null;
  switch (view.subtab) {
    case "couriers":
      return <CouriersSubtab />;
    case "inventario":
      return <InventarioSubtab />;
    default:
      return <ColaSubtab />;
  }
}
