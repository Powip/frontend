import type { Metadata } from "next";
import { LiquidacionesPageContent } from "./_components/liquidaciones-page-content";

export const metadata: Metadata = {
  title: "Liquidaciones",
  description: "Pagos del ciclo, reversos/clawback y referidos en cola por umbral.",
};

export default function PartnersAdminLiquidacionesPage() {
  return <LiquidacionesPageContent />;
}
