"use client";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CrmStore } from "@/types/crm";
import type { AuditD, AuditReadCell, CheckState, ScriptSource } from "@/types/crmBlockD";

const SOURCE_LABEL: Record<ScriptSource, string> = {
  producto: "Propio del producto",
  categoria: "De su categoría",
  tienda: "De la tienda",
  general: "General del negocio",
  metodologia: "Metodología base",
};

const CHECK: Record<CheckState, { text: string; className: string }> = {
  ok: { text: "✓", className: "text-emerald-700" },
  partial: { text: "◐", className: "text-amber-700" },
  missing: { text: "✕", className: "text-destructive" },
  na: { text: "—", className: "text-muted-foreground" },
};

const STATUS: Record<"ok" | "missing" | "bad", { label: string; className: string }> = {
  ok: { label: "Listo", className: "bg-emerald-100 text-emerald-800" },
  missing: { label: "Le falta", className: "bg-amber-100 text-amber-800" },
  bad: { label: "No vendible", className: "bg-red-100 text-red-800" },
};

const READ: Record<AuditReadCell["state"], { label: string; className: string }> = {
  read: { label: "Leído", className: "bg-emerald-100 text-emerald-800" },
  old: { label: "Versión vieja", className: "bg-amber-100 text-amber-800" },
  unread: { label: "Sin leer", className: "bg-red-100 text-red-800" },
  not_assigned: { label: "No asignada", className: "bg-muted text-muted-foreground" },
};

export const fichaHref = (productId: string) => `/comercial/ventas-chat/ficha?producto=${encodeURIComponent(productId)}`;

function Check({ state, title }: { state: CheckState; title?: string }) {
  return (
    <span title={title} className={cn("font-semibold", CHECK[state].className)}>
      {CHECK[state].text}
    </span>
  );
}

/** Cuatro tarjetas de «qué tan listo está el negocio para vender». */
export function ReadinessKpis({ audit }: { audit: AuditD }) {
  const r = audit.readiness;
  const cards = [
    { label: "Listo para vender", value: `${r.percent}%`, hint: "Productos con ficha y material completos" },
    { label: "Productos listos", value: `${r.productsOk} / ${r.products}`, hint: "Sin nada pendiente" },
    { label: "Con material faltante", value: r.withMissing, hint: "Fotos, medidas, testimonios o video" },
    { label: "Problemas abiertos", value: r.problems, hint: "Ver la lista de abajo" },
  ];
  return (
    <section aria-label="Preparación" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-lg border bg-card p-4" data-testid="readiness-kpi">
          <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{c.value}</p>
          <p className="text-[11px] text-muted-foreground">{c.hint}</p>
        </div>
      ))}
    </section>
  );
}

/** Tabla por producto (mockup 152, U2): de dónde sale su guion y qué material tiene. */
export function ProductsAudit({ audit, stores }: { audit: AuditD; stores: CrmStore[] }) {
  const storeName = (id: string | null) => (id ? stores.find((s) => s.id === id)?.name ?? "—" : "Todas");
  return (
    <section aria-label="Productos" className="space-y-2">
      <div>
        <h2 className="text-sm font-semibold">Productos: guion y material</h2>
        <p className="text-xs text-muted-foreground">
          ✓ completo · ◐ a medias · ✕ falta · — no aplica (la tabla de medidas solo se pide a ropa y calzado).
        </p>
      </div>
      {audit.products.length === 0 ? (
        <p className="rounded-md border p-3 text-sm text-muted-foreground">Todavía no hay fichas de producto.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm" data-testid="audit-products">
            <thead className="bg-muted/40 text-xs">
              <tr>
                {["Producto", "Tienda", "Guion", "Ficha", "Fotos", "Medidas", "Testimonios", "Video / audio", "Estado", ""].map(
                  (h, i) => (
                    <th key={h || i} scope="col" className={cn("px-3 py-2 font-medium", i < 3 ? "text-left" : "text-center")}>
                      {h || <span className="sr-only">Acción</span>}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {audit.products.map((p) => (
                <tr key={p.id} className="border-t" data-testid="audit-product-row">
                  <th scope="row" className="px-3 py-2 text-left font-medium">
                    {p.name}
                    {p.category && <span className="block text-[11px] font-normal text-muted-foreground">{p.category}</span>}
                  </th>
                  <td className="px-3 py-2 text-xs">{storeName(p.storeId)}</td>
                  <td className="px-3 py-2 text-xs">{SOURCE_LABEL[p.scriptSource]}</td>
                  <td className="px-3 py-2 text-center">
                    <Check state={p.sheet} title={p.sheetMissing.length ? `Falta: ${p.sheetMissing.join(", ")}` : undefined} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Check state={p.photos} title={`${p.photoCount} foto(s)`} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Check state={p.sizes} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Check state={p.testimonies} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Check state={p.videoAudio} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Badge variant="secondary" className={STATUS[p.status].className}>
                      {STATUS[p.status].label}
                    </Badge>
                    {p.missing.length > 0 && (
                      <span className="block text-[11px] text-muted-foreground">Falta: {p.missing.join(", ")}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link href={fichaHref(p.id)} className="text-xs font-medium text-primary hover:underline">
                      {p.status === "ok" ? "Ver" : "Completar"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** «¿Leyeron el último guion?» por vendedora y tienda (U5). */
export function ReadsByStore({ audit, stores }: { audit: AuditD; stores: CrmStore[] }) {
  const ids = audit.stores;
  const people = audit.script.items.filter((i) => audit.readsByStore[i.userId]);
  if (ids.length < 2 || people.length === 0) return null;
  const storeName = (id: string) => stores.find((s) => s.id === id)?.name ?? id;
  return (
    <section aria-label="Lectura por tienda" className="space-y-2">
      <h2 className="text-sm font-semibold">Lectura del guion por tienda</h2>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm" data-testid="reads-by-store">
          <thead className="bg-muted/40 text-xs">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-medium">Vendedora</th>
              {ids.map((id) => (
                <th key={id} scope="col" className="px-3 py-2 text-center font-medium">
                  {storeName(id)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.userId} className="border-t">
                <th scope="row" className="px-3 py-2 text-left font-medium">{p.userName}</th>
                {audit.readsByStore[p.userId].map((c) => (
                  <td key={c.storeId} className="px-3 py-2 text-center">
                    <Badge variant="secondary" className={READ[c.state].className}>
                      {READ[c.state].label}
                    </Badge>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
