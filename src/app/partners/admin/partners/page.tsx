import type { Metadata } from "next";
import { PartnersListPageContent } from "./_components/partners-list-page-content";

export const metadata: Metadata = {
  title: "Partners",
  description: "Listado de partners del programa: perfil, opción, nivel y estado.",
};

export default function PartnersAdminPartnersPage() {
  return <PartnersListPageContent />;
}
