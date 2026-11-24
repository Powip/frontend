"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { canManagePromotions } from "@/config/permissions.config";
import { cn } from "@/lib/utils";
import {
  createPromotion,
  deletePromotion,
  listPromotions,
  updatePromotion,
  type Promotion,
} from "@/services/promotionsService";
import { listPurchasableProducts } from "@/services/purchasesService";
import { fetchVariantsByIds } from "@/services/variantCodesService";
import { apiErrorInfo } from "@/lib/catalog/catalogPayloads";
import { channelLabel } from "@/lib/promotions/orderChannels";
import { promoRuleText, promoValidityText } from "@/lib/promotions/promoRules";
import { STATUS_LABEL, discountLabel, limaDateTimeText, type PromoStatus } from "@/lib/promotions/campaign";
import { hasPendingGiftMigration, migrateLocalGifts, type GiftMigrationResult } from "@/lib/promotions/giftMigration";
import { variantLabel } from "@/lib/packs/packMath";
import { PromotionFormDialog } from "./PromotionFormDialog";
import { CampaignFormDialog, DeletePromotionDialog } from "./CampaignFormDialog";

type KindFilter = "all" | "CAMPAIGN" | "VOLUME" | "GIFT";
type StatusFilter = "all" | PromoStatus;
type Editing =
  | { kind: "CAMPAIGN"; promo: Promotion | null; productIds?: string[] }
  | { kind: "VOLUME" | "GIFT"; promo: Promotion | null }
  | null;

const KIND_LABEL: Record<Promotion["type"], string> = { CAMPAIGN: "Precio de campaña", VOLUME: "Volumen", GIFT: "Regalo" };
const KIND_PILL: Record<Promotion["type"], string> = {
  CAMPAIGN: "bg-[#efecfb] text-[#4C2FB5] dark:bg-violet-950/50 dark:text-violet-200",
  VOLUME: "bg-[#e7f3f3] text-[#015d5e] dark:bg-teal-950/50 dark:text-teal-200",
  GIFT: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
};
const STATUS_PILL: Record<PromoStatus, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  SCHEDULED: "bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200",
  ENDED: "bg-muted text-muted-foreground",
  PAUSED: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
};
const pill = "inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold";

/** `?nueva=campana&productos=a,b` (desde la lista de productos o la ficha) o `?editar=<id>`. */
function readDeepLink(): { create: boolean; productIds: string[]; editId: string | null } {
  try {
    const params = new URLSearchParams(window.location.search);
    return {
      create: params.get("nueva") === "campana",
      productIds: (params.get("productos") ?? "").split(",").filter(Boolean).slice(0, 500),
      editId: params.get("editar"),
    };
  } catch {
    return { create: false, productIds: [], editId: null };
  }
}

/** Una migración en curso por empresa (evita correrla dos veces si el efecto se repite). */
const runningMigrations = new Map<string, Promise<GiftMigrationResult>>();

function safeStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function useGiftMigration(companyId: string, canMigrate: boolean, onMigrated: () => void) {
  const [result, setResult] = useState<GiftMigrationResult | null>(null);
  const [pendingForOthers, setPendingForOthers] = useState(false);
  const notify = useRef(onMigrated);
  notify.current = onMigrated;
  useEffect(() => {
    const storage = safeStorage();
    if (!companyId || !storage || !hasPendingGiftMigration(storage, companyId)) return;
    if (!canMigrate) {
      setPendingForOthers(true);
      return;
    }
    let active = true;
    const running =
      runningMigrations.get(companyId) ??
      migrateLocalGifts({
        storage,
        companyId,
        create: (body) => createPromotion(body),
        deactivate: (id) => updatePromotion(id, { isActive: false }),
      }).finally(() => runningMigrations.delete(companyId));
    runningMigrations.set(companyId, running);
    void running.then((outcome) => {
      if (!active) return;
      setResult(outcome);
      if (outcome.migrated.length) notify.current();
    });
    return () => {
      active = false;
    };
  }, [companyId, canMigrate]);
  return { result, pendingForOthers, dismiss: () => setResult(null) };
}

