import { PublicTrackingView } from "./PublicTrackingView";

export const metadata = {
  title: "Seguimiento de tu pedido",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicTrackingView token={token} />;
}
