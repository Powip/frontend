"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { hasAdminAccess, isSuperadmin } from "@/config/permissions.config";
import {
  createPriceList,
  getPriceListItems,
  listPriceLists,
  savePriceListItems,
  type PriceList,
} from "@/services/priceListsService";
import { apiErrorInfo } from "@/lib/catalog/catalogPayloads";
import {
  buildPriceWrites,
  formatPrice,
  inheritedPrice,
  mergePriceRows,
  storeLists,
  type CellDraft,
  type PriceMatrixRow,
} from "@/lib/priceLists/priceMatrix";
import { ORDER_CHANNELS, POWIP_PRICE_CHANNELS, channelLabel } from "@/lib/promotions/orderChannels";
import { cn } from "@/lib/utils";
import { soles, variantLabel } from "@/lib/packs/packMath";
import { listPromotions } from "@/services/promotionsService";
import { activeCampaign, promoPriceFor } from "@/lib/promotions/campaign";

const PAGE_SIZE = 50;

/**
 * FEAT-24 H9 (H9-D6) — Catálogo › Listas de precios (mockup `vPrecios`), por tienda: cada variante muestra
 * lo que hereda (`priceVta`) y la excepción de cada lista de la tienda (todos los canales y, si existen,
 * una por canal) con su precio tachado. Vacío = hereda. Leer: cualquiera; escribir: solo el Administrador.
 * No se publica nada a Shopify.
 * FEAT-32 M3 (§7.10): en la columna de un canal con una campaña activa, la etiqueta «Cyber Wow: S/ 119.20»
 * (la lista no cambia: la promoción va encima).
 */
