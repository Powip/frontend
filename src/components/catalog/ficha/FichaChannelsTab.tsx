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
import { canManagePromotions } from "@/config/permissions.config";
import { CHANNEL_LABEL, productChannel } from "@/lib/catalog/catalogProducts";
import { POWIP_CHANNELS, priceRange, type PriceRule } from "@/lib/catalog/productChannels";
import { apiErrorInfo } from "@/lib/catalog/catalogPayloads";
import { formatVariantLabel } from "@/lib/variantAttributes";
import type { CatalogProductDetail, CatalogVariantDetail } from "@/services/catalogProductService";
import { getProductChannels, saveProductChannel, type ProductChannelView, type ProductChannelsView } from "@/services/productChannelsService";
import { getCampaignPrices, listPromotions, type Promotion } from "@/services/promotionsService";
import { channelLabel } from "@/lib/promotions/orderChannels";
import {
  STATUS_LABEL,
  activeCampaign,
  campaignTag,
  discountLabel,
  limaShortDate,
  nextCampaign,
  productCampaigns,
  productDiscount,
  promoPriceFor,
  promoStatus,
  type PromoStatus,
} from "@/lib/promotions/campaign";

const pill = "inline-block rounded-full px-2 py-0.5 text-xs font-semibold";
const PILL_TEAL = `${pill} bg-[#e7f3f3] text-[#015d5e] dark:bg-teal-950/50 dark:text-teal-200`;
const PILL_GRAY = `${pill} bg-muted text-muted-foreground`;
const PILL_PROMO = `${pill} bg-[#fde7f1] text-[#a3185a] dark:bg-pink-950/50 dark:text-pink-200`;
const PILL_SCHEDULED = `${pill} bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200`;
const STATUS_PILL: Record<PromoStatus, string> = {
  ACTIVE: `${pill} bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200`,
  SCHEDULED: PILL_SCHEDULED,
  ENDED: PILL_GRAY,
  PAUSED: `${pill} bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200`,
};
const PROMOS_HREF = "/packs-promos";

type PriceDialogState = { channel: ProductChannelView; activating: boolean } | null;

/**
 * FEAT-32 M2 (spec §7.8) — Canales: los de POWIP por tienda (activo y precio con su regla) y, debajo, de dónde
 * viene el producto y con qué canal está unida cada variante (FEAT-24 H4-D5). Shopify en la fase 1: «Lo
 * administra Shopify» (POWIP solo envía stock; publicar es de la fase 2).
 * FEAT-32 M3 (§7.8): el precio de cada canal con la campaña activa (y el de antes tachado) o la próxima, y la
 * sección «Promociones de este producto» con el precio de cada canal, «Ver todas» y «＋ Nueva promoción».
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
  const companyId = auth?.company?.id ?? "";
  const canPromote = canManagePromotions(auth?.user);

  const channelsQuery = useQuery({
    queryKey: ["product-channels", product.id, currentStore],
    queryFn: ({ signal }) => getProductChannels(product.id, currentStore, signal),
    enabled: !!currentStore,
    retry: false,
  });
  const view = channelsQuery.data;

  // FEAT-32 M3 — campañas del producto en la tienda elegida. Si /promos falla, la ficha sigue sin promociones.
  const promosQuery = useQuery({
    queryKey: ["promotions", companyId],
    queryFn: ({ signal }) => listPromotions(signal),
    enabled: !!companyId,
    retry: false,
    staleTime: 60_000,
  });
  const storeScope = useMemo(() => (currentStore ? [currentStore] : []), [currentStore]);
  const campaigns = useMemo(() => productCampaigns(promosQuery.data ?? [], product.id, storeScope), [promosQuery.data, product.id, storeScope]);
  const campaignChannels = useMemo(() => [...new Set(campaigns.flatMap((promo) => promo.channels))].sort(), [campaigns]);
  const campaignPrices = useQuery({
    queryKey: ["campaign-prices", currentStore, campaignChannels.join(","), product.id],
    queryFn: ({ signal }) => getCampaignPrices({ storeId: currentStore || undefined, channels: campaignChannels, productIds: [product.id] }, signal),
    enabled: campaignChannels.length > 0,
    retry: false,
    staleTime: 30_000,
  });
  const otherPromos = useMemo(() => {
    const variantIds = new Set(variants.map((variant) => variant.id));
    return (promosQuery.data ?? []).filter(
      (promo) =>
        promo.type !== "CAMPAIGN" &&
        promoStatus(promo) !== "ENDED" &&
        (promo.productId === product.id || (!!promo.giftVariantId && variantIds.has(promo.giftVariantId)) || (!!promo.triggerVariantId && variantIds.has(promo.triggerVariantId))),
    );
  }, [promosQuery.data, product.id, variants]);

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
                  const promo = activeCampaign(promosQuery.data ?? [], product.id, storeScope, meta.code);
                  const promoPrices = promo ? prices.map((price) => promoPriceFor(promo, product.id, meta.code, price)).filter((price): price is number => price !== null) : [];
                  const upcoming = promo ? null : nextCampaign(promosQuery.data ?? [], product.id, storeScope, meta.code);
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
                            <div className="flex flex-wrap items-baseline gap-1.5">
                              <b className="tabular-nums" data-testid={`channel-price-${meta.code}`}>{priceRange(promoPrices.length ? promoPrices : prices)}</b>
                              {promoPrices.length ? <s className="text-xs tabular-nums text-muted-foreground">{priceRange(prices)}</s> : null}
                            </div>
                            <small className="block text-xs text-muted-foreground">
                              {channel.ruleLabel}
                              {channel.ownPriceCount ? ` · ${channel.ownPriceCount} variante${channel.ownPriceCount === 1 ? "" : "s"} con precio propio` : ""}
                            </small>
                            {promo ? (
                              <small className="block text-xs text-muted-foreground">
                                <span className={PILL_PROMO}>{campaignTag(promo, product.id)}</span> hasta {limaShortDate(promo.endsAt)}
                              </small>
                            ) : upcoming ? (
                              <small className="block text-xs text-muted-foreground">
                                <span className={PILL_SCHEDULED}>Programada</span> {upcoming.name} desde {limaShortDate(upcoming.startsAt)}
                              </small>
                            ) : null}
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

      <ProductPromotionsSection
        productId={product.id}
        campaigns={campaigns}
        otherPromos={otherPromos}
        loading={promosQuery.isPending && !!companyId}
        failed={promosQuery.isError}
        prices={campaignPrices.data?.products.find((row) => row.productId === product.id) ?? null}
        inactiveChannels={(view?.channels ?? []).filter((row) => !row.active).map((row) => row.channel as string)}
        canPromote={canPromote}
      />

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

/**
 * FEAT-32 M3 (spec §7.8) — «Promociones de este producto»: las campañas que lo incluyen en la tienda elegida,
 * con el precio que queda en cada canal («antes S/ X»), sus fechas y su estado. Volumen y regalo se nombran
 * aparte («También aplica»). Se crean y se editan en Comercial › Packs y promociones.
 */
