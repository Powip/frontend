import type { Metadata } from "next";
import { PublicTrackingPage } from "@/components/public-tracking/PublicTrackingPage";

export const metadata: Metadata = {
  title: "Seguimiento de pedido",
  robots: { index: false, follow: false },
  openGraph: null,
};

export default function PublicOrderTrackingRoute() {
  return <PublicTrackingPage state={{ kind: "pending-integration" }} />;
}
