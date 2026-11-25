"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, ExternalLink, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useGeneralMaterials, useMarkScriptRead, useScript, useSheets } from "@/hooks/useCrmContent";
import { useCrmMe } from "@/hooks/useCrmMe";
import type { Material, Sheet } from "@/types/crmContent";
import { MATERIAL_KIND_LABEL } from "./ContentLib";
import { ContentError, ContentLoading } from "./ContentStatus";
import { FichaAlbum, FichaCoreStock } from "./FichaCoreSection";
import { FichaObjections, MaterialCards, ProductScript, VIEW_AS_LABEL, type ViewAs } from "./FichaProduct";
import { NATIVE_SELECT_CLASS } from "./format";

export function FichaCopyButton({ text, label }: { text: string; label: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  };
  return (
    <Button size="sm" variant="ghost" aria-label={`Copiar ${label}`} onClick={copy}>
      <Copy /> Copiar
    </Button>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value?.trim()) return null;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{label}</h3>
        <FichaCopyButton text={value} label={label.toLowerCase()} />
      </div>
      <p className="whitespace-pre-wrap text-sm">{value}</p>
    </div>
  );
}

function MaterialLinks({ items, label }: { items: Material[]; label: string }) {
  if (items.length === 0) return null;
  return (
    <ul aria-label={label} className="space-y-1">
      {items.map((m) => (
        <li key={m.id} className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="secondary">{MATERIAL_KIND_LABEL[m.kind]}</Badge>
          <a href={m.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline">
            {m.title} <ExternalLink className="h-3 w-3" />
          </a>
          <FichaCopyButton text={`${m.title}: ${m.url}`} label={`enlace de ${m.title}`} />
        </li>
      ))}
    </ul>
  );
}

function ScriptBanner() {
  const script = useScript();
  const read = useMarkScriptRead();
  const s = script.data;
  return (
    <>
      {s && s.version > 0 && s.myReadVersion < s.version && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <span className="min-w-0 flex-1">
            Hay un guion nuevo (versión {s.version}){s.note ? `: ${s.note}` : ""}
          </span>
          <Button size="sm" variant="outline" disabled={read.isPending} onClick={() => read.mutate()}>
            Ya lo leí
          </Button>
        </div>
      )}
      <section aria-labelledby="ficha-guion" className="space-y-2 rounded-md border bg-card p-4">
        <h2 id="ficha-guion" className="text-base font-semibold">
          Guion de venta
        </h2>
        {script.isLoading && <ContentLoading />}
        {script.isError && <ContentError error={script.error} onRetry={() => script.refetch()} />}
        {s && s.steps.length === 0 && (
          <p className="text-sm text-muted-foreground">Aún no hay guion. Un administrador debe crearlo.</p>
        )}
        {s && s.steps.length > 0 && (
          <>
            <p className="text-xs text-muted-foreground">Versión {s.version}</p>
            <ol className="space-y-2">
              {s.steps.map((st, i) => (
                <li key={i} className="space-y-1 rounded-md border p-3" data-testid="ficha-step">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">
                      {i + 1}. {st.name}
                    </h3>
                    <FichaCopyButton text={st.question ? `${st.message}\n${st.question}` : st.message} label={`paso ${i + 1}`} />
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{st.message}</p>
                  {st.question && <p className="whitespace-pre-wrap text-sm font-medium">{st.question}</p>}
                </li>
              ))}
            </ol>
            <p className="text-xs text-muted-foreground">
              {"{nombre}"} se reemplaza por el primer nombre del cliente al usar el paso en el chat.
            </p>
          </>
        )}
      </section>
    </>
  );
}

