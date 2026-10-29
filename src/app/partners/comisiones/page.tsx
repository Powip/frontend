import type { Metadata } from "next";
import { ComisionesPageContent } from "./_components/comisiones-page-content";

export const metadata: Metadata = {
  title: "Comisiones",
  description: "Detalle de comisiones por referido: neto pagado, comisión de 1er mes y recurrente.",
};

export default function PartnersComisionesPage() {
  return <ComisionesPageContent />;
}