function MigrationNotice({ result, onDismiss }: { result: GiftMigrationResult; onDismiss: () => void }) {
  if (!result.migrated.length && !result.skipped.length && !result.failed.length) return null;
  return (
    <div role="status" className="space-y-2 rounded-md border border-sky-300 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-500/10 dark:text-sky-200">
      {result.migrated.length ? (
        <p>
          <b>Pasamos {result.migrated.length} regalo(s) al servidor.</b> Estaban guardados solo en este navegador; ahora aplican en todas las ventas manuales de la empresa y se configuran aquí.
          {result.migrated.some((item) => item.extraOptions > 0) ? " Los que tenían varias opciones de regalo quedaron con la primera." : ""}
        </p>
      ) : null}
      {result.skipped.length ? (
        <div>
          <p><b>No se pudieron pasar {result.skipped.length}:</b> créalos de nuevo (quedó una copia de respaldo en este navegador).</p>
          <ul className="ml-5 list-disc">{result.skipped.map((item) => <li key={item.name}>{item.name}: {item.reason}</li>)}</ul>
        </div>
      ) : null}
      {result.failed.length ? <p><b>{result.failed.length} regalo(s) no se pudieron pasar ahora.</b> Se volverá a intentar la próxima vez que abras Promociones.</p> : null}
      <Button size="sm" variant="outline" onClick={onDismiss}>Entendido</Button>
    </div>
  );
}

/**
 * FEAT-24 H9 (H9-D5) y FEAT-32 M3 (spec §7.12) — Promociones: precio de campaña, volumen y regalo en una tabla
 * con filtro por clase y por estado (con conteo). «＋ Nueva promoción» pide la clase. Los regalos que vivían en
 * el navegador se pasan al servidor una sola vez (con aviso) y después ya no se leen de ahí.
 */
