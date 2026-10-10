import type { Metadata } from "next";
import { LinkPageContent } from "./_components/link-page-content";

export const metadata: Metadata = {
  title: "Mi Link y Código",
  description: "Tu link único y código de referido, estadísticas y kit para compartir.",
};

export default function PartnersLinkPage() {
  return <LinkPageContent />;
}
