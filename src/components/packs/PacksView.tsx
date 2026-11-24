"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ProductThumb } from "@/components/catalog/CatalogBadges";
import { ChannelChip } from "@/components/catalog/ChannelIcons";
import { useAuth } from "@/contexts/AuthContext";
import { canManagePacks, canSeeProductCosts, hasAdminAccess, isSuperadmin } from "@/config/permissions.config";
import {
  getPackMarginRules,
  listPacks,
  packTypeOf,
  savePackMinMargin,
  setPackApproval,
  type ListPacksParams,
  type PackView,
} from "@/services/packsService";
import { getChannelSummary } from "@/services/productChannelsService";
import { apiErrorInfo } from "@/lib/catalog/catalogPayloads";
import { POWIP_CHANNELS, RULE_CHANNELS, productChannelStates } from "@/lib/catalog/productChannels";
import { cn } from "@/lib/utils";
import { needsMarginConfirmation, percent, soles, variantLabel } from "@/lib/packs/packMath";
import { PackFormDialog } from "./PackFormDialog";

const PAGE_SIZE = 50;
const MASK = "••••";
const pill = "inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold";
const CHIP = "rounded-full border px-3 py-1 text-sm font-medium";
const CHIP_ON = "border-[#027778] bg-[#e7f3f3] text-[#015d5e] dark:bg-teal-950/40 dark:text-teal-100";

export type PackFilter = "all" | "FIXED" | "CHOOSE" | "creators";

/** Parámetros de `GET /packs` para cada filtro de la pestaña. */
export function packFilterParams(filter: PackFilter): Pick<ListPacksParams, "packType" | "origin"> {
  if (filter === "FIXED" || filter === "CHOOSE") return { packType: filter };
  if (filter === "creators") return { origin: "creators" };
  return {};
}

const pendingText = (count: number) => `${count} pendiente${count === 1 ? "" : "s"}`;

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

