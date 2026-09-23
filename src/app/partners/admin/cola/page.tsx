import type { Metadata } from "next";
import { ColaPageContent } from "./_components/cola-page-content";

export const metadata: Metadata = {
  title: "Cola de referidos",
  description: "Revisión de conflictos de atribución, alertas anti-fraude y confirmación de pagos.",
};

export default function PartnersAdminColaPage() {
  return <ColaPageContent />;
}
