import type { Metadata } from "next";
import LiveSellerPortal from "@/features/live/LiveSellerPortal";

/** FEAT-33 L5b: portal de creadoras y vendedores (`/vendedor/{tienda}` o `{tienda}.powip.lat/vendedor`). */
export const metadata: Metadata = {
  title: "Portal de creadoras | POWIP",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <LiveSellerPortal slug={slug} />;
}
