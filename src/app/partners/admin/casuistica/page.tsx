import type { Metadata } from "next";
import { CasuisticaPageContent } from "./_components/casuistica-page-content";

export const metadata: Metadata = {
  title: "Casuística",
  description: "Referencia de todos los casos posibles del programa de partners y su resolución.",
};

export default function PartnersAdminCasuisticaPage() {
  return <CasuisticaPageContent />;
}
