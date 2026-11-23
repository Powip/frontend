"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ChannelBadge } from "@/components/catalog/CatalogBadges";
import { ChannelChip } from "@/components/catalog/ChannelIcons";
import ChannelPriceDialog from "@/components/catalog/ficha/channels/ChannelPriceDialog";
import { useAuth } from "@/contexts/AuthContext";
import { CHANNEL_LABEL, productChannel } from "@/lib/catalog/catalogProducts";
import { POWIP_CHANNELS, priceRange, type PriceRule } from "@/lib/catalog/productChannels";
import { apiErrorInfo } from "@/lib/catalog/catalogPayloads";
import { formatVariantLabel } from "@/lib/variantAttributes";
import type { CatalogProductDetail, CatalogVariantDetail } from "@/services/catalogProductService";
import { getProductChannels, saveProductChannel, type ProductChannelView, type ProductChannelsView } from "@/services/productChannelsService";

const pill = "inline-block rounded-full px-2 py-0.5 text-xs font-semibold";
const PILL_TEAL = `${pill} bg-[#e7f3f3] text-[#015d5e] dark:bg-teal-950/50 dark:text-teal-200`;
const PILL_GRAY = `${pill} bg-muted text-muted-foreground`;

type PriceDialogState = { channel: ProductChannelView; activating: boolean } | null;

/**
 * FEAT-32 M2 (spec §7.8) — Canales: los de POWIP por tienda (activo y precio con su regla) y, debajo, de dónde
 * viene el producto y con qué canal está unida cada variante (FEAT-24 H4-D5). Shopify en la fase 1: «Lo
 * administra Shopify» (POWIP solo envía stock; publicar es de la fase 2).
 */
