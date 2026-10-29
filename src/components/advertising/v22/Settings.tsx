"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAdminPeriod } from "@/contexts/AdminPeriodContext";
import {
  adsGet,
  adsWrite,
  getAllAdsCatalog,
  saveAdsSettings,
  type AdProduct,
  type AdsChange,
  type AdsSettings,
  type AdsProduct,
  type AdsRow,
  getAdsSales,
} from "@/services/advertisingV22Service";
import { fetchBusinessProducts } from "@/services/businessProductsService";
import { AdvertisingLivePanel } from "../AdvertisingLivePanel";
import { AdvertisingStoreAssignmentsPanel } from "../AdvertisingStoreAssignmentsPanel";
import { useAdvertisingStoreFilter } from "../AdvertisingStoreFilterContext";
import { useAdsQuery, useAdsV22, useRefreshAds } from "./context";
import { limaToday, money, numeric } from "./model";
import { Block, Failure, SelectField, exportAdsWorkbook } from "./shared";
import { V23AdsetAssignments, V23ShopifyCodSettings } from "./V23Settings";
import { useAdvertisingAccountFilter } from "../AdvertisingAccountFilterContext";
import { ProfitConnections } from "./ProfitConnections";

const SECTIONS = [
  { id: "accounts", label: "Cuentas y tiendas" },
  { id: "products", label: "Producto de cada anuncio" },
  { id: "measurement", label: "Medir venta por anuncio" },
  { id: "sales-costs", label: "Ventas y costos de POWIP" },
  { id: "rules", label: "Reglas y presupuesto del mes" },
  { id: "whatsapp", label: "Resumen diario por WhatsApp" },
  { id: "permissions", label: "Permisos" },
  { id: "tags", label: "Etiquetas de creativos" },
  { id: "history", label: "Historial de cambios" },
  { id: "legacy", label: "Ventas antiguas sin tienda" },
  { id: "assignments", label: "Canal y vendedora de cada conjunto" },
  { id: "shopify-cod", label: "Shopify COD" },
];
const UTM =
  "utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.id}}&utm_term={{adset.id}}&utm_content={{ad.id}}";
