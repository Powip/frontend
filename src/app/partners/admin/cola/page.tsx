import type { Metadata } from "next";
import { ColaPageContent } from "./_components/cola-page-content";

export const metadata: Metadata = {
  title: "Cola de referidos",
  description: "Cola persistida de referidos manuales y CODE, de solo lectura.",
};

export default function PartnersAdminColaPage() {
  return <ColaPageContent />;
}
