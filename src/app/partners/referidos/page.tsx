import type { Metadata } from "next";
import { ReferidosPageContent } from "./_components/referidos-page-content";

export const metadata: Metadata = {
  title: "Mis Referidos",
  description: "Listado completo de tus referidos, filtros por estado y alta de nuevos referidos.",
};

export default function PartnersReferidosPage() {
  return <ReferidosPageContent />;
}
