"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { useAuth } from "@/contexts/AuthContext";
import { canManagePacks } from "@/config/permissions.config";
import type { BundlePack, BundleProductRef } from "@/interfaces/IPack";
import { getBundleCapabilities, listBundlePromos, setBundleActive } from "@/services/bundlePromos.service";
import { apiErrorInfo } from "@/lib/catalog/catalogPayloads";
import { channelLabel } from "@/lib/promotions/orderChannels";
import { soles } from "@/lib/packs/packMath";
import { cn } from "@/lib/utils";
import { PackFormDialog, type PackFormSeed } from "./PackFormDialog";

const pill = "inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold";

/** Bundles de la empresa (`GET /bundle-promos`): la página los lee para ocultar la pestaña si no quedan activos. */
export function useLegacyBundles() {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";
  return useQuery({
    queryKey: ["bundle-promos", companyId],
    queryFn: async () => (await listBundlePromos()).bundles,
    enabled: !!companyId && !!auth?.accessToken,
    retry: false,
    staleTime: 30_000,
  });
}

/** Bundles que todavía se venden. */
export const activeBundles = (bundles: readonly BundlePack[] | undefined) => (bundles ?? []).filter((bundle) => bundle.active);

function itemText(item: BundleProductRef) {
  const details = [...Object.values(item.attributes ?? {}).filter(Boolean), item.sku ?? ""].filter(Boolean).join(" · ");
  return details ? `${item.productName} (${details})` : item.productName;
}

/** Ventana del pack llena con el bundle: sus productos (una unidad de cada uno), su precio y su nombre. */
export function bundleSeed(bundle: BundlePack): PackFormSeed {
  return {
    name: bundle.name,
    price: Number(bundle.packPrice) || undefined,
    packType: "FIXED",
    components: bundle.items.map((item) => ({ productId: item.productId ?? null, productName: item.productName, variantId: item.variantId ?? null, quantity: 1 })),
  };
}

/**
 * FEAT-32 M5 (spec §5.11, §6.18, §7.16) — pestaña Bundles anteriores: los bundles ya no se crean; se convierten en
 * pack (la ventana del pack con sus productos y su precio; al guardar, el bundle queda inactivo con el pack que lo
 * reemplaza) o se desactivan. No se borran: los pedidos viejos los referencian. Convertir y desactivar son del
 * Administrador (`/bundle-promos/capabilities`), y convertir además crea un pack.
 */
