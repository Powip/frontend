import type { Metadata } from "next";
import PublicLivePage from "@/features/live/PublicLivePage";

export const metadata: Metadata = {
  title: "Catálogo del live | POWIP",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function Page({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  return <PublicLivePage storeId={storeId} />;
}
