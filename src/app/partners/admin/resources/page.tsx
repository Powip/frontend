import type { Metadata } from "next";
import { ResourcesPageContent } from "./_components/resources-page-content";

export const metadata: Metadata = {
  title: "Recursos de Partners",
  description: "Metadatos de recursos del programa con estados DRAFT, PUBLISHED y ARCHIVED.",
};
export default function PartnersAdminResourcesPage() {
  return <ResourcesPageContent />;
}
