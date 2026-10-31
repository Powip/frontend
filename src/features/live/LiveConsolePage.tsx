"use client";
import { isLiveReadDenied } from "./liveService";
import { createLivePolling, type LivePollingController } from "./livePolling";
import { liveAdminError } from "./liveService";
import LiveAdvisors from "./LiveAdvisors";
import LiveProductsTable from "./LiveProductsTable";

import {
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  Pin,
  Play,
  Plus,
  QrCode,
  Radio,
  RefreshCw,
  Settings2,
  Square,
  Star,
  Trash2,
} from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import LiveReadinessPanel, {
  getLiveOpeningStatus,
  type LiveConfigTarget,
} from "./LiveReadinessPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import LivePaymentSettings from "./LivePaymentSettings";
import {
  LiveEmpty,
  LiveErrorBanner,
  LivePanel,
  LiveProductImage,
  LiveReservationTimer,
} from "./LiveShared";
import LiveYapeReviews from "./LiveYapeReviews";
import {
  createLivePaymentLink,
  getLiveCatalog,
  getLiveConsole,
  liveError,
  liveMoney,
  platformNames,
  releaseLiveReservation,
  removeLiveTrustedCustomer,
  safeLiveUrl,
  saveLiveTrustedCustomer,
  updateLiveConfig,
  updateLiveProduct,
  updateLiveSession,
} from "./liveService";
import type {
  LiveConfig,
  LiveReadiness,
  LiveConsoleData,
  LivePlatform,
  LiveProduct,
  LiveReservation,
  LiveReviewConsoleData,
  LiveSession,
} from "./types";

type Tab = "console" | "reservations" | "products" | "config" | "payments";
const tabLabels: Record<Tab, string> = {
  console: "Consola en vivo",
  reservations: "Apartados",
  products: "Productos del live",
  config: "Configuración",
  payments: "Pagos por revisar",
};
const activeReservation = (reservation: LiveReservation) =>
  ["PENDING", "ACTIVE", "RELEASING"].includes(reservation.status);
