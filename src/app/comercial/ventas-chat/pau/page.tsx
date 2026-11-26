import PauView, { type PauTab } from "@/components/ventas-chat/PauView";

const TABS: PauTab[] = ["modo", "pers", "perm", "prov", "apr", "cons"];

/** `?tab=apr` abre «Aprende» (chip «Pau aprendió esto» de la Bandeja). */
export default async function PauPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const raw = (await searchParams).tab;
  const tab = TABS.find((t) => t === (Array.isArray(raw) ? raw[0] : raw));
  return <PauView defaultTab={tab} />;
}
