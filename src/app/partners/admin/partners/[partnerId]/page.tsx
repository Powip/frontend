import type { Metadata } from "next";
import { PartnerDetailPageContent } from "./_components/partner-detail-page-content";

export const metadata: Metadata = {
  title: "Ficha de partner",
  description: "Detalle de referidos, comisiones y actividad de un partner.",
};

export default async function PartnerDetailPage({
  params,
}: {
  params: Promise<{ partnerId: string }>;
}) {
  const { partnerId } = await params;
  return <PartnerDetailPageContent partnerId={partnerId} />;
}
