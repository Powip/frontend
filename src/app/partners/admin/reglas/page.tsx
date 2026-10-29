import type { Metadata } from "next";
import { ReglasPageContent } from "./_components/reglas-page-content";

export const metadata: Metadata = {
  title: "Reglas & Comisiones",
  description: "Versiones DRAFT de políticas de comisiones, sin activación financiera.",
};

export default function PartnersAdminReglasPage() {
  return <ReglasPageContent />;
}
