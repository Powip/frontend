"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift, Info, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { hasAdminAccess, isSuperadmin } from "@/config/permissions.config";
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
import { promoRuleText, promoTiming, promoValidityText } from "@/lib/promotions/promoRules";
import { hasPendingGiftMigration, migrateLocalGifts, type GiftMigrationResult } from "@/lib/promotions/giftMigration";
import { variantLabel } from "@/lib/packs/packMath";
import { PromotionFormDialog } from "./PromotionFormDialog";

type Filter = "all" | "VOLUME" | "GIFT" | "off";

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
 * FEAT-24 H9 (H9-D5) — Ventas › Promociones (mockup `vPromos`): VOLUME y GIFT en el backend, por tienda,
 * por los canales reales del pedido y con vigencia. Los regalos que vivían en el navegador se pasan al
 * servidor una sola vez (con aviso) y después ya no se leen de ahí.
 */
export default function PromotionsView() {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";
  const stores = useMemo(() => auth?.company?.stores ?? [], [auth?.company?.stores]);
  const isAdmin = isSuperadmin(auth?.user?.email) || hasAdminAccess(auth?.user?.role);
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<Promotion | "new" | null>(null);
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

  const rows = (promos.data ?? []).filter((promo) => (filter === "off" ? !promo.isActive : filter === "all" ? true : promo.type === filter));

  const toggle = async (promo: Promotion) => {
    try {
      await updatePromotion(promo.id, { isActive: !promo.isActive });
      toast.success(promo.isActive ? "Promoción desactivada" : "Promoción activada");
      refresh();
    } catch (error) {
      toast.error(apiErrorInfo(error, "No se pudo cambiar la promoción.").message);
    }
  };
  const remove = async (promo: Promotion) => {
    if (!window.confirm(`¿Eliminar «${promo.name}»? Esta acción no se puede deshacer.`)) return;
    try {
      await deletePromotion(promo.id);
      toast.success("Promoción eliminada");
      refresh();
    } catch (error) {
      toast.error(apiErrorInfo(error, "No se pudo eliminar la promoción.").message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex max-w-3xl gap-2 rounded-md border bg-muted/40 p-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <p>
            <b>Ordenamos Packs &amp; Promos.</b> Los <b>packs</b> (antes «Bundle») ahora son productos con SKU propio en <Link className="underline" href="/productos/packs">Productos › Packs</Link>. Aquí quedan las <b>promociones</b>: reglas de precio que se aplican solas al registrar la venta, por tienda y canal.
          </p>
        </div>
        {isAdmin ? <Button onClick={() => setEditing("new")}><Plus className="mr-1 h-4 w-4" />Nueva promoción</Button> : null}
      </div>
      {migration.result ? <MigrationNotice result={migration.result} onDismiss={migration.dismiss} /> : null}
      {migration.pendingForOthers ? (
        <p role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          Este navegador tiene regalos guardados que todavía no están en el servidor. Pídele a un Administrador que abra Promociones desde este navegador para pasarlos.
        </p>
      ) : null}
      {!isAdmin ? <p className="text-xs text-muted-foreground">Las promociones las configura el Administrador.</p> : null}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar promociones">
        {([["all", "Todas"], ["VOLUME", "Volumen"], ["GIFT", "Regalo"], ["off", "Inactivas"]] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={cn("rounded-full border px-3.5 py-1.5 text-sm font-medium", filter === key ? "border-primary bg-primary/10 text-primary" : "bg-background text-muted-foreground hover:bg-muted")}
          >
            {label}
          </button>
        ))}
      </div>

      {promos.isError ? (
        <p role="alert" className="text-sm">No se pudieron cargar las promociones. <Button variant="outline" size="sm" onClick={() => void promos.refetch()}>Reintentar</Button></p>
      ) : promos.isPending ? (
        <p role="status" className="text-sm text-muted-foreground">Cargando promociones…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">Sin promociones en este filtro.</p>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
          {rows.map((promo) => {
            const timing = promoTiming(promo);
            return (
              <article key={promo.id} className="space-y-3 rounded-xl border bg-card p-4" data-testid={`promo-${promo.id}`} aria-label={promo.name}>
                <div className="flex items-start gap-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    {promo.type === "GIFT" ? <Gift className="h-4 w-4" aria-hidden="true" /> : <Package className="h-4 w-4" aria-hidden="true" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold">{promo.name}</h3>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="secondary">{promo.type === "GIFT" ? "Regalo" : "Volumen"}</Badge>
                      <Badge variant={promo.isActive ? "default" : "outline"}>{promo.isActive ? "Activa" : "Inactiva"}</Badge>
                      {timing !== "vigente" ? <Badge variant="outline">{timing === "programada" ? "Programada" : "Vencida"}</Badge> : null}
                    </div>
                  </div>
                  {isAdmin ? (
                    <div className="flex">
                      <Button variant="ghost" size="icon" aria-label={`Editar ${promo.name}`} onClick={() => setEditing(promo)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" aria-label={`Eliminar ${promo.name}`} onClick={() => void remove(promo)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ) : null}
                </div>
                <p className="text-sm">{promoRuleText(promo, names)}</p>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {promo.storeIds.length ? promo.storeIds.map((id) => <Badge key={id} variant="outline">{storeName(id)}</Badge>) : <Badge variant="outline">Todas las tiendas</Badge>}
                  {promo.channels.length ? promo.channels.map((channel) => <Badge key={channel} variant="outline">{channelLabel(channel)}</Badge>) : <Badge variant="outline">Todos los canales</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{promoValidityText(promo)}</p>
                {isAdmin ? <Button size="sm" variant="outline" onClick={() => void toggle(promo)}>{promo.isActive ? "Desactivar" : "Activar"}</Button> : null}
              </article>
            );
          })}
        </div>
      )}
      {editing ? (
        <PromotionFormDialog
          key={editing === "new" ? "new" : editing.id}
          promo={editing === "new" ? null : editing}
          stores={stores}
          products={products.data ?? []}
          variantNames={variantNames}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}
