"use client";

import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { ClientesZonasSubtab } from "./ClientesZonasSubtab";
import { CanalesSubtab } from "./canales/CanalesSubtab";
import { ProductosSubtab } from "./ProductosSubtab";
import { PublicidadSubtab } from "./PublicidadSubtab";

export function VentasCanalesView() {
  const { view } = usePanel();
  if (view.access !== "permitido") return null;
  switch (view.subtab) {
    case "productos":
      return <ProductosSubtab />;
    case "publicidad":
      return <PublicidadSubtab />;
    case "clientes":
      return <ClientesZonasSubtab />;
    default:
      return <CanalesSubtab />;
  }
}