/** Estado del pack: los de creadoras pendientes o rechazados no se venden ni se publican. */
export function PackStatus({ pack }: { pack: Pick<PackView, "active" | "approvalStatus"> }) {
  if (pack.approvalStatus === "PENDING") return <span className={cn(pill, "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200")}>Por aprobar</span>;
  if (pack.approvalStatus === "REJECTED") return <span className={cn(pill, "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-200")}>Rechazado</span>;
  return pack.active
    ? <span className={cn(pill, "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200")}>Activo</span>
    : <span className={cn(pill, "bg-muted text-muted-foreground")}>Inactivo</span>;
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

/** Componentes de la fila: FIXED «2 × Polo · M» con su SKU; CHOOSE «2 × Jean Jimena (3 variantes)». */
function PackComponentsCell({ pack }: { pack: PackView }) {
  if (packTypeOf(pack) === "CHOOSE") {
    return (
      <>
        {(pack.choiceComponents ?? []).map((component) => (
          <div key={component.slot}>
            {component.quantity} × {component.productName}{" "}
            <small className="text-xs text-muted-foreground">({component.variants.length} variante{component.variants.length === 1 ? "" : "s"})</small>
          </div>
        ))}
      </>
    );
  }
  return (
    <>
      {pack.components.map((component) => (
        <div key={component.variantId} className={component.active ? "" : "text-destructive"}>
          <span>{component.quantity} × {variantLabel(component.productName, component.attributeValues)}</span>
          {component.sku ? <span className="ml-1 font-mono text-xs text-muted-foreground">{component.sku}</span> : null}
          {component.active ? null : " (inactivo)"}
        </div>
      ))}
    </>
  );
}

/**
 * FEAT-24 H9 y FEAT-32 M5 (spec §7.15) — pestaña Packs de Comercial › Packs y promociones: filtros Todos · Fijos ·
 * A elegir · De creadoras (con los pendientes), tabla con el tipo, los componentes, el precio, la suma de
 * componentes, el stock calculado con el componente que limita, los canales de POWIP y el estado. Crear, editar y
 * aprobar o rechazar los de creadoras: Administrador u Operaciones. Sin permiso de costos, el margen va enmascarado.
 */
export default function PacksView() {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";
  const seeCosts = canSeeProductCosts(auth?.user);
  const canManage = canManagePacks(auth?.user);
  const isAdmin = isSuperadmin(auth?.user?.email) || hasAdminAccess(auth?.user?.role);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [filter, setFilter] = useState<PackFilter>("all");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<PackView | "new" | null>(null);
  const [rejecting, setRejecting] = useState<PackView | null>(null);
  const [deciding, setDeciding] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => { setDebounced(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const packs = useQuery({
    queryKey: ["packs", companyId, debounced, filter, page],
    queryFn: ({ signal }) => listPacks({ q: debounced || undefined, page, limit: PAGE_SIZE, ...packFilterParams(filter) }, signal),
    enabled: !!companyId,
    placeholderData: keepPreviousData,
    retry: false,
  });
  // Canales de POWIP de cada pack (sin fila = activo). Si falla, la columna queda en «—».
  const channelSummary = useQuery({
    queryKey: ["product-channel-summary", companyId],
    queryFn: ({ signal }) => getChannelSummary(signal),
    enabled: !!companyId,
    retry: false,
    staleTime: 60_000,
  });
  // Una tienda sin fila tiene el canal activo: se miran todas las tiendas de la empresa.
  const storeIds = (auth?.company?.stores ?? []).map((store) => store.id);
  const rows = packs.data?.data ?? [];
  const totalPages = packs.data?.meta.totalPages ?? 0;
  const pendingCount = packs.data?.meta.pendingCount ?? 0;

  const decide = async (pack: PackView, decision: "APPROVED" | "REJECTED") => {
    setDeciding(pack.id);
    try {
      await setPackApproval(pack.id, decision);
      toast.success(decision === "APPROVED" ? `«${pack.name}» aprobado: ya se vende y se publica.` : `«${pack.name}» rechazado: no se vende ni se publica.`);
      setRejecting(null);
      void queryClient.invalidateQueries({ queryKey: ["packs"] });
      void queryClient.invalidateQueries({ queryKey: ["pack"] });
    } catch (error) {
      toast.error(apiErrorInfo(error, "No se pudo guardar la decisión.").message);
    } finally {
      setDeciding(null);
    }
  };

  const channelsCell = (pack: PackView) => {
    if (!channelSummary.data) return <span className="text-xs text-muted-foreground">—</span>;
    const { states } = productChannelStates(channelSummary.data, pack.id, storeIds);
    const on = RULE_CHANNELS.filter((channel) => states[channel] === "al_dia");
    if (!on.length) return <span className="text-xs text-muted-foreground">Ninguno</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {on.map((channel) => {
          const meta = POWIP_CHANNELS.find((item) => item.code === channel)!;
          return <span key={channel} title={meta.name} aria-label={meta.name} role="img"><ChannelChip label={meta.short} color={meta.color} /></span>;
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar packs">
          {([["all", "Todos"], ["FIXED", "Fijos"], ["CHOOSE", "A elegir"], ["creators", "De creadoras"]] as const).map(([key, label]) => (
            <button key={key} type="button" aria-pressed={filter === key} onClick={() => { setFilter(key); setPage(1); }} className={cn(CHIP, filter === key ? CHIP_ON : "bg-background text-muted-foreground hover:bg-muted")}>
              {label}
              {key === "creators" && pendingCount > 0 ? ` (${pendingText(pendingCount)})` : ""}
            </button>
          ))}
        </div>
        {canManage ? <Button onClick={() => setEditing("new")}><Plus className="mr-1 h-4 w-4" />Nuevo pack</Button> : null}
      </div>
      <div className="max-w-3xl space-y-1 text-sm text-muted-foreground">
        <p>
          <b className="text-foreground">Un pack es un producto con SKU propio:</b> también aparece en Productos › Lista de productos (tipo Pack), tiene su ficha con fotos y canales, y se vende en tus canales. No tiene stock propio: al vender reserva y despacha sus componentes.
        </p>
        <p>Las promociones (campaña, volumen y regalo) están en la pestaña <Link className="underline" href="/packs-promos?tab=promociones">Promociones</Link>.</p>
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
          {debounced ? "Ningún pack coincide con la búsqueda." : filter === "all" ? "Todavía no hay packs." : "No hay packs en este filtro."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                <th className="px-3 py-2">Pack</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Componentes</th>
                <th className="px-3 py-2 text-right">Precio</th>
                <th className="px-3 py-2 text-right">Suma de componentes</th>
                <th className="px-3 py-2 text-right">Margen</th>
                <th className="px-3 py-2 text-right">Stock</th>
                <th className="px-3 py-2">Canales</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {rows.map((pack) => {
                const creator = pack.approvalStatus != null;
                const limiting = pack.available?.limiting?.label;
                return (
                  <tr key={pack.id} className="border-t align-top" data-testid={`pack-row-${pack.id}`}>
                    <td className="min-w-[220px] px-3 py-2">
                      <div className="flex items-start gap-2">
                        <ProductThumb src={pack.imageUrl} name={pack.name} size={36} />
                        <div className="min-w-0">
                          <Link href={`/productos/${pack.id}`} className="font-medium hover:underline">{pack.name}</Link>
                          <p className="font-mono text-xs text-muted-foreground">{[pack.sku || pack.productSku, pack.powipEan].filter(Boolean).join(" · ")}</p>
                          {creator ? <p className="text-xs text-muted-foreground">De creadora</p> : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn(pill, "bg-primary/10 text-primary")}>{packTypeOf(pack) === "CHOOSE" ? "A elegir" : "Fijo"}</span>
                    </td>
                    <td className="px-3 py-2"><PackComponentsCell pack={pack} /></td>
                    <td className="px-3 py-2 text-right tabular-nums">{soles(pack.price)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{soles(pack.componentsTotal ?? null)}</td>
                    <td className="px-3 py-2 text-right tabular-nums"><PackMarginCell pack={pack} seeCosts={seeCosts} /></td>
                    <td className={cn("px-3 py-2 text-right tabular-nums", pack.available && pack.available.total <= 0 && "text-destructive")}>
                      <PackAvailability pack={pack} />
                      {limiting ? <small className="ml-auto block max-w-[180px] text-xs text-muted-foreground">Limita: {limiting}</small> : null}
                    </td>
                    <td className="px-3 py-2">{channelsCell(pack)}</td>
                    <td className="px-3 py-2"><PackStatus pack={pack} /></td>
                    <td className="px-3 py-2">
                      <div className="flex flex-nowrap justify-end gap-1.5">
                        {canManage && creator && pack.approvalStatus !== "APPROVED" ? (
                          <Button size="sm" disabled={deciding === pack.id} aria-label={`Aprobar ${pack.name}`} onClick={() => void decide(pack, "APPROVED")}>Aprobar</Button>
                        ) : null}
                        {canManage && creator && pack.approvalStatus !== "REJECTED" ? (
                          <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-50" disabled={deciding === pack.id} aria-label={`Rechazar ${pack.name}`} onClick={() => setRejecting(pack)}>Rechazar</Button>
                        ) : null}
                        {canManage && pack.approvalStatus !== "PENDING" ? (
                          <Button size="sm" variant="outline" aria-label={`Editar ${pack.name}`} onClick={() => setEditing(pack)}>Editar</Button>
                        ) : null}
                        <Button size="sm" variant="outline" asChild><Link href={`/productos/${pack.id}`} aria-label={`Ver ficha de ${pack.name}`}>Ver ficha</Link></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
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
      <AlertDialog open={!!rejecting} onOpenChange={(open) => !open && !deciding && setRejecting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Rechazar «{rejecting?.name}»?</AlertDialogTitle>
            <AlertDialogDescription>Un pack rechazado no se vende ni se publica. Puedes aprobarlo después si cambias de opinión.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deciding}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!!deciding}
              onClick={(event) => {
                event.preventDefault();
                if (rejecting) void decide(rejecting, "REJECTED");
              }}
            >
              Sí, rechazar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
