import type { Metadata } from "next";
import { ReglasPageContent } from "./_components/reglas-page-content";

export const metadata: Metadata = {
  title: "Reglas & Comisiones",
  description: "Editor de comisiones por opción, niveles, descuentos y reglas del programa.",
};

export default function PartnersAdminReglasPage() {
  return <ReglasPageContent />;
}
