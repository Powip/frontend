"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatDateTime,
  HEALTH_LABELS,
  isShopifyAuthorizeUrl,
  parseAuthUrlError,
  REAUTH_REASON_LABELS,
  RUN_STATUS_LABELS,
  scopeLabel,
  STOCK_MODE_DESCRIPTIONS,
  STOCK_MODE_LABELS,
} from "@/lib/shopifyStock";
import { goToExternalPage } from "@/lib/browserNavigation";
import {
  requestShopifyAuthUrl,
  type ShopifyShopReauthorization,
  type ShopifyStockMode,
  type ShopifyStockShop,
} from "@/services/shopifyStockService";
import ShopifyStockModeDialog from "./ShopifyStockModeDialog";
import ShopifyStockReportDialog from "./ShopifyStockReportDialog";
import StockCounterGrid from "./StockCounterGrid";
import { useShopifyStockRun } from "./useShopifyStockRun";

// FEAT-24 H1-D (H1D-5) — una tienda de Shopify: modo de stock, re-autorización,
// último reporte y acciones (generar reporte y cambiar modo solo para admins).

const MODE_BADGE: Record<ShopifyStockMode, string> = {
  shopify: "border-slate-300 bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-200",
  reporte: "border-sky-300 bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  powip: "border-teal-300 bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200",
};

interface Props {
  shop: ShopifyStockShop;
  shops: ShopifyStockShop[];
  reauthorization: ShopifyShopReauthorization | undefined;
  storeName: string | null;
  warehouseName: string | null;
  isAdmin: boolean;
  /** Vuelve a pedir las tiendas (y el reporte) después de un cambio o de una corrida. */
  onRefresh: () => void;
}

export default function ShopifyStockShopCard({
  shop,
  shops,
  reauthorization,
  storeName,
  warehouseName,
  isAdmin,
  onRefresh,
}: Props) {
  const [reportOpen, setReportOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
  const run = useShopifyStockRun(shop.id, shop.runningRun?.id ?? null, onRefresh);
  const canRequestReport = shop.stockMode !== "shopify";
  const last = shop.lastRun;
  const reauth = reauthorization?.needsReauthorization === true ? reauthorization : null;
  const missing = reauth?.missingScopes ?? [];
  const [authorizing, setAuthorizing] = useState(false);

  // FEAT-24 SEC: la URL de Shopify se pide con la sesión (POST /shopify/auth-url, solo admin), así el
  // `state` lleva la empresa y el usuario del token. Ya no se abre /shopify/reauth sin sesión.
  const startReauthorization = async () => {
    setAuthorizing(true);
    try {
      const url = await requestShopifyAuthUrl(shop.shopUrl);
      if (isShopifyAuthorizeUrl(url, shop.shopUrl)) {
        goToExternalPage(url);
        return;
      }
      toast.error("No se pudo abrir la autorización de Shopify. Inténtalo de nuevo.");
    } catch (error) {
      toast.error(parseAuthUrlError(error));
    }
    setAuthorizing(false);
  };

  return (
    <article data-testid={`shopify-stock-${shop.id}`} className="space-y-3 rounded-md border p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h4 className="truncate font-medium">{shop.shopUrl}</h4>
          <p className="text-xs text-muted-foreground">
            {storeName ? `Tienda: ${storeName}` : "Sin tienda de Powip"}
            {" · "}
            {warehouseName ? `Almacén: ${warehouseName}` : shop.inventoryId ? "Almacén de Powip asignado" : "Sin almacén de Powip"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!shop.isActive ? <Badge variant="outline">Dada de baja</Badge> : null}
          {shop.isActive && shop.healthStatus !== "ok" ? (
            <Badge variant="destructive">{HEALTH_LABELS[shop.healthStatus] ?? shop.healthStatus}</Badge>
          ) : null}
          <Badge variant="outline" className={MODE_BADGE[shop.stockMode]} title={STOCK_MODE_DESCRIPTIONS[shop.stockMode]}>
            {STOCK_MODE_LABELS[shop.stockMode]}
          </Badge>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{STOCK_MODE_DESCRIPTIONS[shop.stockMode]}</p>

      {reauth ? (
        <div
          role="alert"
          className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
        >
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            Hay que volver a autorizar la app de Powip en Shopify
          </p>
          <ul className="list-disc pl-5">
            {reauth.reasons.map((reason) => (
              <li key={reason}>
                {REAUTH_REASON_LABELS[reason] ?? reason}
                {reason === "faltan_scopes" && missing.length > 0 ? `: ${missing.map(scopeLabel).join(", ")}` : ""}
              </li>
            ))}
          </ul>
          {isAdmin ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {/* Pide la URL con la sesión y recién ahí va a la pantalla de permisos de Shopify. */}
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                disabled={authorizing}
                onClick={() => void startReauthorization()}
              >
                {authorizing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Volver a autorizar en Shopify
              </Button>
              {shop.stockMode === "powip" ? (
                <span className="text-xs">
                  Al volver a autorizar, la tienda pasa a «Solo reporte» hasta revisar un reporte nuevo.
                </span>
              ) : null}
            </div>
          ) : (
            <p className="text-xs">Un administrador de la empresa tiene que volver a autorizarla.</p>
          )}
        </div>
      ) : null}

      {shop.stockPublishError ? (
        <p className="text-sm text-red-700 dark:text-red-400">
          Último error al publicar ({formatDateTime(shop.stockPublishErrorAt)}): {shop.stockPublishError}
        </p>
      ) : null}

      <div className="space-y-2">
        {run.running ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generando el reporte…
          </p>
        ) : null}
        {last ? (
          <>
            <p className="text-sm">
              <span className="font-medium">Último reporte:</span> {formatDateTime(last.finishedAt ?? last.startedAt)}
              {" · "}
              {RUN_STATUS_LABELS[last.status]}
              {last.mode === "powip" ? " · con «Powip manda»" : ""}
            </p>
            {last.error ? <p className="text-sm text-red-700 dark:text-red-400">{last.error}</p> : null}
            {last.status === "ok" || last.status === "error" ? <StockCounterGrid counters={last.counters} compact /> : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Todavía no hay reportes de esta tienda.</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {last ? (
          <Button size="sm" variant="outline" onClick={() => setReportOpen(true)}>
            Ver reporte
          </Button>
        ) : null}
        {isAdmin && canRequestReport ? (
          <Button
            size="sm"
            variant="outline"
            disabled={run.running || run.requesting}
            onClick={() => void run.start()}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${run.running ? "animate-spin" : ""}`} />
            Generar reporte
          </Button>
        ) : null}
        {isAdmin ? (
          <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => setModeOpen(true)}>
            Cambiar modo
          </Button>
        ) : null}
        {isAdmin && !canRequestReport ? (
          <span className="text-xs text-muted-foreground">Para generar un reporte, pasa la tienda a «Solo reporte».</span>
        ) : null}
      </div>

      <ShopifyStockReportDialog shopId={shop.id} shopUrl={shop.shopUrl} open={reportOpen} onOpenChange={setReportOpen} />
      {isAdmin ? (
        <ShopifyStockModeDialog shop={shop} shops={shops} open={modeOpen} onOpenChange={setModeOpen} onChanged={onRefresh} />
      ) : null}
    </article>
  );
}