interface WhatsappAutomationStatus {
  preferences: { enabled: boolean; time: string; destinationsCount: number };
  scheduler: { enabled: boolean };
  readiness: { ready: boolean; scope: "local" };
  automation: {
    state: "disabled" | "blocked" | "scheduled";
    reasons: Array<{ code: string; message: string }>;
  };
  deliveries: Array<{
    id: string;
    date: string;
    kind: "daily" | "test" | "alert";
    status: "pending" | "sent" | "failed" | "unknown";
    destination: string;
    errorCode: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
}
export function AdvertisingSettings() {
  const { identity, actorId, settings, reload } = useAdsV22();
  const refresh = useRefreshAds();
  const { fromDate, toDate } = useAdminPeriod();
  const salesTo = toDate > limaToday() ? limaToday() : toDate;
  const { storeId, stores } = useAdvertisingStoreFilter();
  const { accountId } = useAdvertisingAccountFilter();
  const [section, setSection] = useState("accounts");
  const [draft, setDraft] = useState<AdsSettings>(() => structuredClone(settings!));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState("");
  const [productReview, setProductReview] = useState({ scope: "", search: "", page: 1 });
  const [adsetConfirmation, setAdsetConfirmation] = useState<{
    row: AdsRow;
    productId: string;
    count: number;
  } | null>(null);
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("section");
    if (SECTIONS.some((item) => item.id === value)) setSection(value!);
  }, []);
  useEffect(() => setDraft(structuredClone(settings!)), [settings]);
  const catalog = useAdsQuery(
    ["config-ads", fromDate, salesTo, storeId, accountId],
    (id, signal) =>
      getAllAdsCatalog(
        id,
        { from: fromDate, to: salesTo, level: "ad", storeId, ...(accountId !== "all" ? { accountId } : {}) },
        signal,
      ),
    (section === "products" || section === "tags" || section === "accounts") && fromDate <= salesTo,
  );
  const products = useAdsQuery(
    ["products-v22", storeId],
    (id, signal) => adsGet<{ products: AdsProduct[] }>(id, "/v22/products", { storeId }, signal),
    section === "products",
  );
  const assignments = useAdsQuery(
    ["ad-products"],
    (id, signal) => adsGet<{ assignments: AdProduct[] }>(id, "/v22/ad-products", undefined, signal),
    section === "products" || section === "tags",
  );
  const changes = useAdsQuery<{ rows: AdsChange[] }>(
    ["changes"],
    async (id, signal) => {
      const [meta, local] = await Promise.all([
        adsGet<{ rows: Array<AdsChange & { actorId?: string; origin?: string }> }>(
          id,
          "/meta/v22/changes",
          undefined,
          signal,
        ),
        adsGet<{
          history: Array<{
            id: string;
            actorId: string;
            action: string;
            before: unknown;
            after: unknown;
            at: string;
            source: string;
          }>;
        }>(id, "/v22/history", undefined, signal),
      ]);
      return {
        rows: [
          ...meta.rows.map((row) => ({
            ...row,
            actor: row.actor ?? row.actorId,
            source: row.source ?? row.origin,
          })),
          ...local.history.map((row) => ({
            ...row,
            actor: row.actorId,
            createdAt: row.at,
            source: "powip",
          })),
        ].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")),
      };
    },
    section === "history",
  );
  const canConfigure = settings!.capabilities.configure === true;
  const waStatus = useAdsQuery(
    ["wa-status", settings!.version],
    (id, signal) => adsGet<WhatsappAutomationStatus>(id, "/v22/whatsapp/status", undefined, signal),
    section === "whatsapp" && canConfigure,
  );
  const waPreview = useAdsQuery(
    ["wa-preview", settings!.version],
    (id, signal) => adsGet<{ text: string }>(id, "/v22/whatsapp/preview", undefined, signal),
    section === "whatsapp" && canConfigure,
  );
  const measurement = useAdsQuery(
    ["measurement", limaToday(), storeId],
    (id, signal) => getAdsSales(id, `${limaToday().slice(0, 7)}-01`, limaToday(), storeId, signal),
    section === "measurement" || section === "legacy",
  );
  const periodSales = useAdsQuery(
    ["profit-connections", fromDate, salesTo, storeId],
    (id, signal) => getAdsSales(id, fromDate, salesTo, storeId, signal),
    section === "sales-costs" && fromDate <= salesTo,
  );
  const canAssign = settings!.capabilities.edit;
  const suggestions = useMemo(() => (catalog.data?.rows ?? [])
    .filter((row) => storeId === "all" || row.store?.id === storeId)
    .filter((row) => !assignments.data?.assignments.find((item) => item.adId === row.id)?.productId)
    .map((row) => ({ row, suggestion: suggestAdProduct(row, products.data?.products ?? []) }))
    .filter((item) => item.suggestion !== null),
  [catalog.data?.rows, assignments.data?.assignments, products.data?.products, storeId]);
  const productScope = JSON.stringify([fromDate, salesTo, storeId]);
  const productView = productReview.scope === productScope
    ? productReview
    : { scope: productScope, search: "", page: 1 };
  const productRows = (catalog.data?.rows ?? [])
    .filter((row) => storeId === "all" || row.store?.id === storeId)
    .filter((row) => !productView.search || `${row.name} ${row.id}`.toLocaleLowerCase("es").includes(productView.search.trim().toLocaleLowerCase("es")));
  const productPageCount = Math.max(1, Math.ceil(productRows.length / 10));
  const productPage = Math.min(productView.page, productPageCount);
  const productPageStart = (productPage - 1) * 10;
  async function save() {
    if (!identity || !canConfigure || pending) return;
    setPending(true);
    setError(null);
    setNotice("");
    try {
      await saveAdsSettings(identity, draft);
      await reload();
      if (section === "whatsapp") {
        await waStatus.refetch();
        setNotice("Preferencias de WhatsApp guardadas. Revisa el estado de la automatización.");
      } else setNotice("Configuración guardada.");
    } catch (failure) {
      setError(failure);
    } finally {
      setPending(false);
    }
  }
  async function assign(
    adId: string,
    accountId: string,
    productId: string,
    origin = "manual",
    applyToAdset = false,
  ) {
    if (!identity || !canAssign) return;
    setPending(true);
    setError(null);
    try {
      await adsWrite(identity, "put", `/v22/ad-products/${encodeURIComponent(adId)}`, {
        accountId,
        productId: productId || null,
        origin,
        applyToAdset,
      });
      await refresh();
      setAdsetConfirmation(null);
    } catch (failure) {
      setError(failure);
    } finally {
      setPending(false);
    }
  }
  async function applySuggestions() {
    if (!identity || !canAssign || pending) return;
    setPending(true);
    setError(null);
    let applied = 0;
    try {
      for (const item of suggestions) {
        await adsWrite(identity, "put", `/v22/ad-products/${item.row.id}`, {
          accountId: item.row.accountId,
          productId: item.suggestion!.product.id,
          origin: item.suggestion!.origin,
        });
        applied++;
      }
      await refresh();
      setNotice(`${applied} sugerencias aplicadas.`);
    } catch (failure) {
      setError(
        new Error(
          `${applied} sugerencias aplicadas. ${failure instanceof Error ? failure.message : "Revisa los datos antes de continuar."}`,
        ),
      );
      if (applied) await refresh();
    } finally {
      setPending(false);
    }
  }
  const updateRule = (key: keyof AdsSettings["rules"], value: string) =>
    setDraft((current) => ({
      ...current,
      rules: { ...current.rules, [key]: key === "minSpend" ? value : Number(value) },
    }));
  const switchSection = (value: string) => {
    setSection(value);
    setNotice("");
    setError(null);
    const url = new URL(window.location.href);
    url.searchParams.set("section", value);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
  };
  return (
    <main className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[240px_1fr] lg:p-8">
      <nav
        aria-label="Configuración de publicidad"
        className="flex gap-1 overflow-x-auto lg:flex-col"
      >
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            onClick={() => switchSection(item.id)}
            aria-current={section === item.id ? "page" : undefined}
            className={`shrink-0 rounded-md px-3 py-2 text-left text-sm ${section === item.id ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground hover:bg-muted"}`}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="min-w-0 space-y-4">
        {notice && (
          <p role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
            {notice}
          </p>
        )}
        {error != null && <Failure error={error} />}
        {!canConfigure && (
          <p className="text-xs text-muted-foreground">
            Tu rol permite consultar esta configuración.
          </p>
        )}
        {section === "accounts" && (
          <div className="space-y-5">
            <Block title="Cuentas y tiendas">
              <p className="text-sm text-muted-foreground">
                La empresa en POWIP es independiente del Business Manager de Meta. Asigna la tienda
                de cada conjunto cuando una cuenta anuncia para varias tiendas.
              </p>
              <p className="text-xs text-muted-foreground">Las conexiones y asignaciones se administran para toda la empresa.</p>
              <AdvertisingLivePanel
                companyId={identity?.companyId}
                actorId={actorId}
                token={identity?.token}
                companyName="Empresa activa"
                from={fromDate}
                to={toDate}
                connectionsOnly
              />
              <div className="space-y-3">
                {catalog.data?.accounts.map((account) => (
                  <AccountHealth key={account.id} account={account} />
                ))}
              </div>
              <p className="rounded-md border p-3 text-sm text-muted-foreground">
                TikTok · Disponible pronto{" "}
                <Button className="ml-3" disabled size="sm">
                  Disponible pronto
                </Button>
              </p>
            </Block>
            <AdvertisingStoreAssignmentsPanel
              companyId={identity?.companyId}
              actorId={actorId}
              token={identity?.token}
              from={fromDate}
              to={toDate}
            />
          </div>
        )}
        {section === "assignments" && <V23AdsetAssignments />}
        {section === "shopify-cod" && <V23ShopifyCodSettings />}
        {section === "products" && (
          <Block
            title="Producto de cada anuncio"
            tools={
              suggestions.length > 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canAssign || pending}
                  onClick={() => void applySuggestions()}
                >
                  Aplicar todas las sugerencias ({suggestions.length})
                </Button>
              ) : undefined
            }
          >
            {catalog.isError || products.isError || assignments.isError ? (
              <Failure
                error={catalog.error ?? products.error ?? assignments.error}
                retry={() => {
                  void catalog.refetch();
                  void products.refetch();
                  void assignments.refetch();
                }}
              />
            ) : fromDate > salesTo ? (
              <p className="text-sm">Elige un período que ya haya comenzado para revisar anuncios.</p>
            ) : !catalog.data || !products.data || !assignments.data ? (
              <p role="status" className="text-sm">Cargando anuncios y productos…</p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  El producto se asigna por anuncio. Las ventas se calculan por tienda y el stock
                  disponible corresponde a la empresa.
                </p>
                <Input
                  aria-label="Buscar anuncio para vincular producto"
                  placeholder="Buscar por nombre o ID de anuncio"
                  value={productView.search}
                  onChange={(event) => setProductReview({ scope: productScope, search: event.target.value, page: 1 })}
                />
                <div className="space-y-3">
                  {productRows.slice(productPageStart, productPageStart + 10)
                    .map((row) => {
                      const current = assignments.data?.assignments.find(
                        (item) => item.adId === row.id,
                      );
                      const suggestion = suggestions.find(
                        (item) => item.row.id === row.id,
                      )?.suggestion;
                      return (
                        <div
                          key={row.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{row.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {row.store?.name ?? "Sin tienda asignada"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Anuncio {row.id} · Cuenta {catalog.data?.accounts.find((account) => account.id === row.accountId)?.name ?? row.accountId}
                              {row.adsetId ? ` · Conjunto ${row.adsetId}` : ""}
                            </p>
                          </div>
                          <SelectField
                            label={`Producto de ${row.name}`}
                            value={current?.productId ?? ""}
                            disabled={!canAssign || pending || !row.store?.id}
                            onChange={(value) => void assign(row.id, row.accountId, value)}
                            options={[
                              { value: "", label: "Sin producto" },
                              { value: "varios", label: "Varios productos (catálogo)" },
                              ...(products.data?.products ?? []).map((product) => ({
                                value: product.id,
                                label: product.name,
                              })),
                            ]}
                          />
                          {suggestion && (
                            <div className="text-xs text-muted-foreground">
                              Sugerencia por{" "}
                              {suggestion.origin === "url" ? "URL verificada" : "nombre"}:{" "}
                              {suggestion.product.name}{" "}
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!canAssign || pending}
                                onClick={() =>
                                  void assign(
                                    row.id,
                                    row.accountId,
                                    suggestion.product.id,
                                    suggestion.origin,
                                  )
                                }
                              >
                                Aplicar
                              </Button>
                            </div>
                          )}
                          {canAssign &&
                            current?.productId &&
                            current.productId !== "varios" &&
                            row.adsetId && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  setAdsetConfirmation({
                                    row,
                                    productId: current.productId!,
                                    count: catalog.data!.rows.filter(
                                      (item) =>
                                        item.adsetId === row.adsetId &&
                                        item.accountId === row.accountId,
                                    ).length,
                                  })
                                }
                              >
                                Asignar al conjunto completo…
                              </Button>
                            )}
                        </div>
                      );
                    })}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p role="status" className="text-xs text-muted-foreground">
                    {productRows.length
                      ? `Mostrando ${productPageStart + 1}–${Math.min(productPageStart + 10, productRows.length)} de ${productRows.length} anuncios`
                      : "Sin anuncios para esta búsqueda y período."}
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={productPage <= 1} onClick={() => setProductReview({ ...productView, page: productPage - 1 })}>Anterior</Button>
                    <Button size="sm" variant="outline" disabled={productPage >= productPageCount} onClick={() => setProductReview({ ...productView, page: productPage + 1 })}>Siguiente</Button>
                  </div>
                </div>
              </>
            )}
          </Block>
        )}
        {section === "sales-costs" && fromDate > salesTo && (
          <Block title="Ventas y costos de POWIP">
            <p className="text-sm text-muted-foreground">
              Elige un período que ya haya comenzado para consultar las ventas registradas.
            </p>
          </Block>
        )}
        {section === "sales-costs" && fromDate <= salesTo && (
          <ProfitConnections
            from={fromDate}
            to={salesTo}
            sales={periodSales.data}
            loading={periodSales.isPending}
            error={periodSales.error}
            onSection={switchSection}
          />
        )}
        {section === "measurement" && (
          <Block title="Medir venta por anuncio">
            <h3 className="font-medium">Web · Shopify</h3>
            {measurement.data && (
              <p className="text-sm">
                Pedidos web con anuncio este mes:{" "}
                {measurement.data.byChannel
                  .filter((row) => row.channel === "web")
                  .reduce((sum, row) => sum + row.attributedOrders, 0)}{" "}
                de{" "}
                {measurement.data.byChannel
                  .filter((row) => row.channel === "web")
                  .reduce((sum, row) => sum + row.orders, 0)}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Copia estos parámetros en la URL de tus anuncios. POWIP recupera el anuncio de la
              última visita, primera visita o página de llegada del pedido.
            </p>
            <code className="block break-all rounded-md bg-muted p-3 text-xs">{UTM}</code>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void navigator.clipboard
                  .writeText(UTM)
                  .then(() => setNotice("Parámetros copiados."))
                  .catch(setError)
              }
            >
              Copiar parámetros
            </Button>
            <h3 className="font-medium">Mensajes · Llega con el CRM</h3>
            <p className="text-sm text-muted-foreground">
              El CRM escribe el anuncio y la fecha de atribución. Se aplica la última interacción
              dentro de 7 días. Publicidad consulta esa atribución.
            </p>
            <Link href="/registrar-venta" className="text-sm text-primary underline">
              Registrar venta · ¿De qué anuncio vino? →
            </Link>
          </Block>
        )}
        {section === "rules" && (
          <Block title="Reglas y presupuesto del mes">
            <fieldset disabled={!canConfigure || pending} className="grid gap-4 sm:grid-cols-2">
              {[
                { key: "noResultsDays", label: "Sin resultados · días", min: 1 },
                { key: "minSpend", label: "Gasto mínimo S/", min: 0 },
                { key: "nearLimitPct", label: "Cerca del límite %", min: 1, max: 100 },
                { key: "highFrequency", label: "Frecuencia alta", min: 1 },
                { key: "winPct", label: "Hit rate ganador % del máximo", min: 1, max: 100 },
                { key: "testMultiplier", label: "Prueba · veces el máximo", min: 1 },
                { key: "testMinSales", label: "Prueba · ventas mínimas", min: 1 },
              ].map((rule) => (
                <label key={rule.key} className="space-y-1 text-sm">
                  {rule.label}
                  <Input
                    type="number"
                    min={rule.min}
                    max={rule.max}
                    step={
                      rule.key === "highFrequency" || rule.key === "testMultiplier" ? ".1" : "1"
                    }
                    value={draft.rules[rule.key as keyof AdsSettings["rules"]]}
                    onChange={(event) =>
                      updateRule(rule.key as keyof AdsSettings["rules"], event.target.value)
                    }
                  />
                </label>
              ))}
            </fieldset>
            <h3 className="font-medium">Presupuesto mensual por tienda</h3>
            <fieldset disabled={!canConfigure || pending} className="space-y-3">
              {draft.budgets.map((budget, index) => (
                <div
                  key={`${budget.storeId}:${budget.month}:${index}`}
                  className="flex flex-wrap items-end gap-3"
                >
                  <SelectField
                    label="Tienda del presupuesto"
                    value={budget.storeId}
                    onChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        budgets: current.budgets.map((row, i) =>
                          i === index ? { ...row, storeId: value } : row,
                        ),
                      }))
                    }
                    options={stores.map((store) => ({ value: store.id, label: store.name }))}
                  />
                  <label className="text-xs">
                    Mes
                    <Input
                      type="month"
                      value={budget.month}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          budgets: current.budgets.map((row, i) =>
                            i === index ? { ...row, month: event.target.value } : row,
                          ),
                        }))
                      }
                    />
                  </label>
                  <label className="text-xs">
                    Monto S/
                    <Input
                      type="number"
                      min="0"
                      step=".01"
                      value={budget.amount}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          budgets: current.budgets.map((row, i) =>
                            i === index ? { ...row, amount: event.target.value } : row,
                          ),
                        }))
                      }
                    />
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        budgets: current.budgets.filter((_, i) => i !== index),
                      }))
                    }
                  >
                    Quitar
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                disabled={!stores.length}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    budgets: [
                      ...current.budgets,
                      { storeId: stores[0].id, month: limaToday().slice(0, 7), amount: "0" },
                    ],
                  }))
                }
              >
                Añadir presupuesto
              </Button>
            </fieldset>
            <Button disabled={!canConfigure || pending} onClick={() => void save()}>
              Guardar reglas y presupuestos
            </Button>
          </Block>
        )}
        {section === "whatsapp" && (
          <Block title="Resumen diario por WhatsApp">
            {canConfigure ? (
              waStatus.isError ? (
                <Failure error={waStatus.error} retry={waStatus.refetch} />
              ) : waStatus.data ? (
                <div className="space-y-3 rounded-md border p-3">
                  <h3 className="font-medium">Estado de la automatización</h3>
                  <p className="text-sm font-medium">
                    {waStatus.data.automation.state === "scheduled"
                      ? "Programación disponible"
                      : waStatus.data.automation.state === "blocked"
                        ? "Automatización pendiente de configuración"
                        : "Automatización deshabilitada"}
                  </p>
                  <p className="text-sm">
                    {waStatus.data.preferences.enabled
                      ? "Solicitud de resumen diario guardada."
                      : "Resumen diario desactivado en la preferencia guardada."}{" "}
                    Horario guardado: {waStatus.data.preferences.time} (Perú).{" "}
                    Destinos: {waStatus.data.preferences.destinationsCount}.
                  </p>
                  {waStatus.data.automation.reasons.length > 0 && (
                    <ul className="list-disc space-y-1 pl-5 text-sm text-amber-800 dark:text-amber-300">
                      {waStatus.data.automation.reasons.map((reason) => (
                        <li key={reason.code}>{reason.message}</li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Este estado verifica la configuración local. Cada envío depende de la
                    ejecución programada, los datos disponibles y la respuesta de WhatsApp.
                  </p>
                  <h3 className="font-medium">Historial de envíos</h3>
                  {waStatus.data.deliveries.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr>
                            {["Fecha (Perú)", "Tipo", "Destino", "Estado", "Detalle"].map((label) => (
                              <th key={label} scope="col" className="p-2">{label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {waStatus.data.deliveries.map((delivery) => (
                            <tr key={delivery.id} className="border-t">
                              <td className="p-2">
                                {new Date(delivery.createdAt).toLocaleString("es-PE", {
                                  timeZone: "America/Lima",
                                })}
                              </td>
                              <td className="p-2">
                                {{ daily: "Resumen diario", test: "Prueba", alert: "Alerta" }[delivery.kind]}
                              </td>
                              <td className="p-2">{delivery.destination}</td>
                              <td className="p-2">
                                {{ sent: "Enviado al proveedor", pending: "Pendiente", unknown: "Sin confirmación", failed: "Fallido" }[delivery.status]}
                              </td>
                              <td className="p-2">
                                {delivery.status === "sent"
                                  ? "El proveedor aceptó el envío; la recepción no está confirmada."
                                  : delivery.status === "unknown"
                                    ? "No se confirmó el resultado. Revisa el proveedor antes de repetir."
                                    : delivery.status === "pending"
                                      ? "El envío fue registrado y aún no tiene resultado."
                                      : "El envío falló. Revisa la configuración y el proveedor."}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <p className="text-sm text-muted-foreground">No hay envíos registrados para esta empresa.</p>}
                  <Button variant="outline" size="sm" disabled={waStatus.isFetching} onClick={() => void waStatus.refetch()}>
                    Actualizar estado e historial
                  </Button>
                </div>
              ) : <p className="text-sm">Consultando estado de WhatsApp…</p>
            ) : <p className="text-sm text-muted-foreground">Se requiere permiso de configuración para consultar el estado y los destinos de los envíos.</p>}
            <fieldset disabled={!canConfigure || pending} className="space-y-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.whatsapp.enabled}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      whatsapp: { ...current.whatsapp, enabled: event.target.checked },
                    }))
                  }
                />{" "}
                Solicitar resumen diario
              </label>
              <label className="block max-w-40 space-y-1 text-sm">
                Hora de Perú
                <Input
                  type="time"
                  value={draft.whatsapp.time}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      whatsapp: { ...current.whatsapp, time: event.target.value },
                    }))
                  }
                />
              </label>
              {draft.whatsapp.numbers.map((number, index) => (
                <label key={index} className="block space-y-1 text-sm">
                  Número destino {index + 1}
                  <Input
                    placeholder="+51912345678"
                    value={number}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        whatsapp: {
                          ...current.whatsapp,
                          numbers: current.whatsapp.numbers.map((value, i) =>
                            i === index ? event.target.value : value,
                          ),
                        },
                      }))
                    }
                  />
                </label>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    whatsapp: { ...current.whatsapp, numbers: [...current.whatsapp.numbers, ""] },
                  }))
                }
              >
                + Otro número
              </Button>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { id: "performance", label: "Gasto, pedidos y costo por venta por tienda" },
                  { id: "comparison", label: "Comparación con el día anterior" },
                  { id: "pause", label: "Anuncios para pausar" },
                  { id: "pace", label: "Ritmo del mes" },
                ].map((item) => (
                  <label key={item.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={draft.whatsapp.includes.includes(item.id)}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          whatsapp: {
                            ...current.whatsapp,
                            includes: event.target.checked
                              ? [...current.whatsapp.includes, item.id]
                              : current.whatsapp.includes.filter((value) => value !== item.id),
                          },
                        }))
                      }
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </fieldset>
            {waPreview.isError ? (
              <Failure error={waPreview.error} retry={waPreview.refetch} />
            ) : (
              <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
                {waPreview.data?.text ??
                  "Guarda las opciones para preparar la vista previa con los datos reales."}
              </pre>
            )}
            <p className="text-xs text-muted-foreground">
              Guardar conserva tu preferencia. El envío requiere el número POWIP y una plantilla
              Utility aprobada. La aceptación del proveedor no confirma la recepción del destinatario.
            </p>
            <div className="flex gap-2">
              <Button disabled={!canConfigure || pending} onClick={() => void save()}>
                Guardar resumen
              </Button>
              <Button
                variant="outline"
                disabled={!canConfigure || pending}
                onClick={() => {
                  if (!identity) return;
                  setPending(true);
                  setError(null);
                  void adsWrite<{ deliveries: Array<{ status: string }> }>(
                    identity,
                    "post",
                    "/v22/whatsapp/test",
                  )
                    .then((result) => {
                      if (
                        !result.deliveries?.length ||
                        result.deliveries.some((delivery) => delivery.status !== "sent")
                      )
                        throw new Error("El proveedor no confirmó el envío.");
                      setNotice("El proveedor confirmó el envío de prueba.");
                    })
                    .catch(setError)
                    .finally(() => {
                      setPending(false);
                      void waStatus.refetch();
                    });
                }}
              >
                Enviarme una prueba
              </Button>
            </div>
          </Block>
        )}
        {section === "permissions" && (
          <Block title="Permisos">
            <p className="text-sm text-muted-foreground">
              Administrador siempre conserva todos los permisos. Al quitar ganancia se ocultan
              costos de producto, máximo, semáforo y ganancia también en Excel.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {[
                      "Rol",
                      "Ver Publicidad",
                      "Ver gasto",
                      "Ver ganancia y costos",
                      "Pausar y presupuesto",
                    ].map((label) => (
                      <th key={label} className="p-3 text-left">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {draft.permissions.map((role, index) => (
                    <tr key={role.role} className="border-t">
                      <th className="p-3 text-left">
                        {
                          {
                            admin: "Administrador",
                            supervisor: "Supervisor",
                            seller: "Vendedor",
                            advertiser: "Asesor de publicidad",
                          }[role.role]
                        }
                      </th>
                      {(["view", "spend", "profit", "edit"] as const).map((permission) => (
                        <td key={permission} className="p-3">
                          <input
                            aria-label={`${role.role}: ${permission}`}
                            type="checkbox"
                            disabled={!canConfigure || pending || role.role === "admin"}
                            checked={role.role === "admin" || role[permission]}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                permissions: current.permissions.map((row, i) =>
                                  i === index
                                    ? { ...row, [permission]: event.target.checked }
                                    : row,
                                ),
                              }))
                            }
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button disabled={!canConfigure || pending} onClick={() => void save()}>
              Guardar permisos
            </Button>
          </Block>
        )}
        {section === "tags" && (
          <Block title="Etiquetas de creativos">
            <div className="grid gap-6 sm:grid-cols-2">
              {(["hooks", "creators"] as const).map((type) => (
                <fieldset key={type} disabled={!canConfigure || pending} className="space-y-3">
                  <h3 className="font-medium">{type === "hooks" ? "Tipo de gancho" : "Creador"}</h3>
                  {draft.tags[type].map((tag, index) => (
                    <div key={tag.id} className="flex items-center gap-2">
                      <Input
                        aria-label={`${type} ${index + 1}`}
                        value={tag.name}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            tags: {
                              ...current.tags,
                              [type]: current.tags[type].map((row, i) =>
                                i === index ? { ...row, name: event.target.value } : row,
                              ),
                            },
                          }))
                        }
                      />
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {assignments.data?.assignments.filter(
                          (row) => (type === "hooks" ? row.hookId : row.creatorId) === tag.id,
                        ).length ?? 0}{" "}
                        anuncios
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            tags: {
                              ...current.tags,
                              [type]: current.tags[type].filter((_, i) => i !== index),
                            },
                          }))
                        }
                      >
                        Quitar
                      </Button>
                    </div>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        tags: {
                          ...current.tags,
                          [type]: [...current.tags[type], { id: crypto.randomUUID(), name: "" }],
                        },
                      }))
                    }
                  >
                    Añadir {type === "hooks" ? "gancho" : "creador"}
                  </Button>
                </fieldset>
              ))}
            </div>
            <Button disabled={!canConfigure || pending} onClick={() => void save()}>
              Guardar etiquetas
            </Button>
          </Block>
        )}
        {section === "history" && (
          <Block
            title="Historial de cambios"
            tools={
              <Button
                size="sm"
                variant="outline"
                disabled={!changes.data}
                onClick={() =>
                  void exportAdsWorkbook("POWIP_Historial", [
                    {
                      name: "Historial",
                      rows: (changes.data?.rows ?? []).map((row) => ({
                        Cuándo: row.createdAt ?? row.date,
                        Quién: row.actor ?? "—",
                        Desde: row.source ?? "—",
                        Cambio: row.description ?? row.action,
                        ...(settings!.capabilities.spend
                          ? {
                              Antes: JSON.stringify(row.before),
                              Después: JSON.stringify(row.after),
                            }
                          : {}),
                      })),
                    },
                  ]).catch(setError)
                }
              >
                ↓ Excel
              </Button>
            }
          >
            {changes.isError ? (
              <Failure error={changes.error} retry={changes.refetch} />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {["Cuándo", "Quién", "Desde", "Qué cambió"].map((label) => (
                      <th key={label} className="p-3 text-left">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {changes.data?.rows.map((row, index) => (
                    <tr key={row.id ?? index} className="border-t">
                      <td className="p-3">{row.createdAt ?? row.date}</td>
                      <td className="p-3">{row.actor ?? "—"}</td>
                      <td className="p-3">{row.source === "meta" ? "Ads Manager" : "POWIP"}</td>
                      <td className="p-3">{row.description ?? row.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {changes.data?.rows.length === 0 && (
              <p className="text-sm text-muted-foreground">Todavía no hay cambios registrados.</p>
            )}
          </Block>
        )}
        {section === "legacy" && (
          <Block title="Ventas antiguas sin tienda">
            {measurement.data && (
              <p className="text-sm font-medium">
                Sin tienda en el mes actual:{" "}
                {typeof measurement.data.quality.legacyStoreCount === "number"
                  ? measurement.data.quality.legacyStoreCount
                  : "—"}
              </p>
            )}
            <p className="text-sm">
              Las ventas sin tienda permanecen sin asignar y requieren revisión individual
              antes de compararlas con la publicidad.
            </p>
            <Link
              href="/ventas"
              className="text-sm font-medium text-primary underline"
            >
              Revisar ventas
            </Link>
          </Block>
        )}
      </div>
      <Dialog
        open={adsetConfirmation !== null}
        onOpenChange={(open) => {
          if (!open) setAdsetConfirmation(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar producto al conjunto completo</DialogTitle>
            <DialogDescription>
              Se aplicará el producto elegido a {adsetConfirmation?.count} anuncios de este
              conjunto. Revisa que todos anuncien el mismo producto.
            </DialogDescription>
          </DialogHeader>
          {error != null && <Failure error={error} />}
          <Button
            disabled={pending}
            onClick={() => {
              if (adsetConfirmation)
                void assign(
                  adsetConfirmation.row.id,
                  adsetConfirmation.row.accountId,
                  adsetConfirmation.productId,
                  "manual",
                  true,
                );
            }}
          >
            Confirmar asignación
          </Button>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export function suggestAdProduct(row: AdsRow, products: AdsProduct[]) {
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("es")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  if (row.destinationType === "WEBSITE") {
    const handles = (row.destinations ?? [])
      .filter((destination) => destination.type === "WEB")
      .flatMap((destination) => {
        try {
          const match = new URL(destination.identifier ?? "").pathname.match(/\/products\/([^/]+)/);
          return match ? [decodeURIComponent(match[1])] : [];
        } catch {
          return [];
        }
      });
    const matches = products.filter(
      (product) => product.handle && handles.includes(product.handle),
    );
    return matches.length === 1 ? { product: matches[0], origin: "url" as const } : null;
  }
  const name = ` ${normalize(row.name)} `;
  const matches = products.filter((product) => {
    const candidate = normalize(product.name);
    return candidate.length >= 4 && name.includes(` ${candidate} `);
  });
  return matches.length === 1 ? { product: matches[0], origin: "name" as const } : null;
}
function AccountHealth({
  account,
}: {
  account: {
    id: string;
    externalId: string;
    name: string;
    currency: string;
    timeZone: string;
    catalogUpdatedAt: string | null;
  };
}) {
  const query = useAdsQuery(["account-status", account.id], (identity, signal) =>
    adsGet<{
      accountStatus: number | null;
      disableReason: number | null;
      businessManager: string | { name?: string } | null;
      paymentProblem: boolean;
    }>(identity, "/meta/v22/account-status", { accountId: account.id }, signal),
  );
  const state = query.data;
  return (
    <div className="rounded-md border p-3 text-sm">
      <p className="font-medium">
        {account.name} · ID {account.externalId}
      </p>
      <p className="text-xs text-muted-foreground">
        {account.currency} · {account.timeZone} · sincronización{" "}
        {account.catalogUpdatedAt
          ? new Date(account.catalogUpdatedAt).toLocaleString("es-PE", { timeZone: "America/Lima" })
          : "sin sincronizar"}
      </p>
      {query.isError ? (
        <Failure error={query.error} retry={query.refetch} />
      ) : !state ? (
        <p className="text-xs">Consultando estado en Meta…</p>
      ) : (
        <>
          <p className={state.paymentProblem ? "text-red-600" : "text-xs"}>
            {state.paymentProblem
              ? "La cuenta tiene un problema de pago: los anuncios no salen"
              : state.accountStatus === 1
                ? "Activa en Meta"
                : state.disableReason
                  ? `Deshabilitada en Meta · motivo ${state.disableReason}`
                  : `Estado de Meta: ${state.accountStatus ?? "sin confirmar"}`}
          </p>
          {state.businessManager && (
            <p className="text-xs text-muted-foreground">
              Business Manager:{" "}
              {typeof state.businessManager === "string"
                ? state.businessManager
                : (state.businessManager.name ?? "sin nombre")}
            </p>
          )}
          <a
            className="text-xs text-primary underline"
            href={`https://www.facebook.com/adsmanager/manage/accounts?act=${encodeURIComponent(account.externalId)}`}
            target="_blank"
            rel="noreferrer"
          >
            Ver cuenta en Meta
          </a>
        </>
      )}
    </div>
  );
}