export default function LegacyBundlesView() {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";
  const queryClient = useQueryClient();
  const bundles = useLegacyBundles();
  const capabilities = useQuery({
    queryKey: ["bundle-capabilities", companyId, auth?.user?.id],
    queryFn: () => getBundleCapabilities(),
    enabled: !!companyId && !!auth?.accessToken,
    retry: false,
    staleTime: 60_000,
  });
  const canManage = capabilities.data?.canManage === true;
  const canConvert = canManage && canManagePacks(auth?.user);
  const [converting, setConverting] = useState<BundlePack | null>(null);
  const [deactivating, setDeactivating] = useState<BundlePack | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const setActive = async (bundle: BundlePack, active: boolean) => {
    setBusy(bundle.id);
    try {
      await setBundleActive(bundle.id, active);
      toast.success(active ? `«${bundle.name}» activado` : `«${bundle.name}» desactivado: ya no se vende.`);
      setDeactivating(null);
      void queryClient.invalidateQueries({ queryKey: ["bundle-promos"] });
    } catch (error) {
      toast.error(apiErrorInfo(error, "No se pudo cambiar el bundle.").message);
    } finally {
      setBusy(null);
    }
  };

  const rows = [...(bundles.data ?? [])].sort((a, b) => Number(b.active) - Number(a.active));

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Los bundles se armaron por producto, sin elegir variante: el almacén no sabe qué SKU sacar. Mientras existan, al venderlos se exige elegir la variante de cada producto. Conviértelos en pack para dejarlos amarrados a SKU; después se desactivan.
      </p>
      {capabilities.isSuccess && !canManage ? <p className="text-xs text-muted-foreground">Convertir y desactivar bundles es del Administrador.</p> : null}
      {bundles.isError ? (
        <p role="alert" className="text-sm">
          No se pudieron cargar los bundles. {apiErrorInfo(bundles.error, "").message}{" "}
          <Button variant="outline" size="sm" onClick={() => void bundles.refetch()}>Reintentar</Button>
        </p>
      ) : bundles.isPending ? (
        <p role="status" className="text-sm text-muted-foreground">Cargando bundles…</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Bundle</th>
                <th className="px-3 py-2">Productos</th>
                <th className="px-3 py-2 text-right">Precio</th>
                <th className="px-3 py-2">Canales</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {rows.map((bundle) => {
                const separate = bundle.items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
                return (
                  <tr key={bundle.id} className={cn("border-t align-top", !bundle.active && "opacity-70")} data-testid={`bundle-row-${bundle.id}`}>
                    <td className="px-3 py-2">
                      <b>{bundle.name}</b>
                      {bundle.schemaVersion !== 2 ? <small className="block text-xs text-amber-700 dark:text-amber-300">Aplica por producto, sin una variante específica.</small> : null}
                    </td>
                    <td className="px-3 py-2">{bundle.items.map(itemText).join(" + ")}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {soles(Number(bundle.packPrice))}
                      {separate > 0 ? <small className="block text-xs text-muted-foreground">suelto {soles(separate)}</small> : null}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {bundle.channels.length ? bundle.channels.map((channel) => <span key={channel} className="rounded border px-1.5 py-0.5 text-xs">{channelLabel(channel)}</span>) : <span className="text-xs text-muted-foreground">Todos</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {bundle.active ? (
                        <span className={cn(pill, "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200")}>Activo</span>
                      ) : bundle.convertedToPackId ? (
                        <>
                          <span className={cn(pill, "bg-muted text-muted-foreground")}>Convertido en pack</span>
                          <Link href={`/productos/${bundle.convertedToPackId}`} className="block text-xs underline">Ver el pack</Link>
                        </>
                      ) : (
                        <span className={cn(pill, "bg-muted text-muted-foreground")}>Inactivo</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {canManage ? (
                        <div className="flex flex-nowrap justify-end gap-1.5">
                          {bundle.active && canConvert ? <Button size="sm" disabled={busy === bundle.id} onClick={() => setConverting(bundle)}>Convertir en pack</Button> : null}
                          {bundle.active ? <Button size="sm" variant="outline" disabled={busy === bundle.id} onClick={() => setDeactivating(bundle)}>Desactivar</Button> : null}
                          {/* Un bundle convertido no se reactiva: se vende el pack. */}
                          {!bundle.active && !bundle.convertedToPackId ? <Button size="sm" variant="outline" disabled={busy === bundle.id} onClick={() => void setActive(bundle, true)}>Activar</Button> : null}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 ? <tr><td colSpan={6} className="px-3 py-10 text-center text-sm text-muted-foreground">No quedan bundles anteriores.</td></tr> : null}
            </tbody>
          </table>
        </div>
      )}
      {converting ? (
        <PackFormDialog
          pack={null}
          seed={bundleSeed(converting)}
          bundle={{ id: converting.id, name: converting.name, channels: converting.channels }}
          onClose={() => setConverting(null)}
        />
      ) : null}
      <AlertDialog open={!!deactivating} onOpenChange={(open) => !open && !busy && setDeactivating(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar «{deactivating?.name}»?</AlertDialogTitle>
            <AlertDialogDescription>Deja de venderse. No se borra: los pedidos anteriores lo siguen mostrando.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!!busy}
              onClick={(event) => {
                event.preventDefault();
                if (deactivating) void setActive(deactivating, false);
              }}
            >
              Sí, desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
