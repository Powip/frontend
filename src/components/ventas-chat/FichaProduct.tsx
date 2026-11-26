"use client";
import { ExternalLink, FileText, Image as ImageIcon, Link2, Mic, Quote, Ruler, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useObjections, useScript } from "@/hooks/useCrmContent";
import type { Material, Script, ScriptStep, Sheet } from "@/types/crmContent";
import { MATERIAL_KIND_LABEL, type MaterialKindAll } from "./ContentLib";
import { FichaCopyButton } from "./FichaView";

export type ViewAs = "seller" | "pau" | "admin";

export const VIEW_AS_LABEL: Record<ViewAs, string> = {
  seller: "Vendedora",
  pau: "Pau (IA)",
  admin: "Administrador",
};

export interface ProductStep extends ScriptStep {
  /** De dónde sale el texto del paso. */
  source: "producto" | "categoria" | "general";
}

/**
 * Guion de un producto: cada paso toma primero el texto propio del producto,
 * luego el de su categoría y si no, el general (mismo orden que ms-crm).
 */
export function productSteps(
  script: Pick<Script, "steps" | "overrides">,
  sheet: Pick<Sheet, "id" | "category" | "storeId">,
): ProductStep[] {
  const byProduct = script.overrides?.[`prod:${sheet.id}`] ?? {};
  const byCategory =
    sheet.category && sheet.storeId ? (script.overrides?.[`cat:${sheet.storeId}:${sheet.category}`] ?? {}) : {};
  return script.steps.map((step, i) => {
    const own = byProduct[String(i)];
    const cat = byCategory[String(i)];
    const pick = own ?? cat;
    if (!pick) return { ...step, source: "general" };
    return {
      name: step.name,
      message: pick.message || step.message,
      question: pick.question || step.question,
      source: own ? "producto" : "categoria",
    };
  });
}

const SOURCE_TEXT: Record<ProductStep["source"], string> = {
  producto: "propio",
  categoria: "de su categoría",
  general: "general",
};

/** «Guion de este producto» (F3). */
export function ProductScript({ sheet }: { sheet: Sheet }) {
  const script = useScript(true, sheet.storeId ?? null);
  if (!script.data || script.data.steps.length === 0) return null;
  const steps = productSteps(script.data, sheet);
  const custom = steps.some((s) => s.source !== "general");
  return (
    <section aria-label={`Guion de ${sheet.name}`} className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">Guion de este producto</h3>
        <Badge variant="outline">{custom ? "Con cambios para este producto" : "Usa el guion general"}</Badge>
      </div>
      <ol className="grid gap-2 lg:grid-cols-2">
        {steps.map((st, i) => (
          <li key={i} className="space-y-1 rounded-md border p-3" data-testid="ficha-product-step">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">
                {i + 1}. {st.name}{" "}
                <span className="text-[11px] font-normal text-muted-foreground">· {SOURCE_TEXT[st.source]}</span>
              </p>
              <FichaCopyButton
                text={st.question ? `${st.message}\n${st.question}` : st.message}
                label={`paso ${i + 1} de ${sheet.name}`}
              />
            </div>
            <p className="whitespace-pre-wrap text-sm">{st.message}</p>
            {st.question && <p className="whitespace-pre-wrap text-sm font-medium">{st.question}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}

const KIND_ICON: Record<MaterialKindAll, typeof ImageIcon> = {
  photo: ImageIcon,
  video: Video,
  audio: Mic,
  pdf: FileText,
  link: Link2,
  sizes: Ruler,
  testimony: Quote,
};

/** Orden de las tarjetas de material (F4). Tabla de medidas solo si el producto la tiene. */
const KIND_ORDER: MaterialKindAll[] = ["photo", "video", "testimony", "sizes", "audio", "pdf", "link"];

/** Material de venta agrupado por tipo, una tarjeta por tipo (F4). */
export function MaterialCards({ sheet }: { sheet: Sheet }) {
  const byKind = new Map<MaterialKindAll, Material[]>();
  for (const m of sheet.materials) {
    const k = m.kind as MaterialKindAll;
    byKind.set(k, [...(byKind.get(k) ?? []), m]);
  }
  const kinds = KIND_ORDER.filter((k) => byKind.has(k));
  if (kinds.length === 0) return null;
  return (
    <section aria-label={`Material de ${sheet.name}`} className="space-y-2">
      <h3 className="text-sm font-semibold">Material de venta</h3>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {kinds.map((k) => {
          const Icon = KIND_ICON[k];
          const items = byKind.get(k)!;
          return (
            <div key={k} className="space-y-1 rounded-md border p-3" data-testid="material-card">
              <p className="flex items-center gap-2 text-xs font-semibold">
                <Icon className="h-4 w-4 text-primary" aria-hidden /> {MATERIAL_KIND_LABEL[k]}
                <span className="font-normal text-muted-foreground">({items.length})</span>
              </p>
              <ul className="space-y-1">
                {items.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-1 text-sm">
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-w-0 items-center gap-1 text-primary underline"
                    >
                      <span className="truncate">{m.title}</span> <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                    <FichaCopyButton text={`${m.title}: ${m.url}`} label={`enlace de ${m.title}`} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Respuestas oficiales a objeciones dentro de la ficha (F5). Solo activas. */
export function FichaObjections() {
  const list = useObjections(true);
  const active = (list.data ?? []).filter((o) => o.active);
  if (active.length === 0) return null;
  return (
    <section aria-labelledby="ficha-objeciones" className="space-y-2 rounded-md border bg-card p-4">
      <h2 id="ficha-objeciones" className="text-base font-semibold">
        Respuestas a objeciones
      </h2>
      <ul className="grid gap-2 lg:grid-cols-2">
        {active.map((o) => (
          <li key={o.id} className="space-y-1 rounded-md border p-3" data-testid="ficha-objection">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">«{o.name}»</p>
              <FichaCopyButton text={o.response} label={`respuesta a ${o.name}`} />
            </div>
            <p className="whitespace-pre-wrap text-sm">{o.response}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
