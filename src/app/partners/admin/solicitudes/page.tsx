import type { Metadata } from "next";
import { SolicitudesPageContent } from "./_components/solicitudes-page-content";

export const metadata: Metadata = {
  title: "Solicitudes",
  description: "Solicitudes para ser partner de Powip pendientes de revisión.",
};

export default function PartnersAdminSolicitudesPage() {
  return <SolicitudesPageContent />;
}
