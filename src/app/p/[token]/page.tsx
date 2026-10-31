import LiveOrderTracking from "@/features/live/LiveOrderTracking";
export const metadata = { title: "Mi pedido | POWIP Link", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function Page({params}:{params:Promise<{token:string}>}) { const {token}=await params; return <LiveOrderTracking token={token}/>; }
