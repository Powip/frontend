import { redirect } from "next/navigation";
import LiveStorefront from "@/features/live/LiveStorefront";
export const metadata = { title: "Catálogo | POWIP Link", robots: { index: false, follow: false }, referrer: "no-referrer" };

/**
 * FEAT-33 A12: el link viejo de asesora (/catalogo/{tienda}?a=CÓDIGO) pasa al formato único /live/{tienda}?a=CÓDIGO
 * (mismo canal POWIP Link). Sin código sigue abriendo el catálogo de siempre para no romper links compartidos.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = (await searchParams) ?? {};
  if (typeof query.a === "string" && query.a) {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(query))
      for (const item of Array.isArray(value) ? value : value ? [value] : []) next.append(key, item);
    redirect(`/live/${encodeURIComponent(slug)}?${next.toString()}`);
  }
  return <LiveStorefront slug={slug} />;
}
