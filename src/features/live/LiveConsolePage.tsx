"use client";
import { isLiveReadDenied } from "./liveService";
import { toWhatsAppDigits } from "@/lib/phone";
import { createLivePolling, type LivePollingController } from "./livePolling";
import { liveAdminError } from "./liveService";
import LiveAdvisors from "./LiveAdvisors";
import { liveLinks } from "./liveLinks";
import LiveProductsTable from "./LiveProductsTable";

import {
  ExternalLink,
  Link2,
  Loader2,
  Pin,
  Play,
  Plus,
  QrCode,
  Radio,
  RefreshCw,
  Square,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import LiveReadinessPanel, {
  getLiveOpeningStatus,
  type LiveConfigTarget,
} from "./LiveReadinessPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import LiveAddProductsDialog from "./LiveAddProductsDialog";
import LiveConfigPanel from "./LiveConfigPanel";
import LiveCopyButton from "./LiveCopyButton";
import LivePaymentSettings from "./LivePaymentSettings";
import LiveReservationsPanel from "./LiveReservationsPanel";
import {
  LiveEmpty,
  LiveErrorBanner,
  LiveFieldError,
  LivePanel,
  LiveProductImage,
  LiveReservationTimer,
} from "./LiveShared";
import { type LiveProductGroup, groupLiveProducts, isActiveReservation } from "./liveGroups";
// FEAT-32 M7: las hasta 3 fotos del live se eligen de la galería del producto (ms-products).
import LiveProductPhotos, { type LivePhotosChange } from "./LiveProductPhotos";
import { saveLivePhotos, type LivePhotoInput } from "@/services/productContentService";
import {
  addLiveTrustedCustomer,
  createLivePaymentLink,
  getLiveConsole,
  LIVE_PAYMENTS_HREF,
  liveError,
  liveMoney,
  platformNames,
  releaseLiveReservation,
  removeLiveTrustedCustomer,
  saveLiveTrustedCustomer,
  removeLiveLogo,
  updateLiveConfig,
  updateLiveProducts,
  uploadLiveLogo,
  updateLiveSession,
} from "./liveService";
import type {
  LiveConsoleData,
  LivePlatform,
  LiveReservation,
  LiveReviewConsoleData,
  LiveSession,
} from "./types";

// FEAT-33 B1: sin «Pagos por revisar»; los comprobantes se validan en Finanzas › Pagos por validar.
type Tab = "console" | "reservations" | "products" | "config";
const tabLabels: Record<Tab, string> = {
  console: "Consola en vivo",
  reservations: "Apartados",
  products: "Productos del live",
  config: "Configuración",
};

export default function LiveConsolePage() {
  const session = useAuth();
  const scope = `${session.auth?.company?.id}:${session.auth?.user.id}:${session.auth?.user.role}:${session.selectedStoreId}`;
  return <ScopedLiveConsolePage key={scope} session={session} scope={scope} />;
}

function ScopedLiveConsolePage({
  session,
  scope,
}: {
  session: ReturnType<typeof useAuth>;
  scope: string;
}) {
  const { auth, selectedStoreId, setSelectedStore } = session;
  const router = useRouter();
  const search = useSearchParams();
  const rawTab = search.get("tab");
  const requestedTab: Tab = rawTab && rawTab in tabLabels ? (rawTab as Tab) : "console";
  const [fullSnapshot, setFullSnapshot] = useState<{
    scope: string;
    value: LiveConsoleData;
  } | null>(null);
  const [reviewSnapshot, setReviewSnapshot] = useState<{
    scope: string;
    value: LiveReviewConsoleData;
  } | null>(null);
  const data = fullSnapshot?.scope === scope ? fullSnapshot.value : null;
  const reviewData = reviewSnapshot?.scope === scope ? reviewSnapshot.value : null;
  const tab: Tab = requestedTab;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [editing, setEditing] = useState<LiveProductGroup | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [configTarget, setConfigTarget] = useState<LiveConfigTarget | null>(null);
  const [releasing, setReleasing] = useState<LiveReservation[]>([]);
  const [paymentLink, setPaymentLink] = useState<{
    url: string;
    name: string;
    phone: string;
  } | null>(null);
  const [origin, setOrigin] = useState("");
  const generation = useRef(0);
  const mutationLock = useRef<number | null>(null);
  const polling = useRef<LivePollingController | null>(null);
  const pollingScope = useRef<string | null>(null);
  const overlayPaused = Boolean(editing || catalogOpen || releasing.length || paymentLink);
  const overlayPausedRef = useRef(overlayPaused);
  overlayPausedRef.current = overlayPaused;
  const canManage = data?.capabilities.manage === true;
  const canOperate = data?.capabilities.operate === true;
  const canReviewPayments = (data ?? reviewData)?.capabilities.reviewPayments === true;
  useEffect(() => {
    if (tab !== "config" || !data || !configTarget) return;
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(
        configTarget === "purchases" ? "live-enabled" : `live-${configTarget}-settings`,
      );
      if (!target) return;
      target.scrollIntoView?.({ behavior: "smooth", block: "center" });
      target.focus({ preventScroll: true });
      setConfigTarget(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [tab, data, configTarget]);
  const callbackStoreId = search.get("storeId");
  useEffect(() => {
    if (
      callbackStoreId &&
      callbackStoreId !== selectedStoreId &&
      auth?.company?.stores?.some((store) => store.id === callbackStoreId)
    )
      setSelectedStore(callbackStoreId);
  }, [callbackStoreId, selectedStoreId, auth?.company?.stores, setSelectedStore]);
  const storeId = selectedStoreId;
  const slug = data?.config.slug;
  // FEAT-33 A12: todos los links del live salen de liveLinks (un solo formato).
  const links = liveLinks({ origin: storeId ? origin : "", slug, storeId });
  const publicUrl = links.publicUrl;

  const refresh = useCallback(
    (quiet = false) =>
      polling.current?.refresh({ quiet, supersede: true }) ?? Promise.resolve(false),
    [],
  );
  useEffect(() => {
    generation.current += 1;
    mutationLock.current = null;
    setBusy("");
    setFullSnapshot(null);
    setReviewSnapshot(null);
    setError("");
    setEditing(null);
    setCatalogOpen(false);
    setReleasing([]);
    setPaymentLink(null);
    setOrigin(window.location.origin);
    if (!storeId) {
      setLoading(false);
      return;
    }
    let hasSnapshot = false;
    let interval = 8000;
    const reader = createLivePolling<LiveConsoleData | LiveReviewConsoleData>({
      load: (signal) => getLiveConsole(storeId, signal),
      intervalMs: () => interval,
      onData: (result) => {
        hasSnapshot = true;
        if ("config" in result && result.capabilities.readConsole !== false) {
          interval = result.session?.status === "LIVE" ? 8000 : 15000;
          setFullSnapshot({ scope, value: result });
          setReviewSnapshot(null);
        } else {
          interval = 15000;
          setFullSnapshot(null);
          setReviewSnapshot({ scope, value: result as LiveReviewConsoleData });
          setEditing(null);
          setCatalogOpen(false);
          setReleasing([]);
          setPaymentLink(null);
        }
        setError("");
      },
      onError: (cause) => {
        if (isLiveReadDenied(cause)) {
          hasSnapshot = false;
          setFullSnapshot(null);
          setReviewSnapshot(null);
          setEditing(null);
          setCatalogOpen(false);
          setReleasing([]);
          setPaymentLink(null);
        }
        setError(liveError(cause));
      },
      onLoading: (pending, quiet) => {
        if (!quiet || !pending || !hasSnapshot) setLoading(pending);
      },
    });
    polling.current = reader;
    pollingScope.current = scope;
    void reader.refresh({ quiet: false });
    return () => {
      generation.current += 1;
      reader.dispose();
      if (polling.current === reader) {
        polling.current = null;
        pollingScope.current = null;
      }
    };
  }, [storeId, scope]);
  useEffect(() => {
    if (pollingScope.current === scope) polling.current?.setPaused(Boolean(busy) || overlayPaused);
  }, [busy, overlayPaused, scope]);

  async function run(key: string, operation: () => Promise<unknown>, success?: string) {
    const current = generation.current;
    if (mutationLock.current === current) return false;
    mutationLock.current = current;
    const reader = polling.current;
    reader?.setPaused(true);
    setBusy(key);
    let reconciled = false;
    try {
      await operation();
      if (generation.current !== current) return false;
      if (success) toast.success(success);
      reconciled = await refresh(true);
      return generation.current === current;
    } catch (cause) {
      if (generation.current === current) toast.error(liveAdminError(cause));
      return false;
    } finally {
      if (mutationLock.current === current) mutationLock.current = null;
      if (generation.current === current) {
        setBusy("");
        reader?.setPaused(overlayPausedRef.current, { refreshOnResume: !reconciled });
      }
    }
  }
  async function downloadQr() {
    try {
      const QRCode = await import("qrcode");
      const url = await QRCode.toDataURL(publicUrl, { width: 1024, margin: 2 });
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "powip-live-qr.png";
      anchor.click();
    } catch {
      toast.error("No se pudo generar el QR.");
    }
  }
  const updateSession = (input: Partial<LiveSession>) =>
    storeId
      ? run("session", () => updateLiveSession(storeId, input), "Live actualizado")
      : Promise.resolve();
  const active = data?.reservations.filter(isActiveReservation) ?? [];
  const pinned = data?.products.find((item) => item.variantId === data.session?.pinnedVariantId);
  const transmitting = data?.session?.status === "LIVE";
  const readyToOpen = data?.readiness?.ready === true && data.config.enabled;
  const closed = !data?.config.enabled || !data.session || data.session.status === "CLOSED";
  const showOpeningStatus = !transmitting && (closed || !readyToOpen);
  const openingStatus = getLiveOpeningStatus({
    readiness: data?.readiness,
    purchasesEnabled: data?.config.enabled === true,
    canManage: canOperate,
    busy: !!busy,
  });
  function navigateToTab(value: Tab) {
    router.replace(`/live?tab=${value}`, { scroll: false });
  }
  function navigateToConfig(target: LiveConfigTarget = "purchases") {
    setConfigTarget(target);
    navigateToTab("config");
  }
  function navigateToPendingConfig() {
    const missing = data?.readiness?.checks.find(
      (check) => !check.ready && (check.code === "YAPE" || check.code === "SHIPPING"),
    );
    navigateToConfig(
      missing?.code === "YAPE" ? "yape" : missing?.code === "SHIPPING" ? "shipping" : "purchases",
    );
  }
  const pinText = `Compra aquí lo que ves en el live y paga con Yape: ${publicUrl}`;

  return (
    <main className="mx-auto w-full max-w-[1440px] space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-teal-700">
            <Radio className="h-4 w-4" />
            POWIP Live
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{reviewData ? "Pagos de POWIP Live" : tabLabels[tab]}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {reviewData
              ? "Revisa los comprobantes Yape del negocio y confirma cada ingreso antes de validarlo."
              : "Tu audiencia mira el live en su red social y compra en tu catálogo."}
          </p>
        </div>
        <div className="flex items-end gap-2">
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Tienda
            <select
              aria-label="Tienda del live"
              value={storeId ?? ""}
              onChange={(event) => setSelectedStore(event.target.value)}
              className="h-10 min-w-40 rounded-lg border bg-background px-3 text-sm text-foreground"
            >
              <option value="" disabled>
                Selecciona una tienda
              </option>
              {(auth?.company?.stores ?? []).map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="outline"
            size="icon"
            aria-label="Actualizar live"
            disabled={loading || !storeId}
            onClick={() => void refresh()}
          >
            <RefreshCw className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </header>
      {error ? <LiveErrorBanner message={error} onRetry={() => void refresh()} /> : null}
      {!storeId ? (
        <LiveEmpty>Selecciona una tienda para configurar su catálogo del live.</LiveEmpty>
      ) : loading && !data && !reviewData ? (
        <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando live…
        </div>
      ) : reviewData ? (
        canReviewPayments ? (
          <LivePanel
            title="Se validan en Finanzas"
            description="Los pagos de POWIP Live se validan en Finanzas › Pagos por validar, junto con los del resto del negocio."
          >
            <Button asChild>
              <Link href={LIVE_PAYMENTS_HREF}>Ir a Pagos por validar →</Link>
            </Button>
          </LivePanel>
        ) : (
          <LiveEmpty>
            Para validar pagos necesitas el rol Administrador o el permiso de Finanzas de tu
            negocio.
          </LiveEmpty>
        )
      ) : data ? (
        <>
          {!data.paymentMethods?.length ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <b>Configura cómo cobrar.</b> Conecta Mercado Pago o configura el Yape del negocio.
              Los pedidos se confirman después de validar el pago.
            </div>
          ) : null}
          {!canManage ? (
            <p className="rounded-xl border bg-muted/50 p-3 text-sm text-muted-foreground">
              La configuración, los productos y los clientes de confianza requieren permiso para
              gestionar Live.
            </p>
          ) : null}
          {data.paymentIssues?.length ? (
            <LivePanel
              title="Revisión de pagos"
              description="Estos pagos necesitan seguimiento antes de dar el caso por cerrado."
            >
              <div className="space-y-3">
                {data.paymentIssues.map((issue) => (
                  <article
                    key={issue.checkoutId}
                    className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">
                        {issue.orderNumber ?? "Checkout del live"} ·{" "}
                        {issue.customer?.name ?? "Cliente"}
                      </p>
                      <span className="font-semibold">{liveMoney(issue.total)}</span>
                    </div>
                    <p className="mt-1">{issue.message}</p>
                    {issue.refundStatus ? (
                      <p className="mt-1 text-xs">Estado de devolución: {issue.refundStatus}</p>
                    ) : null}
                  </article>
                ))}
              </div>
            </LivePanel>
          ) : null}
          <Tabs
            value={tab}
            onValueChange={(value) => router.replace(`/live?tab=${value}`, { scroll: false })}
            className="space-y-5"
          >
            <TabsList className="h-auto max-w-full flex-wrap justify-start gap-1 bg-muted/70 p-1">
              {(Object.entries(tabLabels) as [Tab, string][])
                .map(([value, label]) => (
                  <TabsTrigger key={value} value={value} className="px-4 py-2">
                    {label}
                    {value === "reservations" && active.length > 0 ? (
                      <span className="rounded-full bg-red-100 px-1.5 text-xs text-red-700">
                        {active.length}
                      </span>
                    ) : null}
                  </TabsTrigger>
                ))}
            </TabsList>
            <TabsContent value="console" className="space-y-5">
              <LiveReadinessPanel
                readiness={data.readiness}
                purchasesEnabled={data.config.enabled}
                canManage={canManage}
                busy={!!busy}
                onConfigure={navigateToConfig}
                onProducts={() => navigateToTab("products")}
              />
              <LiveAdvisors
                config={data.config}
                disabled={!canManage || !!busy}
                links={links}
                onSave={(config) =>
                  void run("config", () => updateLiveConfig(storeId, config), "Asesora guardada")
                }
              />
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
                <div className="flex items-center gap-3">
                  <span
                    className={`h-3 w-3 rounded-full ${transmitting ? "bg-red-500" : "bg-slate-300"}`}
                  />
                  <div>
                    <p className="font-semibold">
                      {transmitting
                        ? `En vivo en ${platformNames[data.session?.platform ?? "TIKTOK"]}`
                        : closed
                          ? "Catálogo cerrado"
                          : "Live terminado · catálogo abierto"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {data.session?.closesAt
                        ? `Cierre: ${new Date(data.session.closesAt).toLocaleString("es-PE")}`
                        : "El video sigue en tu red social"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={!canOperate || !!busy || (!transmitting && !readyToOpen)}
                    aria-describedby={showOpeningStatus ? "live-opening-status" : undefined}
                    variant={transmitting ? "outline" : "default"}
                    onClick={() =>
                      void updateSession({
                        status: transmitting ? "ENDED" : "LIVE",
                      })
                    }
                  >
                    {transmitting ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {transmitting ? "Terminar live" : "Estoy en vivo"}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!canOperate || !!busy || (closed && !readyToOpen)}
                    aria-describedby={
                      showOpeningStatus && closed ? "live-opening-status" : undefined
                    }
                    onClick={() =>
                      void updateSession({
                        status: closed ? "ENDED" : "CLOSED",
                      })
                    }
                  >
                    {closed ? "Abrir catálogo" : "Cerrar catálogo"}
                  </Button>
                  <Button asChild variant="outline">
                    <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                      Ver catálogo
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
                {showOpeningStatus ? (
                  <div className="flex basis-full flex-wrap items-center justify-between gap-3 border-t pt-3">
                    <p id="live-opening-status" className="text-sm text-muted-foreground">
                      {openingStatus.message}
                    </p>
                    {openingStatus.actions.length ? (
                      <div className="flex flex-wrap gap-2">
                        {openingStatus.actions.map((action) => (
                          <Button
                            key={action}
                            size="sm"
                            variant="outline"
                            disabled={!!busy}
                            onClick={() =>
                              action === "config"
                                ? navigateToPendingConfig()
                                : navigateToTab("products")
                            }
                          >
                            {action === "config" ? "Ir a Configuración" : "Ir a Productos"}
                          </Button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    label: "Ventas validadas",
                    value: liveMoney(data.metrics.totalSales),
                    note: `${data.metrics.orderCount} ${data.metrics.orderCount === 1 ? "pedido" : "pedidos"} con pago confirmado`,
                    // FEAT-33 A11: verde agua = bien, ámbar = atención.
                    color: "text-teal-700",
                    action: null,
                  },
                  {
                    label: "Por validar",
                    value: liveMoney(data.metrics.pendingSales || 0),
                    note: `${data.metrics.pendingPaymentCount || 0} ${(data.metrics.pendingPaymentCount || 0) === 1 ? "comprobante" : "comprobantes"} Yape`,
                    color: "text-amber-700",
                    action: canReviewPayments
                      ? { label: "validar en Finanzas →", href: LIVE_PAYMENTS_HREF }
                      : null,
                  },
                  {
                    label: "Apartados por pagar",
                    value: data.metrics.activeReservations.toString(),
                    note: "Stock reservado",
                    color: "text-foreground",
                    action: { label: "Ver apartados", onClick: () => navigateToTab("reservations") },
                  },
                  {
                    label: "Visitas al catálogo",
                    value: data.metrics.visits.toLocaleString("es-PE"),
                    note: "Audiencia que abrió el link",
                    color: "text-teal-700",
                    action: null,
                  },
                ].map((metric) => (
                  <LivePanel key={metric.label}>
                    <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
                    <p className={`mt-2 text-2xl font-bold tabular-nums ${metric.color}`}>
                      {metric.value}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {metric.note}
                      {metric.action ? (
                        <>
                          {" · "}
                          {metric.action.href ? (
                            <Link
                              href={metric.action.href}
                              className="font-semibold text-teal-700 hover:underline"
                            >
                              {metric.action.label}
                            </Link>
                          ) : (
                            <button
                              type="button"
                              onClick={metric.action.onClick}
                              className="font-semibold text-teal-700 hover:underline"
                            >
                              {metric.action.label}
                            </button>
                          )}
                        </>
                      ) : null}
                    </p>
                  </LivePanel>
                ))}
              </div>
              <div className="grid items-start gap-5 lg:grid-cols-2">
                <LivePanel
                  title="Lleva a tu audiencia al catálogo"
                  description="Pon tu link en la bio o en el comentario fijado durante el live."
                >
                  <p className="mb-2 text-sm font-medium">¿Dónde transmites?</p>
                  <div className="mb-4 flex flex-wrap gap-2">
                    {Object.entries(platformNames).map(([value, label]) => (
                      <Button
                        size="sm"
                        key={value}
                        variant={data.session?.platform === value ? "default" : "outline"}
                        disabled={!canOperate || !!busy}
                        onClick={() =>
                          void updateSession({
                            platform: value as LivePlatform,
                          })
                        }
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/30 p-3">
                    <Link2 className="h-4 w-4 shrink-0 text-teal-600" aria-hidden="true" />
                    <span className="min-w-0 flex-1 break-all text-sm">{publicUrl}</span>
                    <LiveCopyButton text={publicUrl} label="Copiar link" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => void downloadQr()}>
                      <QrCode className="h-4 w-4" />
                      Descargar QR
                    </Button>
                    <LiveCopyButton text={pinText} label="Copiar comentario" />
                  </div>
                  <p className="mt-3 rounded-xl bg-teal-50 p-3 text-xs leading-relaxed text-teal-900">
                    {pinText}
                  </p>
                </LivePanel>
                <LivePanel
                  title="Producto que muestras ahora"
                  description="El producto fijado aparece primero en el catálogo."
                >
                  {data.products.filter((item) => item.enabled).length ? (
                    <div className="max-h-[400px] divide-y overflow-y-auto">
                      {data.products
                        .filter(
                          (item, index, all) =>
                            item.enabled &&
                            all.findIndex(
                              (p) =>
                                p.enabled &&
                                (p.productId || p.variantId) === (item.productId || item.variantId),
                            ) === index,
                        )
                        .map((item) => (
                          <div
                            key={item.variantId}
                            className="flex items-center gap-3 py-3 first:pt-0"
                          >
                            <LiveProductImage product={item} className="h-12 w-12" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold">{item.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.variantLabel || item.sku} · {liveMoney(item.livePrice)} ·{" "}
                                {item.availableStock} disponibles
                              </p>
                            </div>
                            {(item.productId || item.variantId) ===
                            (pinned?.productId || pinned?.variantId) ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700">
                                <Pin className="h-3 w-3" />
                                En pantalla
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!canOperate || !!busy || item.availableStock <= 0}
                                onClick={() =>
                                  void updateSession({
                                    pinnedVariantId: item.variantId,
                                  })
                                }
                              >
                                Mostrar
                              </Button>
                            )}
                          </div>
                        ))}
                    </div>
                  ) : (
                    <LiveEmpty>Agrega productos para empezar a vender en el live.</LiveEmpty>
                  )}
                </LivePanel>
              </div>
              <LivePanel
                title="Apartados activos"
                description="El stock vuelve a estar disponible cuando se libera o vence una reserva."
              >
                {active.length ? (
                  <div className="divide-y">
                    {active.slice(0, 6).map((reservation) => (
                      <div key={reservation.id} className="flex items-center gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">{reservation.customer.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {reservation.quantity} ×{" "}
                            {reservation.productName ||
                              reservation.name ||
                              data.products.find((item) => item.variantId === reservation.variantId)
                                ?.name ||
                              "Producto"}
                          </p>
                        </div>
                        <LiveReservationTimer
                          reservation={reservation}
                          serverNow={data.serverNow}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <LiveEmpty>Todavía no hay apartados activos.</LiveEmpty>
                )}
              </LivePanel>
            </TabsContent>
            <TabsContent value="reservations">
              <LiveReservationsPanel
                data={data}
                canManage={canManage}
                canOperate={canOperate}
                busy={!!busy}
                onRelease={setReleasing}
                onTrust={(id, remove) => {
                  if (storeId)
                    void run(
                      "trust",
                      () =>
                        remove
                          ? removeLiveTrustedCustomer(storeId, id)
                          : saveLiveTrustedCustomer(storeId, id),
                      remove ? "Cliente de confianza retirado" : "Cliente de confianza habilitado",
                    );
                }}
                onTrustPhone={(input) =>
                  storeId
                    ? run(
                        "trust",
                        () => addLiveTrustedCustomer(storeId, input),
                        "Cliente de confianza agregado",
                      )
                    : Promise.resolve(false)
                }
                onPaymentLink={(reservation) => {
                  if (storeId)
                    void run("link", async () => {
                      const result = await createLivePaymentLink(storeId, reservation.id);
                      setPaymentLink({
                        url: result.url,
                        name: reservation.customer.name,
                        phone: reservation.customer.phone,
                      });
                    });
                }}
              />
            </TabsContent>
            <TabsContent value="products">
              <LivePanel
                title="Productos del live"
                description="Agrupados por producto. El precio live solo aplica mientras el catálogo del live está abierto."
                aside={
                  <Button disabled={!canManage || !!busy} onClick={() => setCatalogOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Agregar producto
                  </Button>
                }
              >
                {data.products.length ? (
                  <LiveProductsTable
                    products={data.products}
                    hideSoldOut={data.config.hideSoldOut === true}
                    disabled={!canManage || !!busy}
                    onEdit={setEditing}
                    onPublish={(variantIds, enabled) =>
                      void run(
                        "product",
                        () => updateLiveProducts(storeId, { variantIds, enabled }),
                        enabled ? "Producto publicado" : "Producto retirado",
                      )
                    }
                  />
                ) : (
                  <LiveEmpty>
                    No hay productos en el live. Pulsa «Agregar producto» y elige sus colores y tallas.
                  </LiveEmpty>
                )}
              </LivePanel>
            </TabsContent>
            <TabsContent value="config" className="space-y-5">
              <LiveReadinessPanel
                readiness={data.readiness}
                purchasesEnabled={data.config.enabled}
                canManage={canManage}
                busy={!!busy}
                onConfigure={navigateToConfig}
                onProducts={() => navigateToTab("products")}
              />
              <LivePaymentSettings
                key={`yape/${storeId}`}
                storeId={storeId}
                canManage={canManage}
                onSaved={() => void refresh(true)}
              />
              <LiveConfigPanel
                key={`config/${storeId}`}
                config={data.config}
                readiness={data.readiness}
                onConsole={() => navigateToTab("console")}
                canManage={canManage}
                busy={!!busy}
                storeName={data.store?.name}
                onSave={(changes) =>
                  run("config", () => updateLiveConfig(storeId, changes), "✓ Configuración guardada")
                }
                onLogo={(file) =>
                  run(
                    "config",
                    () => (file ? uploadLiveLogo(storeId, file) : removeLiveLogo(storeId)),
                    file ? "✓ Logo guardado" : "Logo quitado",
                  )
                }
              />
            </TabsContent>
          </Tabs>
        </>
      ) : null}
      {editing ? (
        <ProductGroupDialog
          group={editing}
          storeId={storeId}
          busy={!!busy}
          onClose={() => setEditing(null)}
          onSave={(input, photos) => {
            if (storeId)
              void run(
                "product",
                async () => {
                  // FEAT-32 M7: primero las fotos (si cambiaron) y después el precio live y el máximo.
                  const productId = editing.variants[0]?.productId;
                  if (photos && productId) await saveLivePhotos(productId, { storeId, photos });
                  await updateLiveProducts(storeId, {
                    variantIds: editing.variants.map((item) => item.variantId),
                    ...input,
                  });
                  setEditing(null);
                },
                "Producto guardado",
              );
          }}
        />
      ) : null}
      {catalogOpen && storeId ? (
        <LiveAddProductsDialog
          storeId={storeId}
          onClose={() => setCatalogOpen(false)}
          onAdded={() => {
            setCatalogOpen(false);
            void refresh(true);
          }}
          onEdit={(key) => {
            setCatalogOpen(false);
            const group = groupLiveProducts(data?.products ?? []).find((item) => item.key === key);
            if (group) setEditing(group);
          }}
        />
      ) : null}
      <Dialog
        open={releasing.length > 0}
        onOpenChange={(open) => {
          if (!open && !busy) setReleasing([]);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Liberar apartado</DialogTitle>
            <DialogDescription>
              Se devolverán {releasing.reduce((sum, item) => sum + item.quantity, 0)} unidades al
              stock disponible. El cliente ya no podrá pagar estos apartados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={!!busy} onClick={() => setReleasing([])}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={!!busy}
              onClick={() => {
                if (storeId)
                  void run(
                    "release",
                    async () => {
                      for (const reservation of releasing)
                        await releaseLiveReservation(storeId, reservation.id);
                      setReleasing([]);
                    },
                    "Stock liberado",
                  );
              }}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Liberar stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!paymentLink}
        onOpenChange={(open) => {
          if (!open) setPaymentLink(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link de pago de {paymentLink?.name}</DialogTitle>
            <DialogDescription>
              Comparte este enlace privado solo con este cliente. Permite acceder a sus apartados y
              pagarlos.
            </DialogDescription>
          </DialogHeader>
          <Input value={paymentLink?.url ?? ""} readOnly aria-label="Enlace privado de pago" />
          <DialogFooter>
            <LiveCopyButton text={paymentLink?.url ?? ""} label="Copiar enlace" size="default" />
            <Button asChild>
              <a
                href={`https://wa.me/${toWhatsAppDigits(paymentLink?.phone)}?text=${encodeURIComponent(`Hola ${paymentLink?.name}, paga tus apartados aquí: ${paymentLink?.url}`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Compartir por WhatsApp
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

/** FEAT-33: un precio live y un máximo por cliente para todas las variantes del producto. */
function ProductGroupDialog({
  group,
  storeId,
  busy,
  onClose,
  onSave,
}: {
  group: LiveProductGroup;
  storeId: string | null;
  busy: boolean;
  onClose: () => void;
  /** `photos` null = las fotos del live no cambiaron (FEAT-32 M7). */
  onSave: (
    input: { livePrice: number; maxPerCustomer: number | null },
    photos: LivePhotoInput[] | null,
  ) => void;
}) {
  const productId = group.variants[0]?.productId;
  const maxes = [...new Set(group.variants.map((item) => item.maxPerCustomer ?? null))];
  const [price, setPrice] = useState(
    String(group.variants[0]?.livePrice || group.regularPrice || ""),
  );
  const [max, setMax] = useState(maxes.length === 1 && maxes[0] ? String(maxes[0]) : "");
  const [errors, setErrors] = useState<{ price?: string; max?: string }>({});
  const [photos, setPhotos] = useState<LivePhotosChange>({ photos: null, uploading: false });
  function submit() {
    const found: typeof errors = {};
    if (!/^\d+(?:\.\d{1,2})?$/.test(price.trim()) || Number(price) <= 0)
      found.price = "Escribe un precio live mayor a 0.";
    if (max.trim() && (!/^\d+$/.test(max.trim()) || Number(max) < 1 || Number(max) > 10000))
      found.max = "Entre 1 y 10000, o vacío para sin límite.";
    setErrors(found);
    if (Object.keys(found).length || photos.uploading) return;
    onSave({ livePrice: Number(price), maxPerCustomer: max.trim() ? Number(max) : null }, photos.photos);
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy && !photos.uploading) onClose();
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{group.name}</DialogTitle>
          <DialogDescription>
            {group.variants.length} {group.variants.length === 1 ? "variante" : "variantes"} ·{" "}
            {group.totalStock} disponibles · Tienda {liveMoney(group.regularPrice)}
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="space-y-4"
        >
          {productId && storeId ? (
            <LiveProductPhotos
              productId={productId}
              storeId={storeId}
              disabled={busy}
              onChange={setPhotos}
            />
          ) : null}
          <div className="grid gap-2 text-sm font-medium">
            <label htmlFor="live-product-price">Precio live (S/)</label>
            <Input
              id="live-product-price"
              inputMode="decimal"
              value={price}
              aria-invalid={errors.price ? true : undefined}
              aria-describedby={errors.price ? "live-product-price-error" : undefined}
              onChange={(event) => setPrice(event.target.value)}
            />
            <LiveFieldError id="live-product-price-error" message={errors.price} />
          </div>
          <div className="grid gap-2 text-sm font-medium">
            <label htmlFor="live-product-max">Máximo por cliente</label>
            <Input
              id="live-product-max"
              inputMode="numeric"
              value={max}
              placeholder={maxes.length > 1 ? "Varía por variante" : "Sin límite"}
              aria-invalid={errors.max ? true : undefined}
              aria-describedby={
                errors.max
                  ? "live-product-max-error live-product-max-help"
                  : "live-product-max-help"
              }
              onChange={(event) => setMax(event.target.value)}
            />
            <LiveFieldError id="live-product-max-error" message={errors.max} />
            <span id="live-product-max-help" className="text-xs font-normal text-muted-foreground">
              Se aplica a todas las variantes. Cuenta compras y apartados del mismo live.
            </span>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy || photos.uploading}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Guardar producto
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