function SheetDetail({ sheet, viewAs, storeName }: { sheet: Sheet; viewAs: ViewAs; storeName: string | null }) {
  return (
    <article aria-label={sheet.name} className="space-y-3 rounded-md border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{sheet.name}</h2>
          {(storeName || sheet.category) && (
            <p className="text-xs text-muted-foreground">{[storeName, sheet.category].filter(Boolean).join(" · ")}</p>
          )}
        </div>
        {viewAs === "admin" && (
          <Button asChild size="sm" variant="outline">
            <Link href="/comercial/ventas-chat/guion">Editar en Guion y material</Link>
          </Button>
        )}
      </div>
      {viewAs === "pau" && (
        <p className="rounded-md bg-primary/5 p-2 text-xs text-primary">
          Así lo lee Pau: los datos de la ficha, el guion de este producto y las respuestas a objeciones activas.
        </p>
      )}
      <Field label="Precio" value={sheet.price} />
      <Field label="Para quién es" value={sheet.forWhom} />
      <Field label="Qué destacar" value={sheet.highlights} />
      <Field label="Alternativas" value={sheet.alternatives} />
      <Field label="Complementos" value={sheet.complements} />
      <Field label="Ofertas y packs" value={sheet.offers ?? ""} />
      <ProductScript sheet={sheet} />
      <MaterialCards sheet={sheet} />
      <FichaCoreStock sheetId={sheet.id} linked={!!sheet.coreProductId} />
      {viewAs !== "pau" && <FichaAlbum sheetId={sheet.id} sheetName={sheet.name} />}
    </article>
  );
}

export default function FichaView() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { isAdmin, stores } = useCrmMe();
  const [viewAs, setViewAs] = useState<ViewAs>("seller");
  const [storeId, setStoreId] = useState("");
  const sheets = useSheets(search);
  const general = useGeneralMaterials();
  const active = (sheets.data ?? []).filter((s) => s.active && (!storeId || !s.storeId || s.storeId === storeId));
  const selected = active.find((s) => s.id === selectedId) ?? active[0];
  const storeName = (id?: string | null) => (id ? stores.find((st) => st.id === id)?.name ?? null : null);

  // Enlace directo desde Auditoría: /ficha?producto=<id>.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("producto");
    if (id) setSelectedId(id);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">
          Pau lee automáticamente el guion, las objeciones activas y las fichas activas, además de su «Conocimiento».
        </p>
        <label className="flex items-center gap-2 text-xs">
          <span className="font-medium">Ver como</span>
          <select
            aria-label="Ver como"
            className={cn(NATIVE_SELECT_CLASS, "w-40")}
            value={viewAs}
            onChange={(e) => setViewAs(e.target.value as ViewAs)}
          >
            {(["seller", "pau", ...(isAdmin ? (["admin"] as const) : [])] as ViewAs[]).map((v) => (
              <option key={v} value={v}>
                {VIEW_AS_LABEL[v]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ScriptBanner />

      <section aria-labelledby="ficha-productos" className="space-y-3">
        <h2 id="ficha-productos" className="text-base font-semibold">
          Productos
        </h2>
        <div className="flex flex-wrap gap-2">
          <div className="min-w-0 flex-1">
            <Input icon={Search} aria-label="Buscar producto" placeholder="Buscar producto…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {stores.length > 1 && (
            <select
              aria-label="Tienda"
              className={cn(NATIVE_SELECT_CLASS, "w-48")}
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
            >
              <option value="">Todas las tiendas</option>
              {stores.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </select>
          )}
        </div>
        {sheets.isLoading && <ContentLoading />}
        {sheets.isError && <ContentError error={sheets.error} onRetry={() => sheets.refetch()} />}
        {sheets.data && active.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {search.trim() ? "Ningún producto coincide." : "Aún no hay productos activos."}
          </p>
        )}
        {active.length > 0 && (
          <div className="grid gap-3 md:grid-cols-[16rem_1fr]">
            <ul aria-label="Lista de productos" className="space-y-1">
              {active.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    aria-current={selected?.id === s.id ? "true" : undefined}
                    onClick={() => setSelectedId(s.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm hover:bg-accent/50",
                      selected?.id === s.id && "border-primary bg-accent",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block break-words sm:truncate font-medium">{s.name}</span>
                      {(storeName(s.storeId) || s.category) && (
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {[storeName(s.storeId), s.category].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </span>
                    {s.price && <span className="shrink-0 text-xs text-muted-foreground">{s.price}</span>}
                  </button>
                </li>
              ))}
            </ul>
            {selected && <SheetDetail sheet={selected} viewAs={viewAs} storeName={storeName(selected.storeId)} />}
          </div>
        )}
      </section>

      <FichaObjections />

      {general.data && general.data.length > 0 && (
        <section aria-labelledby="ficha-negocio" className="space-y-2 rounded-md border bg-card p-4">
          <h2 id="ficha-negocio" className="text-base font-semibold">
            Material del negocio
          </h2>
          <MaterialLinks items={general.data} label="Material del negocio" />
        </section>
      )}
    </div>
  );
}