export default function FichaChannelsTab({ product, variants }: { product: CatalogProductDetail; variants: CatalogVariantDetail[] }) {
  const { auth } = useAuth();
  const stores = useMemo(() => auth?.company?.stores ?? [], [auth?.company?.stores]);
  const [storeId, setStoreId] = useState("");
  const currentStore = storeId || stores[0]?.id || "";
  const storeName = stores.find((store) => store.id === currentStore)?.name ?? "";
  const queryClient = useQueryClient();
  const [priceDialog, setPriceDialog] = useState<PriceDialogState>(null);
  const [deactivating, setDeactivating] = useState<ProductChannelView | null>(null);

  const channelsQuery = useQuery({
    queryKey: ["product-channels", product.id, currentStore],
    queryFn: ({ signal }) => getProductChannels(product.id, currentStore, signal),
    enabled: !!currentStore,
    retry: false,
  });
  const view = channelsQuery.data;

  const save = useMutation({
    mutationFn: (input: { channel: ProductChannelView; active: boolean; rule: PriceRule }) =>
      saveProductChannel(product.id, { storeId: currentStore, channel: input.channel.channel, active: input.active, rule: input.rule }),
    onSuccess: (next: ProductChannelsView, input) => {
      queryClient.setQueryData(["product-channels", product.id, currentStore], next);
      void queryClient.invalidateQueries({ queryKey: ["product-channel-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["price-list-items"] });
      toast.success(input.active ? `✓ ${input.channel.name}: ${next.channels.find((ch) => ch.channel === input.channel.channel)?.ruleLabel ?? ""}` : `${input.channel.name} desactivado para este producto`);
      setPriceDialog(null);
      setDeactivating(null);
    },
    onError: (error) => toast.error(apiErrorInfo(error, "No se pudo guardar el canal.").message),
  });

  const origin = productChannel(product.externalSource);
  const live = variants.filter((variant) => !variant.mergedInto);
  const ownByVariant = (channel: ProductChannelView) => new Map(channel.prices.map((price) => [price.variantId, price.own]));

  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-xl border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">Canales de POWIP</h3>
            <p className="text-sm text-muted-foreground">Leen la ficha del producto directamente. Al activar un canal eliges su precio: igual al de tienda, más caro, más barato o un precio fijo.</p>
          </div>
          {stores.length > 1 ? (
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Tienda</span>
              <select aria-label="Tienda" className="h-9 rounded-md border bg-background px-2 text-sm" value={currentStore} onChange={(event) => setStoreId(event.target.value)}>
                {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
              </select>
            </label>
          ) : null}
        </div>
        {!currentStore ? (
          <p className="text-sm text-muted-foreground">La empresa todavía no tiene tiendas.</p>
        ) : channelsQuery.isError ? (
          <p role="alert" className="text-sm">No se pudieron cargar los canales. {apiErrorInfo(channelsQuery.error, "").message} <Button variant="outline" size="sm" onClick={() => void channelsQuery.refetch()}>Reintentar</Button></p>
        ) : !view ? (
          <p role="status" className="text-sm text-muted-foreground">Cargando canales…</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Activo</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Qué muestra</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {POWIP_CHANNELS.map((meta) => {
                  if (meta.code === "POWIP_LIVE") {
                    return (
                      <TableRow key={meta.code}>
                        <TableCell />
                        <TableCell><ChannelCell meta={meta} account={`${storeName} · live`} /></TableCell>
                        <TableCell><span className={PILL_TEAL}>Se maneja en Live</span></TableCell>
                        <TableCell>{meta.shows}<small className="block text-xs text-muted-foreground">{meta.showsHint}</small></TableCell>
                        <TableCell><span className="text-sm text-muted-foreground">Precio live · se edita en POWIP Live</span></TableCell>
                        <TableCell className="text-right"><Button variant="outline" size="sm" asChild><Link href="/live">Abrir POWIP Live ↗</Link></Button></TableCell>
                      </TableRow>
                    );
                  }
                  const channel = view.channels.find((row) => row.channel === meta.code);
                  if (!channel) return null;
                  const prices = channel.prices.map((price) => price.price);
                  const low = channel.prices.filter((price) => price.belowCost).length;
                  return (
                    <TableRow key={meta.code}>
                      <TableCell>
                        <Switch
                          aria-label={`Activar en ${meta.name}`}
                          checked={channel.active}
                          disabled={!view.canEdit || save.isPending}
                          onCheckedChange={(next) => (next ? setPriceDialog({ channel, activating: true }) : setDeactivating(channel))}
                        />
                      </TableCell>
                      <TableCell><ChannelCell meta={meta} account={meta.code === "POWIP_CRM" ? "Catálogo del chat" : storeName} /></TableCell>
                      <TableCell><span className={channel.active ? PILL_TEAL : PILL_GRAY}>{channel.active ? "Al día" : "No activado"}</span></TableCell>
                      <TableCell>{channel.active ? meta.shows : "—"}</TableCell>
                      <TableCell>
                        {channel.active ? (
                          <div className="space-y-0.5">
                            <b className="tabular-nums" data-testid={`channel-price-${meta.code}`}>{priceRange(prices)}</b>
                            <small className="block text-xs text-muted-foreground">
                              {channel.ruleLabel}
                              {channel.ownPriceCount ? ` · ${channel.ownPriceCount} variante${channel.ownPriceCount === 1 ? "" : "s"} con precio propio` : ""}
                            </small>
                            {low ? <small className="block text-xs font-medium text-amber-700 dark:text-amber-300">Por debajo del costo en {low} variante{low === 1 ? "" : "s"}</small> : null}
                            {view.canEdit ? (
                              <button type="button" className="text-xs font-semibold text-[#027778] hover:underline" onClick={() => setPriceDialog({ channel, activating: false })}>Cambiar precio</button>
                            ) : null}
                          </div>
                        ) : (
                          <small className="text-xs text-muted-foreground">Se define al activar</small>
                        )}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        {view && !view.canEdit ? <p className="text-xs text-muted-foreground">Solo el Administrador u Operaciones activan canales o cambian su precio.</p> : null}
        <p className="text-xs text-muted-foreground">
          El precio de cada canal se ve y se ajusta por variante en <Link className="font-medium text-[#027778] hover:underline" href="/productos/listas-precios">Listas de precios</Link>. Un precio escrito ahí a mano es propio de esa variante y la regla no lo cambia.
        </p>
      </section>

      {origin === "shopify" ? (
        <section className="space-y-2 rounded-xl border p-4">
          <h3 className="text-base font-semibold">Canales externos</h3>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
            <ChannelChip label="SH" color="#1f8a4c" size="lg" />
            <div className="min-w-0 flex-1">
              <b>Shopify</b>
              <small className="block text-xs text-muted-foreground">Shopify es dueño del contenido y del precio. POWIP solo envía stock.</small>
            </div>
            <span className={PILL_GRAY}>Lo administra Shopify</span>
            <span className="text-xs text-muted-foreground">Qué se envía: solo stock · Precio: lo pone Shopify</span>
          </div>
          <p className="text-xs text-muted-foreground">Publicar desde POWIP en Shopify, Mercado Libre y Falabella llega en las próximas fases.</p>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Origen del producto:</span>
          <ChannelBadge source={product.externalSource} />
          <span className="text-muted-foreground">
            {origin === "manual" ? "Creado en POWIP (alta manual o Excel)." : `Importado desde ${CHANNEL_LABEL[origin]}${product.externalId ? ` (ID ${product.externalId})` : ""}.`}
          </span>
        </div>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Variante</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Canales unidos</TableHead>
                <TableHead>SKU en Shopify</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {live.map((variant) => {
                const sources = [...new Set((variant.linkedSources ?? []).map((source) => source.toLowerCase()))];
                return (
                  <TableRow key={variant.id}>
                    <TableCell className="font-medium">{formatVariantLabel(variant.attributeValues) || "Única"}</TableCell>
                    <TableCell className="font-mono text-xs">{variant.companySku || variant.sku}</TableCell>
                    <TableCell>
                      {sources.length ? <div className="flex flex-wrap gap-1">{sources.map((source) => <ChannelBadge key={source} source={source} />)}</div> : <span className="text-muted-foreground">Sin canal (solo POWIP)</span>}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{variant.shopifySku || "—"}</TableCell>
                  </TableRow>
                );
              })}
              {live.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sin variantes.</TableCell></TableRow> : null}
            </TableBody>
          </Table>
        </div>
      </section>

      {priceDialog && view ? (
        <ChannelPriceDialog
          key={`${priceDialog.channel.channel}-${priceDialog.activating}`}
          open
          activating={priceDialog.activating}
          channelName={priceDialog.channel.name}
          productName={product.name}
          initialRule={priceDialog.channel.rule}
          igvIncluded={view.igvIncluded}
          saving={save.isPending}
          variants={view.variants.map((variant) => ({
            storePrice: variant.storePrice,
            own: ownByVariant(priceDialog.channel).get(variant.variantId) ?? false,
            averageCost: variant.averageCost,
          }))}
          onCancel={() => setPriceDialog(null)}
          onConfirm={(rule) => save.mutate({ channel: priceDialog.channel, active: true, rule })}
        />
      ) : null}

      <AlertDialog open={!!deactivating} onOpenChange={(next) => { if (!next && !save.isPending) setDeactivating(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desactivar en {deactivating?.name}</AlertDialogTitle>
            <AlertDialogDescription>
              {product.name} deja de mostrarse en {deactivating?.name} al instante. Su precio se guarda para cuando lo actives de nuevo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={save.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={save.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (deactivating) save.mutate({ channel: deactivating, active: false, rule: deactivating.rule });
              }}
            >
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ChannelCell({ meta, account }: { meta: (typeof POWIP_CHANNELS)[number]; account: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <ChannelChip label={meta.short} color={meta.color} size="lg" />
      <div className="min-w-0">
        <b className="block text-sm">{meta.name}</b>
        {account ? <small className="block text-xs text-muted-foreground">{account}</small> : null}
      </div>
    </div>
  );
}