const statusLabels = {
  ACTIVE: "Apartado",
  PENDING: "Procesando",
  PAID: "Pagado",
  RELEASED: "Liberado",
  EXPIRED: "Vencido",
  RELEASING: "Liberando",
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
  const tab: Tab = reviewData ? "payments" : requestedTab;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [product, setProduct] = useState<LiveProduct | null>(null);
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
  const overlayPaused = Boolean(product || catalogOpen || releasing.length || paymentLink);
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
  useEffect(() => {
    if (reviewData && rawTab !== "payments")
      router.replace("/live?tab=payments", { scroll: false });
  }, [reviewData, rawTab, router]);
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
  const publicUrl =
    storeId && origin
      ? slug
        ? origin.endsWith(".powip.lat") || origin === "https://powip.lat"
          ? `https://${slug}.powip.lat/live`
          : `${origin}/live/${slug}`
        : `${origin}/live/${encodeURIComponent(storeId)}`
      : "";
  const catalogUrl = publicUrl.includes(".powip.lat/live")
    ? publicUrl.replace(/\/live$/, "/catalogo")
    : publicUrl.replace("/live/", "/catalogo/");

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
    setProduct(null);
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
          setProduct(null);
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
          setProduct(null);
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
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copiado al portapapeles");
    } catch {
      toast.error("No se pudo copiar. Selecciona el enlace y cópialo manualmente.");
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
  const active = data?.reservations.filter(activeReservation) ?? [];
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
          <h1 className="text-2xl font-bold tracking-tight">{tabLabels[tab]}</h1>
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
        <Tabs value="payments">
          <TabsList>
            <TabsTrigger value="payments">Pagos por revisar</TabsTrigger>
          </TabsList>
          <TabsContent value="payments">
            <LiveYapeReviews
              key={`${auth?.company?.id}:${storeId}`}
              storeId={storeId}
              canReview={canReviewPayments}
            />
          </TabsContent>
        </Tabs>
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
                .filter(([value]) => value !== "payments" || canReviewPayments)
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
                catalogUrl={catalogUrl}
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
                    note: `${data.metrics.orderCount} pedidos`,
                    color: "text-rose-600",
                  },
                  {
                    label: "Por validar",
                    value: liveMoney(data.metrics.pendingSales || 0),
                    note: `${data.metrics.pendingPaymentCount || 0} pagos pendientes`,
                    color: "text-emerald-600",
                  },
                  {
                    label: "Apartados por pagar",
                    value: data.metrics.activeReservations.toString(),
                    note: "Stock reservado",
                    color: "text-amber-600",
                  },
                  {
                    label: "Visitas al catálogo",
                    value: data.metrics.visits.toLocaleString("es-PE"),
                    note: "Audiencia que abrió el link",
                    color: "text-teal-600",
                  },
                ].map((metric) => (
                  <LivePanel key={metric.label}>
                    <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
                    <p className={`mt-2 text-2xl font-bold tabular-nums ${metric.color}`}>
                      {metric.value}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{metric.note}</p>
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
                  <div className="flex items-center gap-2 rounded-xl border bg-muted/30 p-3">
                    <Link2 className="h-4 w-4 shrink-0 text-teal-600" />
                    <input
                      readOnly
                      value={publicUrl}
                      aria-label="Enlace del catálogo del live"
                      className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Copiar enlace del live"
                      onClick={() => void copy(publicUrl)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => void downloadQr()}>
                      <QrCode className="h-4 w-4" />
                      Descargar QR
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void copy(pinText)}>
                      <Copy className="h-4 w-4" />
                      Copiar comentario
                    </Button>
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
              <ReservationsPanel
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
                description="El precio live solo se aplica mientras el catálogo del live está abierto."
              >
                <div className="mb-4 flex justify-end">
                  <Button disabled={!canManage || !!busy} onClick={() => setCatalogOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Agregar producto
                  </Button>
                </div>
                {data.products.length ? (
                  <LiveProductsTable
                    products={data.products}
                    disabled={!canManage || !!busy}
                    onEdit={setProduct}
                    onPublish={(item, enabled) =>
                      void run(
                        "product",
                        () =>
                          updateLiveProduct(storeId, item.variantId, {
                            enabled,
                          }),
                        enabled ? "Producto publicado" : "Producto retirado",
                      )
                    }
                  />
                ) : (
                  <LiveEmpty>
                    No hay productos publicados. Agrega una variante de tu catálogo.
                  </LiveEmpty>
                )}
              </LivePanel>
            </TabsContent>
            <TabsContent value="payments">
              <LiveYapeReviews key={storeId} storeId={storeId} canReview={canReviewPayments} />
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
                onSave={(input) =>
                  void run(
                    "config",
                    () => updateLiveConfig(storeId, input),
                    "Configuración guardada",
                  )
                }
              />
            </TabsContent>
          </Tabs>
        </>
      ) : null}
      {product ? (
        <ProductDialog
          product={product}
          busy={!!busy}
          onClose={() => setProduct(null)}
          onSave={(input) => {
            if (storeId)
              void run(
                "product",
                async () => {
                  await updateLiveProduct(storeId, product.variantId, input);
                  setProduct(null);
                },
                "Producto guardado",
              );
          }}
        />
      ) : null}
      {catalogOpen && storeId ? (
        <CatalogDialog
          storeId={storeId}
          onClose={() => setCatalogOpen(false)}
          onSelect={(item) => {
            setCatalogOpen(false);
            setProduct({ ...item, enabled: true });
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
            <Button variant="outline" onClick={() => void copy(paymentLink?.url ?? "")}>
              <Copy className="h-4 w-4" />
              Copiar enlace
            </Button>
            <Button asChild>
              <a
                href={`https://wa.me/${paymentLink?.phone.length === 9 ? `51${paymentLink.phone}` : paymentLink?.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hola ${paymentLink?.name}, paga tus apartados aquí: ${paymentLink?.url}`)}`}
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

function ReservationsPanel({
  data,
  canManage,
  canOperate,
  busy,
  onRelease,
  onTrust,
  onPaymentLink,
}: {
  data: LiveConsoleData;
  canManage: boolean;
  canOperate: boolean;
  busy: boolean;
  onRelease: (items: LiveReservation[]) => void;
  onTrust: (id: string, remove?: boolean) => void;
  onPaymentLink: (item: LiveReservation) => void;
}) {
  const [filter, setFilter] = useState("ACCUMULATED");
  const trustedIds = new Set(data.trustedCustomers.map((customer) => customer.id));
  const filtered = data.reservations.filter((reservation) =>
    filter === "PAID"
      ? reservation.status === "PAID"
      : activeReservation(reservation) && reservation.type === filter,
  );
  const groups = new Map<string, LiveReservation[]>();
  for (const reservation of filtered) {
    const key = `${reservation.customer.id ?? reservation.id}|${reservation.ownerId ?? "store"}`;
    groups.set(key, [...(groups.get(key) ?? []), reservation]);
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {[
          ["ACCUMULATED", "Acumulados"],
          ["TIMED", "Con tiempo"],
          ["PAID", "Pagados"],
        ].map(([value, label]) => (
          <Button
            key={value}
            variant={filter === value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(value)}
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="rounded-xl border border-teal-100 bg-teal-50 p-4 text-sm text-teal-900">
        Los clientes de confianza acumulan sin vencimiento. Cada cliente y dueño del live conserva
        su propio grupo de apartados.
      </div>
      {groups.size ? (
        [...groups.entries()].map(([key, items]) => (
          <LivePanel key={key}>
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">{items[0].customer.name}</h2>
                <p className="text-xs text-muted-foreground">
                  {items[0].customer.phone} · {items.reduce((sum, item) => sum + item.quantity, 0)}{" "}
                  unidades · {items[0].ownerId ? "Live de vendedor" : "Live del negocio"}
                </p>
              </div>
              <p className="text-lg font-bold tabular-nums">
                {liveMoney(items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0))}
              </p>
            </div>
            <div className="my-3 divide-y">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                >
                  <div>
                    {item.quantity} ×{" "}
                    {item.productName ||
                      item.name ||
                      data.products.find((product) => product.variantId === item.variantId)?.name ||
                      "Producto"}
                    {item.variantLabel ? (
                      <span className="ml-1 text-muted-foreground">· {item.variantLabel}</span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {statusLabels[item.status]}
                    </span>
                    {item.status !== "PAID" ? (
                      <LiveReservationTimer reservation={item} serverNow={data.serverNow} />
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            {filter !== "PAID" ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={!canOperate || busy}
                  onClick={() => onPaymentLink(items[0])}
                >
                  <Link2 className="h-4 w-4" />
                  Link de pago
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canOperate || busy || items.every((item) => !!item.checkoutId)}
                  onClick={() => onRelease(items.filter((item) => !item.checkoutId))}
                >
                  <Trash2 className="h-4 w-4" />
                  Liberar
                </Button>
                {items[0].customer.id && !trustedIds.has(items[0].customer.id) ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canManage || busy}
                    onClick={() => {
                      const id = items[0].customer.id;
                      if (id) onTrust(id);
                    }}
                  >
                    <Star className="h-4 w-4" />
                    Marcar de confianza
                  </Button>
                ) : null}
              </div>
            ) : null}
          </LivePanel>
        ))
      ) : (
        <LiveEmpty>
          {filter === "PAID" ? "No hay apartados pagados." : "No hay apartados en esta sección."}
        </LiveEmpty>
      )}
      <LivePanel
        title="Clientes de confianza"
        description="Solo estos clientes pueden acumular sin vencimiento. Puedes habilitarlos desde uno de sus apartados."
      >
        {data.trustedCustomers.length ? (
          <div className="divide-y">
            {data.trustedCustomers.map((customer) => (
              <div key={customer.id} className="flex items-center gap-3 py-3">
                <Star className="h-5 w-5 text-amber-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{customer.name}</p>
                  <p className="text-xs text-muted-foreground">{customer.phone}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canManage || busy}
                  onClick={() => onTrust(customer.id, true)}
                >
                  Quitar
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <LiveEmpty>Aún no hay clientes de confianza.</LiveEmpty>
        )}
      </LivePanel>
    </div>
  );
}

function ProductDialog({
  product,
  busy,
  onClose,
  onSave,
}: {
  product: LiveProduct;
  busy: boolean;
  onClose: () => void;
  onSave: (input: Partial<LiveProduct>) => void;
}) {
  const [price, setPrice] = useState(String(product.livePrice || product.regularPrice || ""));
  const [max, setMax] = useState(product.maxPerCustomer?.toString() ?? "");
  const valid =
    Number(price) > 0 &&
    Number.isFinite(Number(price)) &&
    (max === "" || (Number.isInteger(Number(max)) && Number(max) > 0));
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
          <DialogDescription>
            {product.sku}
            {product.variantLabel ? ` · ${product.variantLabel}` : ""} · {product.availableStock}{" "}
            unidades disponibles
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (valid)
              onSave({
                livePrice: Number(price),
                maxPerCustomer: max ? Number(max) : null,
                enabled: product.enabled,
              });
          }}
          className="space-y-4"
        >
          <label htmlFor="live-product-price" className="grid gap-2 text-sm font-medium">
            Precio live (S/)
            <Input
              id="live-product-price"
              type="number"
              min="0.01"
              step="0.01"
              required
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
          </label>
          <label htmlFor="live-product-max" className="grid gap-2 text-sm font-medium">
            Máximo por cliente
            <Input
              type="number"
              id="live-product-max"
              min="1"
              max="10000"
              step="1"
              value={max}
              placeholder="Sin límite"
              onChange={(event) => setMax(event.target.value)}
            />
            <span className="text-xs font-normal text-muted-foreground">
              Cuenta compras y apartados del mismo live.
            </span>
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy || !valid}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Guardar producto
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function CatalogDialog({
  storeId,
  onClose,
  onSelect,
}: {
  storeId: string;
  onClose: () => void;
  onSelect: (item: LiveProduct) => void;
}) {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<LiveProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await getLiveCatalog(storeId, search);
        if (!cancelled) {
          setItems(
            result.products.filter((item) =>
              `${item.name} ${item.sku} ${item.variantLabel ?? ""}`
                .toLocaleLowerCase()
                .includes(search.toLocaleLowerCase()),
            ),
          );
          setError("");
        }
      } catch (cause) {
        if (!cancelled) setError(liveError(cause));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [storeId, search]);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agregar al live</DialogTitle>
          <DialogDescription>
            Selecciona una variante de tu catálogo y define su precio live.
          </DialogDescription>
        </DialogHeader>
        <Input
          placeholder="Buscar por nombre o SKU"
          aria-label="Buscar producto para live"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {error ? (
          <LiveErrorBanner message={error} />
        ) : loading ? (
          <div className="flex justify-center p-6">
            <Loader2 className="animate-spin" />
          </div>
        ) : items.length ? (
          <div className="divide-y">
            {items.map((item) => (
              <button
                key={item.variantId}
                type="button"
                onClick={() => onSelect(item)}
                className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-muted"
              >
                <LiveProductImage product={item} className="h-12 w-12" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.variantLabel || item.sku} · {liveMoney(item.regularPrice)} ·{" "}
                    {item.availableStock} disp.
                  </p>
                </div>
                <Plus className="h-4 w-4" />
              </button>
            ))}
          </div>
        ) : (
          <LiveEmpty>No se encontraron variantes.</LiveEmpty>
        )}
      </DialogContent>
    </Dialog>
  );
}
function LiveConfigPanel({
  config,
  readiness,
  onConsole,
  canManage,
  busy,
  onSave,
}: {
  config: LiveConfig;
  readiness?: LiveReadiness;
  onConsole: () => void;
  canManage: boolean;
  busy: boolean;
  onSave: (config: LiveConfig) => void;
}) {
  const [draft, setDraft] = useState(config);
  const activationPending = draft.enabled && !config.enabled;
  const deactivationPending = !draft.enabled && config.enabled;
  const shippingPending = readiness?.checks.some(
    (check) => check.code === "SHIPPING" && !check.ready,
  );
  const activationMessage = activationPending
    ? "Activación sin guardar. Guarda esta configuración para habilitar las compras y poder abrir el catálogo."
    : deactivationPending
      ? "Desactivación sin guardar. Las compras siguen habilitadas hasta que guardes esta configuración."
      : readiness?.ready !== true
        ? shippingPending
          ? "Configura las tarifas en Configuración de tienda → Envíos. Después de completar los demás requisitos podrás habilitar las compras."
          : "Completa los requisitos pendientes de arriba. Puedes guardar esta configuración con las compras desactivadas."
        : config.enabled
          ? "Compras habilitadas. Vuelve a Consola en vivo para gestionar el catálogo."
          : "Todo listo. Activa «Habilitar compras del live» y guarda para poder abrir el catálogo.";
  const choices: {
    key: keyof Pick<
      LiveConfig,
      | "hideSoldOut"
      | "allowReservations"
      | "combineShipping"
      | "reminderEnabled"
      | "showBackLink"
      | "allowAccumulation"
      | "allowSellerLive"
    >;
    title: string;
    text: string;
  }[] = [
    {
      key: "hideSoldOut",
      title: "Ocultar variantes agotadas",
      text: "Solo muestra combinaciones con stock disponible.",
    },
    {
      key: "allowReservations",
      title: "Apartar productos",
      text: "Reserva stock mientras el cliente completa el pago.",
    },
    {
      key: "combineShipping",
      title: "Juntar compras en un envío",
      text: "Suma las compras del día al pedido que aún no se despachó.",
    },
    {
      key: "reminderEnabled",
      title: "Recordatorio por WhatsApp",
      text: "Disponible al conectar la integración de mensajes de Live.",
    },
    {
      key: "showBackLink",
      title: "Mostrar “Volver al live”",
      text: "Lleva al cliente de vuelta a tu transmisión.",
    },
    {
      key: "allowAccumulation",
      title: "Acumulados de clientes de confianza",
      text: "Permite apartar sin vencimiento a los clientes que autorices.",
    },
    {
      key: "allowSellerLive",
      title: "Live de vendedores",
      text: "Disponible al implementar el módulo de vendedores por comisión.",
    },
  ];
  const valid =
    Number.isInteger(draft.reservationMinutes) &&
    draft.reservationMinutes >= 1 &&
    draft.reservationMinutes <= 120 &&
    Number.isInteger(draft.maxReservedUnits) &&
    draft.maxReservedUnits >= 1 &&
    draft.maxReservedUnits <= 1000 &&
    (!draft.liveUrl || !!safeLiveUrl(draft.liveUrl));
  return (
    <LivePanel
      title="Configura tu catálogo del live"
      description="El video se transmite en la red social. Aquí gestionas las compras y el stock."
    >
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) onSave(draft);
        }}
      >
        <label
          htmlFor="live-enabled"
          className="flex items-center justify-between gap-4 rounded-xl border p-4 text-sm font-semibold"
        >
          <span>
            Habilitar compras del live
            <span className="mt-1 block text-xs font-normal text-muted-foreground">
              Actívalo y guarda después de completar Yape, productos con stock y envío.
            </span>
          </span>
          <Switch
            id="live-enabled"
            checked={draft.enabled}
            aria-describedby="live-activation-help"
            disabled={!canManage || busy || (!draft.enabled && readiness?.ready !== true)}
            onCheckedChange={(enabled) => setDraft((value) => ({ ...value, enabled }))}
          />
        </label>
        <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
          <p id="live-activation-help" className="text-sm text-muted-foreground">
            {activationMessage}
          </p>
          {config.enabled && draft.enabled && readiness?.ready && canManage ? (
            <Button type="button" variant="outline" size="sm" onClick={onConsole} disabled={busy}>
              Ir a Consola en vivo
            </Button>
          ) : null}
        </div>
        <label className="grid gap-2 text-sm font-medium">
          Nombre del enlace público
          <Input
            aria-label="Nombre del enlace público"
            value={draft.slug || ""}
            pattern="[a-z0-9][a-z0-9-]{1,48}[a-z0-9]"
            disabled={!canManage || busy}
            onChange={(e) =>
              setDraft((value) => ({
                ...value,
                slug: e.target.value.toLowerCase(),
              }))
            }
          />
          <span className="text-xs font-normal text-muted-foreground">
            {draft.slug || "tienda"}.powip.lat/live
          </span>
        </label>
        <p id="live-shipping-settings" tabIndex={-1} className="text-sm text-muted-foreground">
          Los envíos usan las coberturas y tarifas de{" "}
          <a className="underline" href="/configuracion/tiendas">
            Configuración de tienda → Envíos
          </a>
          .
        </p>
        <label htmlFor="live-url" className="grid gap-2 text-sm font-medium">
          Link de tu live o perfil
          <Input
            id="live-url"
            placeholder="https://www.tiktok.com/@tunegocio/live"
            value={draft.liveUrl ?? ""}
            onChange={(event) => setDraft((value) => ({ ...value, liveUrl: event.target.value }))}
            disabled={!canManage || busy}
          />
          <span className="text-xs font-normal text-muted-foreground">
            Usa un enlace HTTPS de tu red social.
          </span>
        </label>
        <div className="divide-y">
          {choices.map((choice) => (
            <label
              htmlFor={`live-setting-${choice.key}`}
              key={choice.key}
              className="flex items-center justify-between gap-4 py-4"
            >
              <span>
                <span className="block text-sm font-semibold">{choice.title}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{choice.text}</span>
              </span>
              <Switch
                id={`live-setting-${choice.key}`}
                checked={draft[choice.key]}
                aria-label={choice.title}
                disabled={
                  !canManage || busy || ["reminderEnabled", "allowSellerLive"].includes(choice.key)
                }
                onCheckedChange={(checked) =>
                  setDraft((value) => ({ ...value, [choice.key]: checked }))
                }
              />
            </label>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <label htmlFor="live-reservation-minutes" className="grid gap-2 text-sm font-medium">
            Minutos para pagar
            <Input
              type="number"
              min="1"
              max="120"
              step="1"
              id="live-reservation-minutes"
              value={draft.reservationMinutes}
              disabled={!canManage || busy}
              onChange={(event) =>
                setDraft((value) => ({
                  ...value,
                  reservationMinutes: Number(event.target.value),
                }))
              }
              required
            />
          </label>
          <label htmlFor="live-max-reserved" className="grid gap-2 text-sm font-medium">
            Máximo de unidades apartadas
            <Input
              type="number"
              min="1"
              max="1000"
              step="1"
              id="live-max-reserved"
              value={draft.maxReservedUnits}
              disabled={!canManage || busy}
              onChange={(event) =>
                setDraft((value) => ({
                  ...value,
                  maxReservedUnits: Number(event.target.value),
                }))
              }
              required
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Catálogo después del live
            <select
              className="h-9 rounded-lg border bg-background px-3 text-sm"
              value={draft.closePolicy}
              disabled={!canManage || busy}
              onChange={(event) =>
                setDraft((value) => ({
                  ...value,
                  closePolicy: event.target.value as LiveConfig["closePolicy"],
                }))
              }
            >
              <option value="END_OF_DAY">Hasta las 11:59 pm</option>
              <option value="24_HOURS">24 horas</option>
              <option value="MANUAL">Hasta que lo cierre</option>
            </select>
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          El tope de unidades apartadas no se aplica a clientes de confianza. El límite por producto
          se configura en Productos del live.
        </p>
        <div className="flex flex-wrap items-center gap-3 border-t pt-4">
          <Button type="submit" disabled={!canManage || busy || !valid}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {busy
              ? "Guardando configuración…"
              : activationPending
                ? "Guardar y habilitar compras"
                : deactivationPending
                  ? "Guardar y desactivar compras"
                  : "Guardar configuración"}
          </Button>
          {activationPending || deactivationPending ? (
            <p className="text-sm text-amber-800">Tienes cambios de activación sin guardar.</p>
          ) : null}
        </div>
      </form>
    </LivePanel>
  );
}
