import type { Metadata } from "next";
import LiveStorefront from "@/features/live/LiveStorefront";

export const metadata: Metadata = {
  title: "Catálogo del live | POWIP",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function Page({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  return <LiveStorefront slug={storeId} />;
}