export default function PromotionsView() {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";
  const stores = useMemo(() => auth?.company?.stores ?? [], [auth?.company?.stores]);
  // Administrador u Operaciones, igual que ms-ventas (FEAT-32 M3, §6.13).
  const isAdmin = canManagePromotions(auth?.user);
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<KindFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [choosing, setChoosing] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<Promotion | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["promotions"] });
  const migration = useGiftMigration(companyId, isAdmin, refresh);

  const promos = useQuery({ queryKey: ["promotions", companyId], queryFn: ({ signal }) => listPromotions(signal), enabled: !!companyId, retry: false });
  const products = useQuery({ queryKey: ["promotion-products", companyId], queryFn: ({ signal }) => listPurchasableProducts(companyId, signal), enabled: !!companyId, retry: false, staleTime: 60_000 });
  const variantIds = useMemo(
    () => [...new Set((promos.data ?? []).flatMap((promo) => [promo.giftVariantId, promo.triggerVariantId]).filter((id): id is string => !!id))].sort(),
    [promos.data],
  );
  const variants = useQuery({
    queryKey: ["promotion-variants", companyId, variantIds],
    queryFn: () => fetchVariantsByIds(variantIds, companyId),
    enabled: variantIds.length > 0,
    retry: false,
  });
  const variantNames = useMemo(() => new Map((variants.data ?? []).map((variant) => [variant.id, variantLabel(variant.productName, variant.attributeValues)])), [variants.data]);
  const productNames = useMemo(() => new Map((products.data ?? []).map((product) => [product.id, product.name])), [products.data]);
  const names = {
    product: (id: string | null) => (id ? productNames.get(id) ?? "un producto" : "un producto"),
    variant: (id: string | null) => (id ? variantNames.get(id) ?? "un producto" : "un producto"),
  };
  const storeName = (id: string) => stores.find((store) => store.id === id)?.name ?? "Tienda";

  // Enlace directo: «Crear promoción» desde Productos o la ficha, o «Editar» desde la ficha.
  const deepLink = useRef<ReturnType<typeof readDeepLink> | null>(null);
  useEffect(() => {
    if (deepLink.current || !isAdmin) return;
    deepLink.current = readDeepLink();
    if (deepLink.current.create) setEditing({ kind: "CAMPAIGN", promo: null, productIds: deepLink.current.productIds });
  }, [isAdmin]);
  useEffect(() => {
    const editId = deepLink.current?.editId;
    if (!editId || !promos.data || !isAdmin) return;
    const promo = promos.data.find((row) => row.id === editId);
    deepLink.current = { create: false, productIds: [], editId: null };
    if (promo) setEditing(promo.type === "CAMPAIGN" ? { kind: "CAMPAIGN", promo } : { kind: promo.type, promo });
  }, [promos.data, isAdmin]);

  const all = promos.data ?? [];
  const ofKind = all.filter((promo) => kind === "all" || promo.type === kind);
  const count = (key: StatusFilter) => ofKind.filter((promo) => key === "all" || promo.status === key).length;
  const rows = ofKind.filter((promo) => status === "all" || promo.status === status);

  const togglePause = async (promo: Promotion) => {
    try {
      await updatePromotion(promo.id, { isActive: !promo.isActive });
      toast.success(promo.isActive ? `«${promo.name}» pausada` : `«${promo.name}» reanudada`);
      refresh();
    } catch (error) {
      toast.error(apiErrorInfo(error, "No se pudo cambiar la promoción.").message);
    }
  };
  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deletePromotion(deleting.id);
      toast.success(`Promoción «${deleting.name}» eliminada`);
      setDeleting(null);
      refresh();
    } catch (error) {
      toast.error(apiErrorInfo(error, "No se pudo eliminar la promoción.").message);
    } finally {
      setBusy(false);
    }
  };

  const rule = (promo: Promotion) => {
    if (promo.type !== "CAMPAIGN") return <span>{promoRuleText(promo, names)}</span>;
    const adjusted = promo.products.some((product) => product.discountType) || promo.manualPrices.length > 0;
    return (
      <span>
        {discountLabel({ type: promo.discountType, value: promo.discountValue })}
        {adjusted ? <small className="block text-xs text-muted-foreground">Con ajustes por producto</small> : null}
      </span>
    );
  };
  const productsCell = (promo: Promotion) => {
    if (promo.type === "CAMPAIGN") {
      if (promo.allProducts) return <small className="text-xs">Todos los productos{products.data ? ` (${products.data.length})` : ""}</small>;
      const first = promo.products.slice(0, 2).map((product) => names.product(product.productId));
      return (
        <small className="text-xs">
          {first.join(", ")}
          {promo.products.length > 2 ? ` y ${promo.products.length - 2} más` : ""}
          <span className="block text-muted-foreground">{promo.products.length} producto{promo.products.length === 1 ? "" : "s"}</span>
        </small>
      );
    }
    if (promo.type === "VOLUME") return <small className="text-xs">{names.product(promo.productId)}</small>;
    return <small className="text-xs text-muted-foreground">{promo.giftCondition === "AMOUNT" ? "Toda la compra" : names.product(promo.productId)}</small>;
  };
  const dates = (promo: Promotion) => {
    if (promo.type === "CAMPAIGN")
      return (
        <span className="whitespace-nowrap text-xs">
          {limaDateTimeText(promo.startsAt)}
          <small className="block text-muted-foreground">hasta {limaDateTimeText(promo.endsAt)}</small>
        </span>
      );
    return <span className="text-xs">{promo.startsAt || promo.endsAt ? promoValidityText(promo) : <span className="text-muted-foreground">Sin fecha</span>}</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por tipo">
            {([["all", "Todos los tipos"], ["CAMPAIGN", "Precio de campaña"], ["VOLUME", "Volumen"], ["GIFT", "Regalo"]] as const).map(([key, label]) => (
              <button key={key} type="button" aria-pressed={kind === key} onClick={() => setKind(key)} className={cn("rounded-full border px-3 py-1 text-sm font-medium", kind === key ? "border-[#027778] bg-[#e7f3f3] text-[#015d5e]" : "bg-background text-muted-foreground hover:bg-muted")}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por estado">
            {([["all", "Todas"], ["ACTIVE", "Activas"], ["SCHEDULED", "Programadas"], ["ENDED", "Terminadas"], ["PAUSED", "Pausadas"]] as const).map(([key, label]) => (
              <button key={key} type="button" aria-pressed={status === key} onClick={() => setStatus(key)} className={cn("rounded-full border px-3 py-1 text-sm font-medium", status === key ? "border-[#027778] bg-[#e7f3f3] text-[#015d5e]" : "bg-background text-muted-foreground hover:bg-muted")}>
                {label} ({count(key)})
              </button>
            ))}
          </div>
        </div>
        {isAdmin ? <Button onClick={() => setChoosing(true)}><Plus className="mr-1 h-4 w-4" />Nueva promoción</Button> : null}
      </div>
      <div className="rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
        Las promociones no crean productos: <b>cambian el precio de SKUs que ya existen</b>. El precio de campaña se calcula sobre el precio de cada canal y se ve al instante en los canales de POWIP; en Shopify, Mercado Libre y Falabella se enviará cuando esos canales se administren desde POWIP. Volumen y regalo se aplican solos al registrar la venta. POWIP Live usa su propio precio live y no entra en estas promociones.
      </div>
      {migration.result ? <MigrationNotice result={migration.result} onDismiss={migration.dismiss} /> : null}
      {migration.pendingForOthers ? (
        <p role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          Este navegador tiene regalos guardados que todavía no están en el servidor. Pídele a un Administrador que abra Promociones desde este navegador para pasarlos.
        </p>
      ) : null}
      {!isAdmin ? <p className="text-xs text-muted-foreground">Las promociones las configura el Administrador u Operaciones.</p> : null}

      {promos.isError ? (
        <p role="alert" className="text-sm">No se pudieron cargar las promociones. <Button variant="outline" size="sm" onClick={() => void promos.refetch()}>Reintentar</Button></p>
      ) : promos.isPending ? (
        <p role="status" className="text-sm text-muted-foreground">Cargando promociones…</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Promoción</th>
                <th className="px-3 py-2">Regla</th>
                <th className="px-3 py-2">Canales</th>
                <th className="px-3 py-2">Fechas</th>
                <th className="px-3 py-2">Productos / SKU</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((promo) => (
                <tr key={promo.id} className="border-t align-top" aria-label={promo.name} data-testid={`promo-${promo.id}`}>
                  <td className="px-3 py-2"><span className={cn(pill, KIND_PILL[promo.type])}>{KIND_LABEL[promo.type]}</span></td>
                  <td className="px-3 py-2">
                    <b>{promo.name}</b>
                    <small className="block text-xs text-muted-foreground">{promo.storeIds.length ? promo.storeIds.map(storeName).join(", ") : "Todas las tiendas"}</small>
                    {promo.combinable ? <small className="block text-xs text-muted-foreground">Se puede combinar</small> : null}
                  </td>
                  <td className="px-3 py-2">{rule(promo)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {promo.channels.length ? promo.channels.map((channel) => <span key={channel} className="rounded border px-1.5 py-0.5 text-xs">{channelLabel(channel)}</span>) : <span className="text-xs text-muted-foreground">Todos</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2">{dates(promo)}</td>
                  <td className="px-3 py-2">{productsCell(promo)}</td>
                  <td className="px-3 py-2"><span className={cn(pill, STATUS_PILL[promo.status])}>{STATUS_LABEL[promo.status]}</span></td>
                  <td className="px-3 py-2">
                    {isAdmin ? (
                      <div className="flex flex-nowrap gap-1.5">
                        <Button size="sm" variant="outline" aria-label={`Editar ${promo.name}`} onClick={() => setEditing(promo.type === "CAMPAIGN" ? { kind: "CAMPAIGN", promo } : { kind: promo.type, promo })}>Editar</Button>
                        {promo.status !== "ENDED" ? (
                          <Button size="sm" variant="outline" onClick={() => void togglePause(promo)}>{promo.isActive ? "Pausar" : "Reanudar"}</Button>
                        ) : null}
                        <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-50" aria-label={`Eliminar ${promo.name}`} onClick={() => setDeleting(promo)}>Eliminar</Button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? <tr><td colSpan={8} className="px-3 py-10 text-center text-sm text-muted-foreground">Sin promociones en este filtro.</td></tr> : null}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={choosing} onOpenChange={setChoosing}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva promoción</DialogTitle>
            <DialogDescription>Elige qué tipo de promoción quieres crear.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {([
              ["CAMPAIGN", "Precio de campaña", "Cyber, liquidaciones, precio especial del chat"],
              ["VOLUME", "Volumen", "Precio por cantidad"],
              ["GIFT", "Regalo", "Por monto de compra o producto comprado"],
            ] as const).map(([value, title, hint]) => (
              <button
                key={value}
                type="button"
                className="rounded-lg border p-3 text-left hover:border-[#027778] hover:bg-[#e7f3f3] dark:hover:bg-teal-950/40"
                onClick={() => {
                  setChoosing(false);
                  setEditing(value === "CAMPAIGN" ? { kind: "CAMPAIGN", promo: null } : { kind: value, promo: null });
                }}
              >
                <b className="block text-sm">{title}</b>
                <small className="text-xs text-muted-foreground">{hint}</small>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {editing?.kind === "CAMPAIGN" ? (
        <CampaignFormDialog
          key={editing.promo?.id ?? "new-campaign"}
          promo={editing.promo}
          stores={stores}
          products={products.data ?? []}
          initialProductIds={editing.productIds}
          onClose={() => setEditing(null)}
        />
      ) : editing ? (
        <PromotionFormDialog
          key={editing.promo?.id ?? `new-${editing.kind}`}
          promo={editing.promo}
          initialType={editing.kind}
          stores={stores}
          products={products.data ?? []}
          variantNames={variantNames}
          onClose={() => setEditing(null)}
        />
      ) : null}
      <DeletePromotionDialog promo={deleting} busy={busy} onCancel={() => setDeleting(null)} onConfirm={() => void remove()} />
    </div>
  );
}