export default function PriceListsView() {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";
  const stores = useMemo(() => auth?.company?.stores ?? [], [auth?.company?.stores]);
  const canEdit = isSuperadmin(auth?.user?.email) || hasAdminAccess(auth?.user?.role);
  const queryClient = useQueryClient();
  const [storeId, setStoreId] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [drafts, setDrafts] = useState<Record<string, Record<string, CellDraft>>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [newChannel, setNewChannel] = useState("");

  useEffect(() => {
    if (!storeId && stores.length) setStoreId(stores[0].id);
  }, [storeId, stores]);
  useEffect(() => {
    const timer = setTimeout(() => { setDebounced(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const promos = useQuery({ queryKey: ["promotions", companyId], queryFn: ({ signal }) => listPromotions(signal), enabled: !!companyId, retry: false, staleTime: 60_000 });
  const listsQuery = useQuery({ queryKey: ["price-lists", companyId], queryFn: ({ signal }) => listPriceLists(signal), enabled: !!companyId, retry: false });
  const lists = useMemo(() => storeLists(listsQuery.data ?? [], storeId), [listsQuery.data, storeId]);
  const itemQueries = useQueries({
    queries: lists.map((list) => ({
      queryKey: ["price-list-items", companyId, list.id, debounced, page],
      queryFn: ({ signal }: { signal: AbortSignal }) => getPriceListItems(list.id, { q: debounced || undefined, page, limit: PAGE_SIZE }, signal),
      retry: false,
    })),
  });
  const rows = useMemo(
    () => mergePriceRows(lists.map((list, index) => ({ listId: list.id, page: itemQueries[index]?.data }))),
    [lists, itemQueries],
  );
  const loadingItems = itemQueries.some((query) => query.isPending);
  const itemsError = itemQueries.find((query) => query.isError)?.error;
  const totalPages = itemQueries[0]?.data?.meta.totalPages ?? 0;
  const dirty = Object.values(drafts).some((cells) => Object.keys(cells).length > 0);
  const usedChannels = new Set(lists.map((list) => list.channel).filter(Boolean));
  const storeName = stores.find((store) => store.id === storeId)?.name ?? "la tienda";

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["price-lists", companyId] });
    void queryClient.invalidateQueries({ queryKey: ["price-list-items", companyId] });
  };

  const draftOf = (listId: string, row: PriceMatrixRow): CellDraft => {
    const draft = drafts[listId]?.[row.variantId];
    if (draft) return draft;
    const cell = row.cells[listId];
    return { price: cell?.inList ? formatPrice(cell.price) : "", compareAtPrice: cell?.inList ? formatPrice(cell.compareAtPrice) : "" };
  };
  const setDraft = (listId: string, row: PriceMatrixRow, patch: Partial<CellDraft>) =>
    setDrafts((current) => ({
      ...current,
      [listId]: { ...current[listId], [row.variantId]: { ...draftOf(listId, row), ...patch } },
    }));

  const createList = async (channel?: string) => {
    if (!storeId) return;
    try {
      await createPriceList({
        name: channel ? `${storeName} · ${channelLabel(channel)}` : `Precios de ${storeName}`,
        storeId,
        ...(channel ? { channel } : {}),
      });
      toast.success(channel ? `Lista de ${channelLabel(channel)} creada` : "Lista de la tienda creada");
      setNewChannel("");
      refresh();
    } catch (error) {
      toast.error(apiErrorInfo(error, "No se pudo crear la lista.").message);
    }
  };

  const save = async () => {
    const { writes, errors: problems } = buildPriceWrites(drafts, rows);
    setErrors(problems);
    if (problems.length) return;
    if (writes.size === 0) {
      setDrafts({});
      return;
    }
    setSaving(true);
    try {
      for (const [listId, items] of writes) await savePriceListItems(listId, items);
      toast.success("Precios guardados");
      setDrafts({});
      refresh();
    } catch (error) {
      toast.error(apiErrorInfo(error, "No se pudieron guardar los precios.").message);
    } finally {
      setSaving(false);
    }
  };

  const removeException = async (list: PriceList, row: PriceMatrixRow) => {
    try {
      await savePriceListItems(list.id, [{ variantId: row.variantId, price: null }]);
      setDrafts((current) => {
        const next = { ...current, [list.id]: { ...current[list.id] } };
        delete next[list.id][row.variantId];
        return next;
      });
      const rulePrice = row.cells[list.id]?.channel?.rulePrice;
      toast.success(rulePrice !== null && rulePrice !== undefined ? `Vuelve a la regla: ${soles(rulePrice)}` : `Vuelve a heredar ${soles(inheritedPrice(row, lists, list.id))}`);
      refresh();
    } catch (error) {
      toast.error(apiErrorInfo(error, "No se pudo quitar el precio.").message);
    }
  };

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-muted-foreground">
        <b className="text-foreground">Listas de precios:</b> cada variante usa su precio base y, si hace falta, uno distinto por tienda y canal. Vacío = hereda. Las reglas de precio que eliges al activar un canal en la ficha (POWIP CRM y Catálogo web) se ven aquí <span className="rounded bg-[#e7f3f3] px-1 text-[#015d5e] dark:bg-teal-950/50 dark:text-teal-200">en verde agua</span>; un precio escrito a mano es propio de esa variante <span className="rounded bg-[#efecfb] px-1 text-[#4C2FB5] dark:bg-violet-950/50 dark:text-violet-200">(morado)</span> y la regla ya no lo cambia. Shopify sigue siendo dueño de su precio: no se publica nada.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="price-list-store">Tienda</Label>
          <select
            id="price-list-store"
            className="h-9 min-w-[200px] rounded-md border bg-background px-2 text-sm"
            value={storeId}
            onChange={(event) => { if (dirty && !window.confirm("Hay precios sin guardar. ¿Cambiar de tienda igual?")) return; setStoreId(event.target.value); setDrafts({}); setPage(1); }}
          >
            {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
          </select>
        </div>
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input aria-label="Buscar variantes" placeholder="Buscar por producto o SKU" className="pl-8" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        {canEdit && lists.some((list) => !list.channel) ? (
          <div className="flex items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="price-list-channel">Precio distinto por canal</Label>
              <select id="price-list-channel" className="h-9 rounded-md border bg-background px-2 text-sm" value={newChannel} onChange={(event) => setNewChannel(event.target.value)}>
                <option value="">Elige un canal</option>
                {[...POWIP_PRICE_CHANNELS, ...ORDER_CHANNELS].filter((channel) => !usedChannels.has(channel.value)).map((channel) => <option key={channel.value} value={channel.value}>{channel.label}</option>)}
              </select>
            </div>
            <Button variant="outline" disabled={!newChannel} onClick={() => void createList(newChannel)}><Plus className="mr-1 h-4 w-4" />Agregar canal</Button>
          </div>
        ) : null}
        {canEdit && lists.length > 0 ? (
          <Button className="ml-auto" disabled={!dirty || saving} onClick={() => void save()}>{saving ? "Guardando…" : "Guardar precios"}</Button>
        ) : null}
      </div>
      {!canEdit ? <p className="text-xs text-muted-foreground">Solo el Administrador cambia los precios.</p> : null}
      {errors.length ? (
        <ul role="alert" className="list-disc rounded-md border border-destructive/40 bg-destructive/10 p-3 pl-6 text-sm text-destructive">
          {errors.map((error) => <li key={error}>{error}</li>)}
        </ul>
      ) : null}

      {listsQuery.isError ? (
        <p role="alert" className="text-sm">No se pudieron cargar las listas. <Button variant="outline" size="sm" onClick={() => void listsQuery.refetch()}>Reintentar</Button></p>
      ) : listsQuery.isPending ? (
        <p role="status" className="text-sm text-muted-foreground">Cargando listas…</p>
      ) : lists.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          <p>{storeName === "la tienda" ? "Elige una tienda." : `${storeName} todavía no tiene lista de precios: todas sus variantes usan el precio base.`}</p>
          {canEdit && storeId ? <Button className="mt-3" onClick={() => void createList()}><Plus className="mr-1 h-4 w-4" />Crear lista de la tienda</Button> : null}
        </div>
      ) : itemsError ? (
        <p role="alert" className="text-sm">No se pudieron cargar los precios. {apiErrorInfo(itemsError, "").message}</p>
      ) : loadingItems ? (
        <p role="status" className="text-sm text-muted-foreground">Cargando precios…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">Ninguna variante coincide con la búsqueda.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                <th className="px-3 py-2">Variante</th>
                <th className="px-3 py-2 text-right">Precio base</th>
                {lists.map((list) => (
                  <th key={list.id} className="px-3 py-2 text-right">{list.channel ? channelLabel(list.channel) : "Todos los canales"}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.variantId} className="border-t align-top" data-testid={`price-row-${row.variantId}`}>
                  <td className="px-3 py-2">
                    <p>{variantLabel(row.productName, row.attributeValues)}</p>
                    <p className="font-mono text-xs text-muted-foreground">{row.companySku ?? ""}</p>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{soles(row.basePrice)}</td>
                  {lists.map((list) => {
                    const cell = row.cells[list.id];
                    const inherited = inheritedPrice(row, lists, list.id);
                    const draft = draftOf(list.id, row);
                    const columnName = list.channel ? channelLabel(list.channel) : "todos los canales";
                    // FEAT-32 M2 — canal con regla: celda verde agua (sale de la regla), morada (precio propio o
                    // cambio sin guardar) o «No activado».
                    const channel = cell?.channel;
                    const ruled = !!channel && channel.rule.mode !== "same";
                    const draftDirty = !!drafts[list.id]?.[row.variantId];
                    const campaign = list.channel && storeId ? activeCampaign(promos.data ?? [], row.productId, [storeId], list.channel) : null;
                    const channelPrice = cell?.inList && cell.price !== null ? cell.price : channel?.rulePrice ?? inherited;
                    const campaignPrice = campaign && list.channel ? promoPriceFor(campaign, row.productId, list.channel, channelPrice) : null;
                    if (channel && !channel.active && !cell?.inList) {
                      return (
                        <td key={list.id} className="px-3 py-2 text-right">
                          <span className="text-xs text-muted-foreground">No activado</span>
                        </td>
                      );
                    }
                    const tone = draftDirty || (ruled && cell?.inList)
                      ? "bg-[#efecfb] dark:bg-violet-950/40"
                      : ruled && channel?.rulePrice !== null
                        ? "bg-[#e7f3f3] dark:bg-teal-950/40"
                        : "";
                    const note = draftDirty
                      ? "cambio sin guardar"
                      : cell?.inList
                        ? ruled ? "precio propio" : "Precio propio"
                        : ruled && channel?.rulePrice !== null
                          ? `regla: ${channel!.ruleLabel.toLowerCase()}`
                          : `hereda ${soles(inherited)}`;
                    return (
                      <td key={list.id} className={cn("px-3 py-2 text-right", tone)} data-testid={`price-cell-${list.id}-${row.variantId}`}>
                        {canEdit ? (
                          <div className="ml-auto flex w-36 flex-col items-end gap-1">
                            <div className="flex items-center gap-1">
                              <Input
                                aria-label={`Precio de ${row.productName} en ${columnName}`}
                                className="h-8 w-24 text-right"
                                inputMode="decimal"
                                placeholder={formatPrice(inherited)}
                                value={draft.price}
                                onChange={(event) => setDraft(list.id, row, { price: event.target.value })}
                              />
                              {cell?.inList ? (
                                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Quitar precio de ${row.productName} en ${columnName}`} title="Quitar la excepción (vuelve a heredar)" onClick={() => void removeException(list, row)}>
                                  <Undo2 className="h-4 w-4" />
                                </Button>
                              ) : null}
                            </div>
                            <Input
                              aria-label={`Precio tachado de ${row.productName} en ${columnName}`}
                              className="h-7 w-24 text-right text-xs"
                              inputMode="decimal"
                              placeholder="Tachado"
                              value={draft.compareAtPrice}
                              onChange={(event) => setDraft(list.id, row, { compareAtPrice: event.target.value })}
                            />
                          </div>
                        ) : (
                          <span className="tabular-nums">
                            {cell?.inList && cell.compareAtPrice ? <s className="mr-1 text-xs text-muted-foreground">{soles(cell.compareAtPrice)}</s> : null}
                            {soles(cell?.inList ? cell.price : inherited)}
                          </span>
                        )}
                        <p className="text-[11px] text-muted-foreground">
                          {note}
                          {ruled && cell?.inList && canEdit && !draftDirty ? (
                            <>
                              {" · "}
                              <button type="button" className="font-semibold text-[#4C2FB5] hover:underline dark:text-violet-300" onClick={() => void removeException(list, row)}>Volver a la regla</button>
                            </>
                          ) : null}
                        </p>
                        {campaign && campaignPrice !== null ? (
                          <p className="mt-0.5 text-[11px]">
                            <span className="inline-block whitespace-nowrap rounded-full bg-[#fde7f1] px-2 py-0.5 font-semibold text-[#a3185a] dark:bg-pink-950/50 dark:text-pink-200">{campaign.name}: {soles(campaignPrice)}</span>
                          </p>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {totalPages > 1 ? (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1 || dirty} onClick={() => setPage((current) => current - 1)}>Anterior</Button>
          <span>Página {page} de {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages || dirty} onClick={() => setPage((current) => current + 1)}>Siguiente</Button>
        </div>
      ) : null}
      {dirty && totalPages > 1 ? <p className="text-right text-xs text-muted-foreground">Guarda los precios antes de cambiar de página.</p> : null}
    </div>
  );
}
