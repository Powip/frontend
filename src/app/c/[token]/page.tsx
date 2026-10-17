import type { Metadata } from "next";
import PublicQuotationPage from "@/components/quotations/PublicQuotationPage";

export const metadata: Metadata = {
  title: "Tu cotización | POWIP",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicQuotationPage token={token} />;
}
