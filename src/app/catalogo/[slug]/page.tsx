import LiveStorefront from "@/features/live/LiveStorefront";
export const metadata = { title: "Catálogo | POWIP Link", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function Page({params}:{params:Promise<{slug:string}>}) { const {slug}=await params; return <LiveStorefront slug={slug}/>; }
