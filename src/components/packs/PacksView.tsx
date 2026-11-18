"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Pencil, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { canSeeProductCosts, hasAdminAccess, isSuperadmin } from "@/config/permissions.config";
import { getPackMarginRules, listPacks, savePackMinMargin, type PackView } from "@/services/packsService";
import { apiErrorInfo } from "@/lib/catalog/catalogPayloads";
import { needsMarginConfirmation, percent, soles, variantLabel } from "@/lib/packs/packMath";
import { PackFormDialog } from "./PackFormDialog";

const PAGE_SIZE = 50;
const MASK = "••••";

/** Disponible del pack: total y, en el título, cada almacén. */
export function PackAvailability({ pack }: { pack: Pick<PackView, "available"> }) {
  if (!pack.available) return <span className="text-muted-foreground" title="Logística no respondió">—</span>;
  const detail = pack.available.byWarehouse.map((row) => `${row.inventoryName ?? "Almacén"}: ${row.available}`).join(" · ");
  return <b title={detail || "Sin stock en ningún almacén"}>{pack.available.total}</b>;
}

/** Margen del pack con su alerta; sin permiso de costos, enmascarado. */
export function PackMarginCell({ pack, seeCosts }: { pack: PackView; seeCosts: boolean }) {
  if (!seeCosts) return <span className="text-muted-foreground" aria-label="Margen oculto">{MASK}</span>;
  if (pack.marginStatus === "sin_costo") return <span className="text-muted-foreground">Sin costo</span>;
  if (pack.marginStatus === "no_disponible" || pack.margin === undefined) return <span className="text-muted-foreground">—</span>;
  const low = needsMarginConfirmation(pack.marginStatus);
  return (
    <span className={low ? "inline-flex items-center gap-1 font-semibold text-destructive" : "font-semibold text-emerald-700 dark:text-emerald-400"}>
      {low ? <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> : null}
      {percent(pack.margin)}
      {low ? <span className="sr-only"> margen bajo</span> : null}
    </span>
  );
}

