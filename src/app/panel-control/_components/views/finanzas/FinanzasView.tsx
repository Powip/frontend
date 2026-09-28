"use client";

import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { CajaSubtab } from "./CajaSubtab";
import { CobranzaSubtab } from "./CobranzaSubtab";
import { ResultadoSubtab } from "./ResultadoSubtab";

export function FinanzasView() {
  const { view } = usePanel();
  if (view.access !== "permitido") return null;
  switch (view.subtab) {
    case "caja":
      return <CajaSubtab />;
    case "cobranza":
      return <CobranzaSubtab />;
    default:
      return <ResultadoSubtab />;
  }
}