function ProductPromotionsSection({
  productId,
  campaigns,
  otherPromos,
  loading,
  failed,
  prices,
  inactiveChannels,
  canPromote,
}: {
  productId: string;
  campaigns: Promotion[];
  otherPromos: Promotion[];
  loading: boolean;
  failed: boolean;
  prices: { variants: Array<{ storePrice: number; channels: Record<string, number> }>; inactiveChannels: string[] } | null;
  inactiveChannels: string[];
  canPromote: boolean;
}) {
  const channelCell = (promo: Promotion, channel: string) => {
    const bases = prices?.variants.map((variant) => variant.channels[channel] ?? variant.storePrice) ?? [];
    const finals = bases.map((base) => promoPriceFor(promo, productId, channel, base)).filter((price): price is number => price !== null);
    const off = inactiveChannels.includes(channel) || (prices?.inactiveChannels ?? []).includes(channel);
    return (
      <div key={channel} className="flex flex-wrap items-baseline gap-1.5 py-0.5 text-xs">
        <span className="rounded border px-1.5 py-0.5">{channelLabel(channel)}</span>
        {prices ? (
          <>
            <b className="tabular-nums">{finals.length ? priceRange(finals) : "—"}</b>
            <span className="text-muted-foreground">antes {priceRange(bases)}</span>
          </>
        ) : (
          <span className="text-muted-foreground">…</span>
        )}
        {off ? <span className={PILL_GRAY}>no activado</span> : null}
      </div>
    );
  };
  return (
    <section className="space-y-3 rounded-xl border p-4" aria-labelledby="product-promotions-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="product-promotions-title" className="text-base font-semibold">Promociones de este producto</h3>
          <p className="text-sm text-muted-foreground">Cyber, campañas o liquidaciones con fechas y canales propios. Se activan y terminan solas.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild><Link href={PROMOS_HREF}>Ver todas</Link></Button>
          {canPromote ? (
            <Button size="sm" asChild><Link href={`${PROMOS_HREF}?nueva=campana&productos=${encodeURIComponent(productId)}`}>＋ Nueva promoción</Link></Button>
          ) : null}
        </div>
      </div>
      {otherPromos.length ? (
        <p className="rounded-lg bg-[#e7f3f3] px-3 py-2 text-sm text-[#015d5e] dark:bg-teal-950/40 dark:text-teal-100">
          También aplica{otherPromos.length > 1 ? "n" : ""}:{" "}
          {otherPromos.map((promo, index) => (
            <span key={promo.id}>
              {index ? ", " : ""}
              <b>{promo.name}</b> ({promo.type === "VOLUME" ? "volumen" : "regalo"})
            </span>
          ))}
          . Se editan en Comercial › Packs y promociones.
        </p>
      ) : null}
      {failed ? (
        <p className="text-sm text-muted-foreground">No se pudieron cargar las promociones.</p>
      ) : loading ? (
        <p role="status" className="text-sm text-muted-foreground">Cargando promociones…</p>
      ) : campaigns.length === 0 ? (
        <p className="text-sm text-muted-foreground">Este producto no tiene promociones de precio.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Promoción</TableHead>
                <TableHead>Descuento</TableHead>
                <TableHead>Canales y precio</TableHead>
                <TableHead>Fechas</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((promo) => {
                const status = promoStatus(promo);
                const adjusted = promo.manualPrices.some((row) => row.productId === productId);
                return (
                  <TableRow key={promo.id} data-testid={`product-promo-${promo.id}`}>
                    <TableCell className="font-medium">{promo.name}</TableCell>
                    <TableCell>
                      {discountLabel(productDiscount(promo, productId))}
                      {adjusted ? <small className="block text-xs text-muted-foreground">precio ajustado</small> : null}
                    </TableCell>
                    <TableCell>{promo.channels.map((channel) => channelCell(promo, channel))}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {limaShortDate(promo.startsAt)}
                      <small className="block text-muted-foreground">hasta {limaShortDate(promo.endsAt)}</small>
                    </TableCell>
                    <TableCell><span className={STATUS_PILL[status]}>{STATUS_LABEL[status]}</span></TableCell>
                    <TableCell className="text-right">
                      {canPromote ? (
                        <Button variant="outline" size="sm" asChild><Link href={`${PROMOS_HREF}?editar=${encodeURIComponent(promo.id)}`}>Editar</Link></Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