function MinMarginEditor({ canEdit }: { canEdit: boolean }) {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const companyId = auth?.company?.id ?? "";
  const rules = useQuery({ queryKey: ["pack-margin-rules", companyId], queryFn: ({ signal }) => getPackMarginRules(signal), enabled: !!companyId, retry: false, staleTime: 60_000 });
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  if (!rules.data) return null;
  const save = async () => {
    const pct = Number(value.replace(",", "."));
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      toast.error("El margen mínimo va de 0 a 100 %.");
      return;
    }
    setSaving(true);
    try {
      await savePackMinMargin(Math.round(pct * 100) / 10000);
      await queryClient.invalidateQueries({ queryKey: ["pack-margin-rules", companyId] });
      void queryClient.invalidateQueries({ queryKey: ["packs"] });
      toast.success("Margen mínimo guardado");
      setEditing(false);
    } catch (error) {
      toast.error(apiErrorInfo(error, "No se pudo guardar el margen mínimo.").message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span>Margen mínimo de los packs: <b>{percent(rules.data.minMargin)}</b>{rules.data.igvAffected ? " (sobre el precio sin IGV)" : ""}</span>
      {canEdit && !editing ? <Button variant="link" size="sm" className="h-auto p-0" onClick={() => { setValue(String(Math.round(rules.data.minMargin * 1000) / 10)); setEditing(true); }}>Cambiar</Button> : null}
      {editing ? (
        <span className="flex items-center gap-2">
          <Input aria-label="Margen mínimo en %" className="h-8 w-20" value={value} onChange={(event) => setValue(event.target.value)} inputMode="decimal" />
          <span>%</span>
          <Button size="sm" onClick={() => void save()} disabled={saving}>Guardar</Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>Cancelar</Button>
        </span>
      ) : null}
    </div>
  );
}

/**
 * FEAT-24 H9 (H9-D1/D3) — Catálogo › Packs (mockup `vPacks`): margen con alerta bajo el mínimo y stock
 * calculado (mínimo de los componentes). Sin permiso de costos, costo y margen van enmascarados.
 */
export default function PacksView() {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";
  const seeCosts = canSeeProductCosts(auth?.user);
  const isAdmin = isSuperadmin(auth?.user?.email) || hasAdminAccess(auth?.user?.role);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<PackView | "new" | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => { setDebounced(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const packs = useQuery({
    queryKey: ["packs", companyId, debounced, page],
    queryFn: ({ signal }) => listPacks({ q: debounced || undefined, page, limit: PAGE_SIZE }, signal),
    enabled: !!companyId,
    placeholderData: keepPreviousData,
    retry: false,
  });
  const rows = packs.data?.data ?? [];
  const totalPages = packs.data?.meta.totalPages ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl space-y-1 text-sm text-muted-foreground">
          <p>
            <b className="text-foreground">Pack = producto.</b> Tiene SKU y código propios (Shopify lo vende como un SKU y se une en Unificación). No tiene stock propio: al vender reserva y despacha sus componentes. Si el precio deja un margen menor al mínimo configurado, avisa.
          </p>
          <p>Las promociones de volumen y regalo siguen en <Link className="underline" href="/packs-promos">Promociones</Link>.</p>
        </div>
        {seeCosts ? (
          <Button onClick={() => setEditing("new")}><Plus className="mr-1 h-4 w-4" />Nuevo pack</Button>
        ) : null}
      </div>
      {seeCosts ? <MinMarginEditor canEdit={isAdmin} /> : null}
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <Input aria-label="Buscar packs" placeholder="Buscar por nombre o SKU" className="pl-8" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>

      {packs.isError ? (
        <div role="alert" className="rounded-md border border-destructive/40 p-4 text-sm">
          No se pudieron cargar los packs. {apiErrorInfo(packs.error, "").message}{" "}
          <Button variant="outline" size="sm" onClick={() => void packs.refetch()}>Reintentar</Button>
        </div>
      ) : packs.isPending ? (
        <p role="status" className="text-sm text-muted-foreground">Cargando packs…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
          {debounced ? "Ningún pack coincide con la búsqueda." : "Todavía no hay packs."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                <th className="px-3 py-2">Pack</th>
                <th className="px-3 py-2">Componentes</th>
                <th className="px-3 py-2 text-right">Disponible</th>
                <th className="px-3 py-2 text-right">Costo</th>
                <th className="px-3 py-2 text-right">Precio</th>
                <th className="px-3 py-2 text-right">Margen</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {rows.map((pack) => (
                <tr key={pack.id} className="border-t align-top" data-testid={`pack-row-${pack.id}`}>
                  <td className="px-3 py-2">
                    <div className="flex items-start gap-2">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-xs font-semibold text-primary">PK</span>
                      <div className="min-w-0">
                        <Link href={`/productos/${pack.id}`} className="font-medium hover:underline">{pack.name}</Link>
                        <p className="font-mono text-xs text-muted-foreground">{[pack.sku || pack.productSku, pack.powipEan].filter(Boolean).join(" · ")}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {pack.components.map((component) => (
                      <div key={component.variantId} className={component.active ? "" : "text-destructive"}>
                        {component.quantity} × {variantLabel(component.productName, component.attributeValues)}
                        {component.active ? null : " (inactivo)"}
                      </div>
                    ))}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums"><PackAvailability pack={pack} /></td>
                  <td className="px-3 py-2 text-right tabular-nums">{seeCosts ? soles(pack.cost ?? null) : <span className="text-muted-foreground">{MASK}</span>}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{soles(pack.price)}</td>
                  <td className="px-3 py-2 text-right tabular-nums"><PackMarginCell pack={pack} seeCosts={seeCosts} /></td>
                  <td className="px-3 py-2"><Badge variant={pack.active ? "default" : "outline"}>{pack.active ? "Activo" : "Inactivo"}</Badge></td>
                  <td className="px-3 py-2 text-right">
                    {seeCosts ? (
                      <Button variant="ghost" size="icon" aria-label={`Editar ${pack.name}`} onClick={() => setEditing(pack)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {totalPages > 1 ? (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Anterior</Button>
          <span>Página {page} de {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Siguiente</Button>
        </div>
      ) : null}
      {editing ? <PackFormDialog key={editing === "new" ? "new" : editing.id} pack={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}
