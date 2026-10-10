import type { Metadata } from "next";
import { ResumenPageContent } from "./_components/resumen-page-content";

export const metadata: Metadata = {
  title: "Resumen | Partners | Powip",
  description: "Comisiones, nivel y últimos referidos de tu programa de partners en Powip.",
};

export default function PartnersResumenPage() {
  return <ResumenPageContent />;
}
