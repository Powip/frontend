"use client";
import { useCallback, useEffect, useMemo, useState, type SetStateAction } from "react";
import Link from "next/link";
import { ChevronDown, Clock3, Search } from "lucide-react";
import { addDays, parseISO, subDays } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  type AdsLevel,
  type AdsProduct,
  type AdsRow,
  type AdsSavedView,
} from "@/services/advertisingV22Service";
import { useAdvertisingStoreFilter } from "../AdvertisingStoreFilterContext";
import { useAdvertisingAccountFilter } from "../AdvertisingAccountFilterContext";
import {
  isActiveAd,
  lastSpendAt,
  lastSpendLabel,
  sortAdItems,
  catalogChannels,
} from "./ads-list-model";
import { useAdsQuery, useAdsV22, useRefreshAds } from "./context";
import {
  adAge,
  createAdFinancialCalculator,
  financialBasis,
  financialCauses,
  channelData,
  channelRow,
  daysForRow,
  adStatus,
  isMetaPaused,
  metaPauseDescription,
  canScale,
  comparisonPeriod,
  creativeAverage,
  creativeMetrics,
  dayKey,
  decimal,
  diagnosis,
  limaToday,
  money,
  numeric,
  pct,
  ratio,
  resultCount,
  rowResultTotal,
  summarySpendAvailable,
  hourlySpendScope,
  spendAvailabilityDetail,
} from "./model";
import { Block, Failure, MetricCard, SelectField, exportAdsWorkbook, dataWarning } from "./shared";
import { useNumbers } from "./Numbers";
import {
  AdvertisingActionDialog,
  META_MANAGEMENT_UNAVAILABLE,
  type ActionSelection,
} from "./Actions";
import { AdvertisingAdDetail } from "./AdDetail";
import { AdThumbnail } from "./Thumbnail";
import { AdvertisingDataNotice } from "./DataNotice";
import { advertisingSectionHref } from "../advertising-sections";

const LEVELS: Array<{ value: AdsLevel; label: string }> = [
  { value: "store", label: "Tienda" },
  { value: "account", label: "Cuenta" },
  { value: "campaign", label: "Campaña" },
  { value: "adset", label: "Conjunto" },
  { value: "ad", label: "Anuncio" },
];
const STATES = [
  "Todos",
  "Para escalar",
  "Sin resultados",
  "Pierdes plata",
  "Cerca del límite",
  "Rentable",
  "Escalando",
  "Aprendizaje",
  "Pausado",
];
const STATUS_ORDER = [
  "Sin resultados",
  "Pierdes plata",
  "Cerca del límite",
  "Rentable",
  "Sin datos suficientes",
  "Aprendizaje",
  "Pausado",
];
export function AdvertisingAds() {
  const { fromDate, toDate, setPeriod } = useAdminPeriod();
  const { storeId, setStoreId, stores } = useAdvertisingStoreFilter();
  const { accountId, setAccountId } = useAdvertisingAccountFilter();
  const { identity, settings } = useAdsV22();
  const refresh = useRefreshAds();
  const today = limaToday();
  const to = toDate < today ? toDate : today;
  const [level, setLevel] = useState<AdsLevel>("ad");
  const recentlyIncreased = (row: AdsRow) => {
    const date = row.budget?.increasedAt?.slice(0, 10);
    const elapsed = date ? (Date.parse(today) - Date.parse(date)) / 86_400_000 : null;
    return elapsed !== null && elapsed >= 0 && elapsed <= 7;
  };
  const [view, setView] = useState("performance");
  const [channel, setChannel] = useState("all");
  const [state, setState] = useState("Todos");
  const [population, setPopulation] = useState("active");
  const [sort, setSort] = useState("recent");
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const navigationScope = `${storeId}:${accountId}`;
  type DrillPath = Array<{ level: AdsLevel; id: string; name: string }>;
  const [navigation, setNavigation] = useState<{ storeId: string; path: DrillPath }>({
    storeId: navigationScope,
    path: [],
  });
  // A breadcrumb from another store must never override the current store filter.
  const path = navigation.storeId === navigationScope ? navigation.path : [];
  const setPath = (value: SetStateAction<DrillPath>) =>
    setNavigation((previous) => ({
      storeId: navigationScope,
      path:
        typeof value === "function"
          ? value(previous.storeId === navigationScope ? previous.path : [])
          : value,
    }));
  useEffect(() => {
    setNavigation((current) =>
      current.storeId === navigationScope ? current : { storeId: navigationScope, path: [] },
    );
  }, [navigationScope]);
  const [selected, setSelected] = useState<AdsRow | null>(null);
  const [action, setActionSelection] = useState<ActionSelection | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [undo, setUndo] = useState<{ rows: AdsRow[]; until: number } | null>(null);
  useEffect(() => {
    setSelected(null);
    setAction(null);
    setUndo(null);
    setSaveOpen(false);
  }, [storeId, accountId]);
  useEffect(() => {
    setSelected(null);
    setAction(null);
    setUndo(null);
    setSaveOpen(false);
  }, [storeId]);
  const permissions = settings!.capabilities;
  const pathValue = (selectedLevel: AdsLevel) =>
    path.find((item) => item.level === selectedLevel)?.id;
  const effectiveStoreId = pathValue("store") ?? storeId;
  const filters = {
    from: fromDate,
    to,
    level,
    storeId: effectiveStoreId,
    accountId: accountId !== "all" ? accountId : pathValue("account"),
    campaignId: pathValue("campaign"),
    adsetId: pathValue("adset"),
  };
  const catalog = useAdsQuery(
    ["catalog", filters],
    (id, signal) => getAllAdsCatalog(id, filters, signal),
    fromDate <= to,
  );
  const catalogAccountIds = new Set(
    catalog.data?.rows.map((row) => row.accountId).filter(Boolean) ?? [],
  );
  const canManageAds =
    permissions.edit &&
    catalogAccountIds.size === 1 &&
    catalog.data?.capabilities?.canManageAds === true;
  function setAction(selection: ActionSelection | null) {
    setActionSelection(
      selection
        ? {
            ...selection,
            canManageAds:
              selection.canManageAds ??
              (canManageAds &&
                selection.rows.length > 0 &&
                selection.rows.every((row) => catalogAccountIds.has(row.accountId))),
          }
        : null,
    );
  }
  const fullAds = useAdsQuery(
    [
      "catalog",
      {
        from: fromDate,
        to,
        level: "ad",
        storeId,
        accountId: accountId !== "all" ? accountId : undefined,
      },
    ],
    (id, signal) =>
      getAllAdsCatalog(
        id,
        {
          from: fromDate,
          to,
          level: "ad",
          storeId,
          accountId: accountId !== "all" ? accountId : undefined,
        },
        signal,
      ),
    fromDate <= to,
  );
  const needsCreativeAverage = view !== "performance" || selected !== null;
  const averageFilters = {
    from: dayKey(subDays(parseISO(today), 29)),
    to: today,
    level: "ad" as const,
    storeId,
  };
  const averageCatalog = useAdsQuery(
    ["catalog", averageFilters],
    (id, signal) => getAllAdsCatalog(id, averageFilters, signal),
    needsCreativeAverage,
  );
  // Share the complete residual pool; financial calculators apply the selected store.
  const data = useNumbers(fromDate, to, storeId, "ads");
  const scaleData = useNumbers(dayKey(subDays(parseISO(today), 6)), today, storeId, "scale-check", "all", !!catalog.data);
  const productData = useAdsQuery(["products-v22", storeId], (id, signal) =>
    adsGet<{ products: AdsProduct[] }>(id, "/v22/products", { storeId }, signal),
    !!catalog.data,
  );
  const saved = useAdsQuery(["saved-views"], (id, signal) =>
    adsGet<{ views: AdsSavedView[] }>(id, "/v22/views", undefined, signal),
    !!catalog.data,
  );
  const average = useMemo(
    () => creativeAverage(needsCreativeAverage ? (averageCatalog.data?.rows ?? []) : []),
    [averageCatalog.data, needsCreativeAverage],
  );
  const scoped = useMemo(
    () =>
      data.data && !data.isError
        ? channelData(data.data.summary, data.data.sales, channel, effectiveStoreId)
        : null,
    [data.data, data.isError, channel, effectiveStoreId],
  );
  useEffect(() => {
    if (!fullAds.data) return;
    const adId = new URLSearchParams(window.location.search).get("adId");
    if (adId) setSelected(fullAds.data.rows.find((row) => row.id === adId) ?? null);
  }, [fullAds.data]);
  useEffect(() => {
    if (!undo) return;
    const timeout = setTimeout(() => setUndo(null), Math.max(0, undo.until - Date.now()));
    return () => clearTimeout(timeout);
  }, [undo]);
  const enrich = useCallback(
    (row: AdsRow) => {
      const assignment = data.data?.summary.adProducts.find((ad) => ad.adId === row.id);
      const product = productData.data?.products.find((item) => item.id === assignment?.productId);
      const velocity = data.data?.sales.productVelocity
        .filter((item) => item.productId === product?.id)
        .reduce((sum, item) => sum + item.unitsPerDay, 0);
      const stockDays =
        product && velocity && velocity > 0 ? Number(product.availableStock) / velocity : null;
      const sevenDays = scaleData.data?.summary.days
        .filter((day) => day.adId === row.id)
        .sort((a, b) => a.date.localeCompare(b.date));
      let stable: boolean | null = null;
      if (sevenDays?.length) {
        const from = dayKey(subDays(parseISO(today), 6));
        const firstEnd = dayKey(addDays(parseISO(from), 2));
        const lastStart = dayKey(subDays(parseISO(today), 2));
        const rate = (records: typeof sevenDays) =>
          ratio(
            records.reduce((sum, day) => sum + (numeric(day.spend) ?? 0), 0),
            records.reduce((sum, day) => sum + (day.results ?? 0), 0),
          );
        const first = rate(sevenDays.filter((day) => day.date <= firstEnd));
        const last = rate(sevenDays.filter((day) => day.date >= lastStart));
        stable = first !== null && last !== null ? last <= first * 1.05 : null;
      }
      return {
        ...(!data.isError && data.data && daysForRow(row, data.data.summary).length
          ? channelRow(row, data.data.summary, channel)
          : row),
        stockDays,
        lastSpendAt: lastSpendAt(row, data.data?.summary),
        recentCostStable: stable ?? row.recentCostStable,
        product,
      };
    },
    [data.data, data.isError, productData.data, scaleData.data, today, channel],
  );
  const financialCalculator = useMemo(
    () => (scoped ? createAdFinancialCalculator(scoped.summary, scoped.sales) : null),
    [scoped],
  );
  const analyze = useCallback(
    (rows: AdsRow[]) =>
      rows.map(enrich).map((row) => {
        const value = financialCalculator?.(row) ?? null;
        const localDays = !data.isError && data.data ? daysForRow(row, data.data.summary) : [];
        const resolvedChannels = new Set(
          localDays
            .map((day) => day.channel)
            .filter((channel) => channel === "messages" || channel === "web"),
        );
        const channels = resolvedChannels.size ? resolvedChannels : catalogChannels(row);
        return {
          row,
          value,
          channels,
          state: value
            ? adStatus(row, value, settings!.rules, today, rowResultTotal(row, channels))
            : isMetaPaused(row)
              ? "Pausado"
              : "Sin datos suficientes",
          scalable: value ? canScale(row, value, settings!.rules, today) : false,
          scaleCandidate: value
            ? canScale(
                { ...row, stockDays: Number.MAX_SAFE_INTEGER },
                value,
                settings!.rules,
                today,
              )
            : false,
        };
      }),
    [enrich, financialCalculator, data.data, data.isError, settings!.rules, today],
  );
  const allItems = useMemo(() => analyze(fullAds.data?.rows ?? []), [analyze, fullAds.data]);
  const baseItems = useMemo(
    () => (catalog.data === fullAds.data ? allItems : analyze(catalog.data?.rows ?? [])),
    [catalog.data, fullAds.data, allItems, analyze],
  );
  const populationItems = useMemo(
    () =>
      baseItems
        .filter((item) => channel === "all" || item.channels.has(channel))
        .filter(
          (item) =>
            !search ||
            item.row.name.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es")),
        ),
    [baseItems, channel, search],
  );
  const populationCounts = {
    active: populationItems.filter((item) => isActiveAd(item.row)).length,
    spend: populationItems.filter((item) => (numeric(item.row.insights.spend) ?? 0) > 0).length,
    all: populationItems.length,
  };
  const items = useMemo(
    () =>
      sortAdItems(
        populationItems.filter(
          (item) =>
            (population === "all" ||
              (population === "active"
                ? isActiveAd(item.row)
                : (numeric(item.row.insights.spend) ?? 0) > 0)) &&
            (state === "Todos" ||
              (state === "Para escalar"
                ? item.scalable
                : state === "Escalando"
                  ? recentlyIncreased(item.row)
                  : item.state === state)),
        ),
        sort,
        STATUS_ORDER,
      ),
    [populationItems, population, state, sort],
  );
  const pageScope = JSON.stringify([
    fromDate,
    to,
    storeId,
    accountId,
    population,
    sort,
    level,
    view,
    channel,
    state,
    search,
    path,
  ]);
  const [paging, setPaging] = useState({ scope: pageScope, page: 1 });
  useEffect(() => setPaging({ scope: pageScope, page: 1 }), [pageScope]);
  const pageCount = Math.max(1, Math.ceil(items.length / 50));
  const currentPage = paging.scope === pageScope ? Math.min(paging.page, pageCount) : 1;
  const pageStart = (currentPage - 1) * 50;
  const orderedItems = useMemo(
    () =>
      view === "gallery"
        ? [...items].sort((a, b) => (b.value?.delivered ?? 0) - (a.value?.delivered ?? 0))
        : items,
    [items, view],
  );
  const pageItems = orderedItems.slice(pageStart, pageStart + 50);
  const totalSpend = items.some((item) => item.value?.spend == null)
    ? null
    : items.reduce((sum, item) => sum + item.value!.spend!, 0);
  function drill(row: AdsRow) {
    if (row.level === "ad") {
      setSelected(row);
      return;
    }
    const index = LEVELS.findIndex((item) => item.value === row.level);
    setPath((current) => [
      ...current.filter((item) => LEVELS.findIndex((level) => level.value === item.level) < index),
      { level: row.level, id: row.id, name: row.name },
    ]);
    setLevel(LEVELS[Math.min(index + 1, 4)].value);
    setState("Todos");
  }
  function applyView(savedView: AdsSavedView) {
    const value = savedView.state;
    if (LEVELS.some((item) => item.value === value.level)) setLevel(value.level as AdsLevel);
    setView(value.view ?? "performance");
    setState(value.status ?? "Todos");
    setChannel(value.channel ?? "all");
    if (value.from && value.to) setPeriod(value.from, value.to);
    if (value.storeId) setStoreId(value.storeId);
    if (value.adAccountId) setAccountId(value.adAccountId);
    setPopulation(value.population ?? "active");
    setSort(value.sort ?? "recent");
    setPath([]);
  }
  async function saveView() {
    if (!identity || !viewName.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await adsWrite(identity, "post", "/v22/views", {
        name: viewName.trim(),
        icon: "📌",
        state: {
          tab: "ads",
          from: fromDate,
          to: toDate,
          level,
          view,
          status: state,
          channel,
          storeId,
          adAccountId: accountId,
          population,
          sort,
        },
      });
      await refresh();
      setSaveOpen(false);
      setViewName("");
    } catch (failure) {
      setError(failure);
    } finally {
      setSaving(false);
    }
  }
  const lastSync =
    (catalog.data as typeof catalog.data & { lastSyncedAt?: string | null })?.lastSyncedAt ??
    catalog.data?.accounts
      .map(
        (account) =>
          (
            account as typeof account & {
              lastSyncedAt?: string | null;
              lastSuccessfulAt?: string | null;
            }
          ).lastSyncedAt ??
          (account as typeof account & { lastSuccessfulAt?: string | null }).lastSuccessfulAt ??
          account.coverage?.lastSuccessfulAt,
      )
      .filter((date): date is string => !!date)
      .sort()[0] ??
    null;
  const metaRateLimited = catalog.data?.accounts.some(
    (account) => account.coverage?.lastErrorCode === "PROVIDER_RATE",
  );
  const syncAge = lastSync
    ? Math.max(0, Math.floor((Date.now() - Date.parse(lastSync)) / 60_000))
    : null;
  const syncedLabel = lastSync
    ? new Intl.DateTimeFormat("es-PE", {
        timeZone: "America/Lima",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(lastSync))
    : null;
  async function syncNow() {
    if (!identity || syncing) return;
    setSyncing(true);
    setError(null);
    try {
      await adsWrite(identity, "post", "/meta/v22/module-sync", {
        from: dayKey(subDays(parseISO(today), 1)),
        to: today,
        ...(accountId !== "all" ? { accountId } : {}),
      });
      await refresh();
    } catch (failure) {
      setError(failure);
    } finally {
      setSyncing(false);
    }
  }
  const unassigned = allItems.filter((item) => !item.row.store?.id);
  const flagged = allItems.filter(
    (item) => item.state === "Sin resultados" || item.state === "Pierdes plata",
  );
  const scale = allItems.filter((item) => item.scalable);
  const stateCount = (item: string): number | "—" => {
    if (!fullAds.data || fullAds.isError) return "—";
    if (item === "Todos") return allItems.length;
    if (!allItems.length) return 0;
    if (item === "Pausado") return allItems.filter(({ row }) => isMetaPaused(row)).length;
    if (item === "Escalando") return allItems.filter(({ row }) => !!row.budget?.increasedAt).length;
    if (!data.data || data.isError) return "—";
    if (item === "Para escalar")
      return !scaleData.data || scaleData.isError || !productData.data || productData.isError
        ? "—"
        : scale.length;
    return allItems.filter((row) => row.state === item).length;
  };
  const metrics = allItems
    .map((item) => item.value)
    .filter((value): value is NonNullable<typeof value> => !!value);
  const tested = metrics.filter(
    (value) =>
      !value.evidence?.partial && value.maximum !== null && (value.spend ?? 0) >= value.maximum,
  );
  const winners = tested.filter(
    (value) =>
      value.costSale !== null &&
      value.maximum !== null &&
      value.costSale < (value.maximum * settings!.rules.winPct) / 100,
  );
  const actionRows = (row: AdsRow) =>
    row.level === "account" || row.level === "store"
      ? allItems
          .filter((item) =>
            row.level === "account" ? item.row.accountId === row.id : item.row.store?.id === row.id,
          )
          .map((item) => item.row)
      : [row];
  const exportRows = () =>
    items.map(({ row, value, state: rowState }) => {
      const tags = data.data?.summary.adProducts.find((item) => item.adId === row.id);
      return {
        Anuncio: row.name,
        Moneda: row.currency,
        Nivel: LEVELS.find((level) => level.value === row.level)?.label,
        Tienda: row.store?.name,
        Cuenta: catalog.data?.accounts.find((account) => account.id === row.accountId)?.name,
        Campaña: row.campaignId,
        Conjunto: row.adsetId,
        Canal: [
          ...new Set(
            data.data?.summary.days.filter((day) => day.adId === row.id).map((day) => day.channel),
          ),
        ].join(", "),
        Formato: row.creative?.format,
        Gancho: settings!.tags.hooks.find((tag) => tag.id === tags?.hookId)?.name,
        Creador: settings!.tags.creators.find((tag) => tag.id === tags?.creatorId)?.name,
        "Base del cálculo": value ? financialBasis(value) : undefined,
        "Cobertura de atribución": value?.evidence?.attributionCoverage,
        Observaciones: value ? financialCauses(value, permissions.profit).join(" ") : undefined,
        ...(permissions.profit ? { "Cobertura de costos": value?.evidence?.costCoverage } : {}),
        Estado:
          permissions.profit ||
          !["Rentable", "Pierdes plata", "Cerca del límite"].includes(rowState)
            ? rowState
            : "Activo",
        ...(permissions.spend
          ? {
              Gasto: numeric(row.insights.spend),
              "Costo por resultado mensajes": numeric(
                row.insights.resultMetrics?.messages.costPerResult,
              ),
              "Costo por resultado web": numeric(
                row.insights.resultMetrics?.webPurchases.costPerResult,
              ),
              "Costo por venta": value?.costSale,
              ROAS: value?.roas,
            }
          : {}),
        "Resultados mensajes": numeric(row.insights.resultMetrics?.messages.count),
        "Resultados web": numeric(row.insights.resultMetrics?.webPurchases.count),
        CTR: numeric(row.insights.ctr),
        Frecuencia: numeric(row.insights.frequency),
        Hook: creativeMetrics(row).hook,
        Hold: creativeMetrics(row).hold,
        ...(permissions.profit ? { Ganancia: value?.gain } : {}),
      };
    });
  if (fromDate > to)
    return <p className="p-6 text-sm">El período elegido todavía no tiene días transcurridos.</p>;
  return (
    <main className="space-y-4 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Anuncios</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Busca un anuncio o filtra su rendimiento. Abre el detalle para revisarlo.
          </p>
        </div>
        {catalog.isFetching && catalog.data && (
          <p role="status" className="text-xs text-muted-foreground">Actualizando catálogo…</p>
        )}
      </div>
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-xs text-muted-foreground"
        role="status"
      >
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`size-2 rounded-full ${metaRateLimited || (catalog.data && !syncedLabel) ? "bg-amber-500" : catalog.data ? "bg-primary" : "bg-muted-foreground/40"}`} aria-hidden="true" />
          {syncedLabel
            ? `Datos de Meta al ${syncedLabel} · ${syncAge !== null && syncAge < 60 ? `hace ${syncAge} min` : `hace ${Math.floor((syncAge ?? 0) / 60)} h`}`
            : catalog.data ? "Aún no hay una sincronización correcta registrada" : "Consultando catálogo guardado…"}
          {metaRateLimited && <span className="font-medium text-amber-800 dark:text-amber-300">· actualización limitada por Meta</span>}
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={syncing || !identity || catalog.data?.capabilities?.canSync !== true}
          onClick={() => void syncNow()}
        >
          {syncing ? "Actualizando…" : "Actualizar Meta"}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setState("Rentable");
            setView("performance");
            setLevel("ad");
            setPeriod(dayKey(subDays(parseISO(today), 6)), today);
          }}
        >
          🏆 Ganadores de la semana
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setState("Para escalar");
            setView("performance");
            setLevel("ad");
          }}
        >
          🚀 Para escalar
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setState("Sin resultados");
            setLevel("ad");
          }}
        >
          ⛔ Para pausar
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setView("creatives");
            setLevel("ad");
            setPeriod(`${today.slice(0, 7)}-01`, today);
          }}
        >
          🎬 Creativos del mes
        </Button>
        <Link
          className="inline-flex items-center rounded-md border px-3 text-xs"
          href={advertisingSectionHref("/publicidad/pruebas", fromDate, toDate, {
            storeId,
            ...(accountId !== "all" ? { adAccountId: accountId } : {}),
          })}
        >
          🧪 Pruebas
        </Link>
        {saved.data?.views.map((item) => (
          <div key={item.id} className="inline-flex rounded-md border">
            <Button size="sm" variant="ghost" onClick={() => applyView(item)}>
              {item.icon} {item.name}
            </Button>
            <button
              className="px-2 text-xs text-muted-foreground"
              aria-label={`Eliminar vista ${item.name}`}
              onClick={() => {
                if (!identity) return;
                void adsWrite(identity, "delete", `/v22/views/${item.id}`)
                  .then(refresh)
                  .catch(setError);
              }}
            >
              ×
            </button>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => setSaveOpen(true)}>
          + Guardar vista actual
        </Button>
      </div>
      {flagged.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <p>
            {flagged.filter((item) => item.state === "Sin resultados").length} anuncios sin
            resultados · {flagged.filter((item) => item.state === "Pierdes plata").length} pierden
            plata
            {permissions.spend
              ? ` · ${money(flagged.reduce((sum, item) => sum + (item.value?.spend ?? 0), 0))}`
              : ""}
          </p>
          <Button
            size="sm"
            variant="destructive"
            disabled={!canManageAds}
            onClick={() => setAction({ rows: flagged.map((item) => item.row), action: "pause" })}
          >
            Revisar y pausar
          </Button>
        </div>
      )}
      {scale.length > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
          <p>{scale.length} listos para escalar</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setState("Para escalar");
              setLevel("ad");
            }}
          >
            Ver
          </Button>
        </div>
      )}
      {undo && (
        <div
          role="status"
          className="flex items-center justify-between rounded-md border bg-card p-3 text-sm"
        >
          <span>Meta confirmó la pausa. Puedes deshacer durante 6 segundos.</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setAction({ rows: undo.rows, action: "activate", canManageAds: true });
              setUndo(null);
            }}
          >
            Deshacer
          </Button>
        </div>
      )}
      {permissions.edit && catalog.data && !canManageAds && (
        <p role="status" className="rounded-md border p-3 text-sm text-muted-foreground">
          {catalogAccountIds.size > 1
            ? "Esta vista incluye varias cuentas. Abre el detalle de un anuncio o filtra una cuenta para confirmar sus permisos de gestión."
            : META_MANAGEMENT_UNAVAILABLE}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
        <div className="relative min-w-48 flex-1 sm:min-w-64">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" aria-hidden="true" />
          <Input
            className="pl-9"
            aria-label="Buscar anuncios"
            placeholder="Buscar por nombre"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <SelectField
          label="Ver por"
          value={level}
          onChange={(value) => {
            setLevel(value as AdsLevel);
            if (value !== "ad") setView("performance");
            setPath([]);
          }}
          options={LEVELS}
        />
        <SelectField
          label="Canal"
          value={channel}
          onChange={setChannel}
          options={[
            { value: "all", label: "Todos" },
            { value: "messages", label: "Mensajes · WhatsApp + Instagram" },
            { value: "web", label: "Web · Shopify" },
          ]}
        />
        <SelectField
          label="Vista"
          value={view}
          onChange={setView}
          disabled={level !== "ad"}
          options={[
            { value: "performance", label: "Rendimiento" },
            { value: "creatives", label: "Creativos" },
            { value: "gallery", label: "Galería" },
          ]}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={!catalog.data}
          onClick={() =>
            void exportAdsWorkbook(`POWIP_Publicidad_Anuncios_${fromDate}_${to}`, [
              { name: "Anuncios", rows: exportRows() },
            ]).catch(setError)
          }
        >
          ↓ Excel
        </Button>
      </div>
      {path.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            className="text-primary"
            onClick={() => {
              setPath([]);
              setLevel("account");
            }}
          >
            Todas
          </button>
          {path.map((item, index) => (
            <button
              key={item.id}
              className="text-primary"
              onClick={() => {
                setPath((current) => current.slice(0, index));
                setLevel(item.level);
              }}
            >
              › {LEVELS.find((level) => level.value === item.level)?.label}: {item.name}
            </button>
          ))}
          <button
            aria-label="Limpiar ruta"
            onClick={() => {
              setPath([]);
              setLevel("ad");
            }}
          >
            ×
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
        <SelectField
          label="Mostrar"
          value={population}
          onChange={setPopulation}
          options={[
            { value: "active", label: `Activos (${populationCounts.active})` },
            { value: "spend", label: `Con gasto en el período (${populationCounts.spend})` },
            { value: "all", label: `Todos (${populationCounts.all})` },
          ]}
        />
        <SelectField
          label="Ordenar"
          value={sort}
          onChange={setSort}
          options={[
            { value: "recent", label: "Último activo" },
            { value: "spend", label: "Mayor gasto" },
            { value: "attention", label: "Qué atender primero" },
          ]}
        />
        </div>
        {catalog.data && <p className="pb-2 text-xs text-muted-foreground tabular-nums">{items.length} {items.length === 1 ? "resultado" : "resultados"}</p>}
      </div>
      <div className="flex gap-1 overflow-x-auto">
        {STATES.filter(
          (item) =>
            permissions.profit ||
            !["Para escalar", "Pierdes plata", "Cerca del límite", "Rentable"].includes(item),
        ).map((item) => (
          <Button
            key={item}
            size="sm"
            variant={state === item ? "secondary" : "ghost"}
            className="shrink-0"
            onClick={() => {
              setState(item);
              if (item === "Pausado") setPopulation("all");
            }}
          >
            {item}{" "}
            {stateCount(item)}
          </Button>
        ))}
      </div>
      {(data.data || metaRateLimited || unassigned.length > 0) && (
        <AdvertisingDataNotice
          title={metaRateLimited ? "Mostrando el catálogo guardado" : "Hay datos por completar"}
          action={<Link className="font-medium text-primary underline underline-offset-4" href={advertisingSectionHref("/publicidad/configuracion", fromDate, toDate, { storeId, ...(accountId !== "all" ? { adAccountId: accountId } : {}), section: "accounts" })}>Revisar</Link>}
          messages={[
            ...(metaRateLimited ? ["Meta limitó temporalmente las consultas. Puedes seguir revisando los anuncios; su actualización está pendiente."] : []),
            ...(unassigned.length ? [`${unassigned.length} anuncios sin tienda${permissions.spend ? ` · ${money(unassigned.reduce((sum, item) => sum + (numeric(item.row.insights.spend) ?? 0), 0))} de gasto` : ""}. Asigna su negocio en Configuración.`] : []),
            ...(data.data ? [...new Set([
              ...data.data.summary.quality.warnings,
              ...(!summarySpendAvailable(data.data.summary) && data.data.summary.quality.warnings.length === 0 ? ["META_DATA_PARTIAL"] : []),
            ])].map(dataWarning) : []),
          ]}
        />
      )}
      {data.data && (
        <div className="text-xs text-muted-foreground">
          {data.data.sales.totals.attributedOrders === 0 && (
            <p>
              Costos y ROAS estimados con ventas POWIP; faltan referencias de anuncio para medirlos.
            </p>
          )}
          {data.data.sales.totals.attributedOrders > 0 && (
            <p>
              {data.data.sales.totals.attributedOrders < data.data.sales.totals.orders
                ? "Medido parcial"
                : "Medido por anuncio"}{" "}
              · {pct(ratio(data.data.sales.totals.attributedOrders, data.data.sales.totals.orders))}{" "}
              de pedidos con anuncio identificado. Las ventas sin referencia se estiman por canal,
              descontando primero las ventas ya identificadas.
            </p>
          )}
        </div>
      )}
      {needsCreativeAverage && averageCatalog.isError && (
        <Failure error={averageCatalog.error} retry={averageCatalog.refetch} />
      )}
      {fullAds.isError && !catalog.isError && !data.isError && (
        <Failure error={fullAds.error} retry={fullAds.refetch} />
      )}
      {data.isError && <Failure error={data.error} retry={data.refetch} />}
      {catalog.data && !data.data && !data.isError && (
        <p role="status" className="text-sm text-muted-foreground">
          Anuncios cargados. Consultando ventas y rentabilidad…
        </p>
      )}
      {catalog.isError ? (
        <Failure error={catalog.error} retry={catalog.refetch} />
      ) : !catalog.data ? (
        <div className="rounded-lg border" aria-label="Cargando anuncios" role="status">
          {Array.from({ length: 7 }, (_, index) => (
            <div key={index} className="flex gap-4 border-b p-4">
              <Skeleton className="h-12 w-12" />
              <Skeleton className="h-12 flex-1" />
              <Skeleton className="h-12 w-24" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {view === "creatives" && (
            <>
              <div className="grid gap-3 sm:grid-cols-4">
                {permissions.profit && (
                  <MetricCard
                    label="Hit rate · ganadores / probados"
                    value={`${winners.length} de ${tested.length}`}
                    detail={pct(ratio(winners.length, tested.length))}
                  />
                )}
                <MetricCard label="Hook promedio · 30 días" value={pct(average.hook)} />
                <MetricCard label="Hold promedio · 30 días" value={pct(average.hold)} />
                <MetricCard label="CTR promedio · 30 días" value={decimal(average.ctr, "%")} />
                <MetricCard
                  label="Vida observada hasta cansarse"
                  value={decimal(
                    (averageCatalog.data?.rows ?? []).filter(
                      (row) => row.fatigueAt && row.lifetimeDays != null,
                    ).length
                      ? (averageCatalog.data?.rows ?? [])
                          .filter((row) => row.fatigueAt && row.lifetimeDays != null)
                          .reduce((sum, row) => sum + row.lifetimeDays!, 0) /
                          (averageCatalog.data?.rows ?? []).filter(
                            (row) => row.fatigueAt && row.lifetimeDays != null,
                          ).length
                      : null,
                    " días",
                  )}
                  detail="Sólo creativos con primera fatiga observada e historial real de entregas en Meta."
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {["format", "hook", "creator"].map((type) => (
                  <Block
                    key={type}
                    title={
                      type === "format"
                        ? "Hit rate por formato"
                        : type === "hook"
                          ? "Hit rate por gancho"
                          : "Hit rate por creador"
                    }
                  >
                    {[
                      ...new Set(
                        allItems.map((item) => {
                          const tags = data.data?.summary.adProducts.find(
                            (ad) => ad.adId === item.row.id,
                          );
                          return type === "format"
                            ? (item.row.creative?.format ?? "Sin formato")
                            : type === "hook"
                              ? (settings!.tags.hooks.find((tag) => tag.id === tags?.hookId)
                                  ?.name ?? "Sin etiqueta")
                              : (settings!.tags.creators.find((tag) => tag.id === tags?.creatorId)
                                  ?.name ?? "Sin etiqueta");
                        }),
                      ),
                    ].map((label) => {
                      const grouped = allItems.filter((item) => {
                        const tags = data.data?.summary.adProducts.find(
                          (ad) => ad.adId === item.row.id,
                        );
                        const name =
                          type === "format"
                            ? (item.row.creative?.format ?? "Sin formato")
                            : type === "hook"
                              ? (settings!.tags.hooks.find((tag) => tag.id === tags?.hookId)
                                  ?.name ?? "Sin etiqueta")
                              : (settings!.tags.creators.find((tag) => tag.id === tags?.creatorId)
                                  ?.name ?? "Sin etiqueta");
                        return name === label;
                      });
                      const testable = grouped.filter(
                        (item) =>
                          item.value?.maximum != null &&
                          (item.value.spend ?? 0) >= item.value.maximum,
                      );
                      const won = testable.filter(
                        (item) =>
                          item.value?.costSale != null &&
                          item.value?.maximum != null &&
                          item.value.costSale < (item.value.maximum * settings!.rules.winPct) / 100,
                      );
                      return (
                        <div key={label} className="text-xs">
                          {label} ·{" "}
                          {permissions.profit
                            ? `${won.length} de ${testable.length}`
                            : `${grouped.length} creativos`}
                          {permissions.profit && (
                            <progress
                              className="h-2 w-full"
                              max={Math.max(1, testable.length)}
                              value={won.length}
                            />
                          )}
                        </div>
                      );
                    })}
                  </Block>
                ))}
              </div>
            </>
          )}
          {view === "gallery" ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {pageItems.map(({ row, value, state: rowState }, index) => (
                <button
                  key={row.id}
                  className="overflow-hidden rounded-lg border bg-card text-left"
                  onClick={() => setSelected(row)}
                >
                  <div className="relative flex h-56 items-center justify-center bg-muted">
                    <AdThumbnail
                      adId={row.id}
                      accountId={row.accountId}
                      source={row.creative?.thumbnailUrl ?? row.creative?.imageUrl}
                      name={row.name}
                      className="h-full w-full"
                    />
                    <span className="absolute left-3 top-3 rounded bg-background px-2 py-1 text-xs">
                      #{pageStart + index + 1} · {rowState}
                    </span>
                  </div>
                  <div className="space-y-3 p-4">
                    <h3 className="font-medium">{row.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {row.store?.name} · {row.creative?.format}
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      {permissions.spend && (
                        <>
                          <span>
                            Gasto
                            <br />
                            {money(value ? value.spend : numeric(row.insights.spend), row.currency)}
                          </span>
                          <span>
                            C. venta
                            <br />
                            {money(value?.costSale, row.currency)}
                          </span>
                          <span>
                            ROAS
                            <br />
                            {decimal(value?.roas, "×")}
                          </span>
                        </>
                      )}
                      <span>
                        Hook
                        <br />
                        {row.creative?.format === "video" ? pct(creativeMetrics(row).hook) : "—"}
                      </span>
                      <span>
                        Hold
                        <br />
                        {row.creative?.format === "video" ? pct(creativeMetrics(row).hold) : "—"}
                      </span>
                      <span>
                        CTR
                        <br />
                        {decimal(numeric(row.insights.ctr), "%")}
                      </span>
                    </div>
                    <p className="text-xs">
                      {diagnosis(row, average, undefined, settings!.rules.highFrequency).label}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-card" aria-label="Resultados de anuncios" aria-busy={catalog.isFetching}>
              <table className="w-full text-sm [&_td]:p-3 [&_th]:p-3">
                <thead className="bg-muted/60">
                  <tr>
                    {[
                      view === "creatives" ? "Creativo" : "Nombre",
                      view === "creatives" ? "Diagnóstico" : "Estado y qué hacer",
                      ...(view === "creatives"
                        ? ["Formato", "Hook", "Hold", "CTR", "Conv."]
                        : [
                            ...(permissions.spend ? ["Gasto"] : []),
                            "Resultados · costo",
                            "CTR",
                            "Frecuencia",
                          ]),
                      ...(permissions.spend
                        ? [
                            (scoped?.sales.totals.attributedOrders ?? 0) > 0
                              ? "Costo por venta"
                              : "C. venta est.",
                            "ROAS",
                          ]
                        : []),
                      ...(permissions.profit ? ["Ganancia"] : []),
                      ...((scoped?.sales.totals.attributedOrders ?? 0) > 0
                        ? ["Pedidos POWIP", "Entregados"]
                        : []),
                      "Acciones",
                    ].map((label, index) => (
                      <th key={label} scope="col" className={`whitespace-nowrap text-left text-xs ${index === 0 ? "bg-muted sm:sticky sm:left-0 sm:z-20 sm:shadow-[1px_0_0_var(--border)]" : ""}`}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map(
                    ({ row, value, state: rowState, scalable, scaleCandidate, channels }) => {
                      const metric = creativeMetrics(row);
                      const lowData = (metric.impressions ?? 0) < 1000;
                      return (
                        <tr key={row.id} className="group/row border-t align-top hover:bg-muted/20">
                          <td className="min-w-48 max-w-80 bg-card group-hover/row:bg-muted sm:sticky sm:left-0 sm:z-10 sm:min-w-64 sm:shadow-[1px_0_0_var(--border)]">
                            <button
                              className="flex items-center gap-3 text-left"
                              onClick={() => drill(row)}
                            >
                              {row.level === "ad" && (
                                <AdThumbnail
                                  adId={row.id}
                                  accountId={row.accountId}
                                  source={row.creative?.thumbnailUrl}
                                  name={row.name}
                                />
                              )}
                              <span>
                                <span className="block font-medium text-primary">{row.name}</span>
                                <span className="block text-xs text-muted-foreground">
                                  {row.store?.name ?? "Sin tienda"}
                                  {row.product ? ` · ${row.product.name}` : ""}
                                  {row.level === "ad" && adAge(row, today) !== null
                                    ? ` · ${adAge(row, today)} días`
                                    : ""}
                                  {row.parentAdId ? " · variación" : ""}
                                </span>
                                <span
                                  className="block text-xs text-muted-foreground"
                                  title="Última hora o fecha con gasto positivo registrado en POWIP"
                                >
                                  Último gasto: {lastSpendLabel(row, data.data?.summary, today)}
                                </span>
                              </span>
                            </button>
                          </td>
                          <td className="min-w-44 text-xs">
                            {view === "creatives" ? (
                              diagnosis(row, average, undefined, settings!.rules.highFrequency)
                                .label
                            ) : (
                              <>
                                <span
                                  className={`font-medium ${permissions.profit && rowState === "Pierdes plata" ? "text-red-600" : permissions.profit && rowState === "Rentable" ? "text-emerald-600" : ""}`}
                                >
                                  {permissions.profit ||
                                  !["Rentable", "Pierdes plata", "Cerca del límite"].includes(
                                    rowState,
                                  )
                                    ? rowState
                                    : "Activo"}
                                </span>
                                {recentlyIncreased(row) && (
                                  <span
                                    className="ml-2 text-blue-600"
                                    title="El presupuesto de su conjunto o campaña aumentó en los últimos siete días."
                                  >
                                    · Escalando
                                  </span>
                                )}
                                {((numeric(row.insights.frequency) ?? 0) >=
                                  settings!.rules.highFrequency ||
                                  (row.ctrDecline ?? 0) >= 0.25) && (
                                  <span
                                    className="ml-2 text-amber-600"
                                    title="Frecuencia alta o caída de CTR de al menos 25%."
                                  >
                                    · Cansado
                                  </span>
                                )}
                                <p
                                  className="mt-1 line-clamp-2 max-w-64 text-muted-foreground"
                                  title={[
                                    rowState === "Pausado"
                                      ? metaPauseDescription(row)
                                      : rowState === "Aprendizaje"
                                        ? `Tiene ${adAge(row, today) ?? "pocos"} días. Espera antes de decidir.`
                                        : rowState === "Sin resultados"
                                          ? "Revisa y pausa."
                                          : scalable
                                            ? "Puedes subir 20%."
                                            : scaleCandidate
                                              ? row.stockDays == null
                                                ? "Verifica stock antes de escalar."
                                                : `Solo ${decimal(row.stockDays)} días de stock: repón antes de escalar.`
                                              : rowState === "Pierdes plata"
                                                ? "Baja presupuesto o pausa."
                                                : rowState === "Cerca del límite"
                                                  ? "No le subas presupuesto."
                                                  : "Todavía no hay ventas suficientes para decidir.",
                                    ...(value
                                      ? [
                                          financialBasis(value),
                                          ...financialCauses(value, permissions.profit),
                                        ]
                                      : []),
                                  ].join(" ")}
                                >
                                  {rowState === "Pausado"
                                    ? metaPauseDescription(row)
                                    : rowState === "Aprendizaje"
                                      ? "Espera antes de decidir."
                                      : rowState === "Sin resultados"
                                        ? "Revisa y pausa."
                                        : scalable
                                          ? "Puedes subir 20%."
                                          : scaleCandidate
                                            ? row.stockDays == null
                                              ? "Verifica stock antes de escalar."
                                              : `Solo ${decimal(row.stockDays)} días de stock: repón antes de escalar.`
                                            : rowState === "Pierdes plata"
                                              ? "Baja presupuesto o pausa."
                                              : rowState === "Cerca del límite"
                                                ? "No le subas presupuesto."
                                                : value
                                                  ? financialBasis(value)
                                                  : "Consulta las ventas para medir."}
                                </p>
                              </>
                            )}
                          </td>
                          {view === "creatives" ? (
                            <>
                              <td>{row.creative?.format ?? "—"}</td>
                              {[metric.hook, metric.hold].map((value, index) => (
                                <td key={index} className={lowData ? "text-muted-foreground" : ""}>
                                  {row.creative?.format === "video" ? pct(value) : "—"}
                                  {lowData && row.creative?.format === "video" && (
                                    <span className="block text-xs">poca data</span>
                                  )}
                                </td>
                              ))}
                              <td>
                                {decimal(metric.ctr, "%")}
                                {lowData && (
                                  <span className="block text-xs text-muted-foreground">
                                    poca data
                                  </span>
                                )}
                              </td>
                              <td>
                                {pct(metric.conversion)}
                                {(metric.clicks ?? 0) < 30 && (
                                  <span className="block text-xs text-muted-foreground">
                                    poca data
                                  </span>
                                )}
                              </td>
                            </>
                          ) : (
                            <>
                              {permissions.spend && (
                                <td className="whitespace-nowrap tabular-nums">
                                  {money(
                                    value ? value.spend : numeric(row.insights.spend),
                                    row.currency,
                                  )}
                                </td>
                              )}
                              <td className="min-w-40 text-xs">
                                {[...channels].every(
                                  (item) => item !== "messages" && item !== "web",
                                ) && (
                                  <p title="El catálogo local todavía no confirma el destino ni el tipo de resultado de este anuncio.">
                                    —
                                  </p>
                                )}
                                {[...channels]
                                  .filter((item) => item !== "other")
                                  .map((item) => (
                                    <p key={item}>
                                      {item === "web" ? "Web" : "Mensajes"}:{" "}
                                      {decimal(resultCount(row, item))}
                                      {permissions.spend && (
                                        <span className="block text-muted-foreground">
                                          {money(
                                            numeric(
                                              row.insights.resultMetrics?.[
                                                item === "web" ? "webPurchases" : "messages"
                                              ].costPerResult,
                                            ),
                                          )}{" "}
                                          c/u
                                        </span>
                                      )}
                                    </p>
                                  ))}
                              </td>
                              <td>{decimal(numeric(row.insights.ctr), "%")}</td>
                              <td
                                className={
                                  (numeric(row.insights.frequency) ?? 0) >=
                                  settings!.rules.highFrequency
                                    ? "text-red-600"
                                    : ""
                                }
                                title={
                                  row.insights.frequency == null && row.level === "store"
                                    ? "Meta no calcula frecuencia conjunta entre cuentas. No se promedia."
                                    : "Dato directo de Meta para este nivel y rango"
                                }
                              >
                                {decimal(numeric(row.insights.frequency))}
                              </td>
                            </>
                          )}
                          {permissions.spend && (
                            <>
                              <td>{money(value?.costSale, row.currency)}</td>
                              <td>{decimal(value?.roas, "×")}</td>
                            </>
                          )}
                          {permissions.profit && (
                            <td
                              className={
                                value?.gain == null
                                  ? "text-muted-foreground"
                                  : value.gain < 0
                                    ? "text-red-600"
                                    : "text-emerald-600"
                              }
                            >
                              {money(value?.gain)}
                            </td>
                          )}
                          {(scoped?.sales.totals.attributedOrders ?? 0) > 0 && (
                            <>
                              <td>{decimal(value?.orders)}</td>
                              <td>{decimal(value?.delivered)}</td>
                            </>
                          )}
                          <td>
                            <div className="flex min-w-28 flex-wrap gap-1">
                              {permissions.edit && !canManageAds && row.level === "ad" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setSelected(row)}
                                >
                                  Gestionar en detalle
                                </Button>
                              )}
                              {row.level === "ad" && view === "creatives" && canManageAds && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setSelected(row)}
                                >
                                  Variación
                                </Button>
                              )}
                              {canManageAds && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      setAction({
                                        rows: actionRows(row),
                                        action:
                                          row.effectiveStatus === "PAUSED" ? "activate" : "pause",
                                      })
                                    }
                                  >
                                    {row.effectiveStatus === "PAUSED" ? "▶ Activar" : "⏸ Pausar"}
                                  </Button>
                                  {row.budget && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        setAction({
                                          rows: [row],
                                          action: scalable ? "scale" : "budget",
                                        })
                                      }
                                    >
                                      {scalable ? "🚀 +20%" : "S/"}
                                    </Button>
                                  )}
                                  {row.level === "adset" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        setAction({ rows: [row], action: "duplicate" })
                                      }
                                    >
                                      Duplicar
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    },
                  )}
                  {level !== "ad" && (
                    <tr className="border-t bg-muted/60 font-semibold">
                      <td>Total · {items.length} grupos</td>
                      <td colSpan={view === "performance" ? 1 : 5}>
                        {permissions.spend ? money(totalSpend) : ""}
                      </td>
                      <td colSpan={12} className="text-xs font-normal text-muted-foreground">
                        Los resultados se conservan por canal. Frecuencia y alcance no se suman.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {items.length === 0 && (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  {!catalog.data.accounts.length
                    ? "Falta conectar una cuenta publicitaria."
                    : population === "active"
                      ? "Sin anuncios activos para estos filtros. Revisa Con gasto en el período o Todos."
                      : population === "spend"
                        ? "Sin anuncios con gasto en este período."
                        : "No hay anuncios para estos filtros."}
                </p>
              )}
            </div>
          )}
        </>
      )}
      {catalog.data && items.length > 0 && (
        <nav
          aria-label="Páginas de anuncios"
          className="flex flex-wrap items-center justify-between gap-3 text-sm"
        >
          <p>
            Mostrando {pageStart + 1}–{Math.min(pageStart + 50, items.length)} de {items.length}
          </p>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              aria-label="Página anterior"
              disabled={currentPage === 1}
              onClick={() => setPaging({ scope: pageScope, page: currentPage - 1 })}
            >
              Anterior
            </Button>
            <span>
              Página {currentPage} de {pageCount}
            </span>
            <Button
              size="sm"
              variant="outline"
              aria-label="Página siguiente"
              disabled={currentPage === pageCount}
              onClick={() => setPaging({ scope: pageScope, page: currentPage + 1 })}
            >
              Siguiente
            </Button>
          </div>
        </nav>
      )}
      <AdsTodayDisclosure />
      {error != null && <Failure error={error} />}
      <AdvertisingActionDialog
        selection={action}
        onClose={() => setAction(null)}
        onPaused={(rows) => setUndo({ rows, until: Date.now() + 6000 })}
      />
      {selected && (
        <AdvertisingAdDetail
          row={selected}
          from={fromDate}
          to={to}
          summary={scoped?.summary}
          sales={scoped?.sales}
          average={average}
          onClose={() => setSelected(null)}
          onAction={setAction}
        />
      )}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Guardar vista actual</DialogTitle>
            <DialogDescription>
              La vista conserva nivel, estado, canal, fechas y tienda para tu usuario.
            </DialogDescription>
          </DialogHeader>
          <Input
            aria-label="Nombre de la vista"
            value={viewName}
            onChange={(event) => setViewName(event.target.value)}
            maxLength={80}
          />
          {error != null && <Failure error={error} />}
          <Button disabled={!viewName.trim() || saving} onClick={() => void saveView()}>
            {saving ? "Guardando…" : "Guardar vista"}
          </Button>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function AdsTodayDisclosure() {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="group rounded-xl border bg-card"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
        <Clock3 className="size-4 text-muted-foreground" aria-hidden="true" />
        Comparar hoy con ayer
        <span className="ml-auto text-xs font-normal text-muted-foreground">Por hora</span>
        <ChevronDown className="size-4 group-open:rotate-180" aria-hidden="true" />
      </summary>
      {open && <div className="border-t p-3"><TodayStrip /></div>}
    </details>
  );
}

export function TodayStrip() {
  const { settings } = useAdsV22();
  const { storeId } = useAdvertisingStoreFilter();
  const { accountId } = useAdvertisingAccountFilter();
  const today = limaToday();
  const yesterday = dayKey(subDays(parseISO(today), 1));
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Lima",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date()),
  );
  const sales = useNumbers(
    yesterday,
    today,
    storeId,
    "today",
    accountId !== "all" ? accountId : undefined,
  );
  const scopes = [yesterday, today].map((date) =>
    sales.data
      ? hourlySpendScope(sales.data.summary, storeId, date)
      : { date, available: false, accountIds: [] as string[] },
  );
  const accountIds = [
    ...new Set(scopes.filter((scope) => scope.available).flatMap((scope) => scope.accountIds)),
  ].sort();
  const hourly = useAdsQuery(
    ["hourly", today, storeId, scopes],
    async (id, signal) => {
      const batches = await Promise.all(
        accountIds.map((accountId) =>
          adsGet<{
            rows: Array<{ date: string; hour: number; spend: string; adId?: string }>;
            timeZone: string;
            availability?: "available" | "not_synced";
          }>(id, "/meta/v22/hourly", { from: yesterday, to: today, accountId }, signal),
        ),
      );
      if (batches.some((batch) => batch.timeZone !== "America/Lima"))
        throw new Error(
          "La comparación por hora requiere cuentas con la misma zona horaria de los pedidos (Perú).",
        );
      const selectedAds = new Set(sales.data?.summary.days.map((day) => `${day.date}:${day.adId}`));
      return {
        available: batches.every((batch) => batch.availability !== "not_synced"),
        rows: batches
          .flatMap((batch) => batch.rows)
          .filter(
            (row) =>
              storeId === "all" || (!!row.adId && selectedAds.has(`${row.date}:${row.adId}`)),
          ),
      };
    },
    !!sales.data && settings!.capabilities.spend && accountIds.length > 0,
  );
  const rowsForDate = (date: string) => {
    const scope = scopes.find((scope) => scope.date === date);
    if (!scope?.available) return null;
    if (scope.accountIds.length === 0) return [];
    return hourly.data?.available ? hourly.data.rows.filter((row) => row.date === date) : null;
  };
  const chart = Array.from({ length: 24 }, (_, index) => ({
    hour: index,
    today:
      rowsForDate(today)
        ?.filter((row) => row.hour === index)
        .reduce((sum, row) => sum + Number(row.spend), 0) ?? null,
    yesterday:
      rowsForDate(yesterday)
        ?.filter((row) => row.hour === index)
        .reduce((sum, row) => sum + Number(row.spend), 0) ?? null,
  }));
  const spent = (date: string) =>
    rowsForDate(date)
      ?.filter((row) => row.hour < hour)
      .reduce((sum, row) => sum + Number(row.spend), 0) ?? null;
  const orders = (date: string) =>
    sales.data?.sales.hourly
      ?.filter((row) => row.date === date && row.hour < hour && row.channel !== "other")
      .reduce((sum, row) => sum + row.orders, 0) ?? null;
  const current = spent(today);
  const previous = spent(yesterday);
  const todayOrders = orders(today);
  const yesterdayOrders = orders(yesterday);
  return (
    <Block
      title={`Hoy · comparación de horas cerradas hasta las ${String(hour).padStart(2, "0")}:00`}
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="grid grid-cols-3 gap-3">
          {settings!.capabilities.spend && (
            <div>
              <p className="text-xs text-muted-foreground">Gasto</p>
              <p className="text-lg font-semibold">{money(current)}</p>
              <p className="text-xs">
                {pct(current !== null && previous ? (current - previous) / previous : null)} vs.
                ayer
              </p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground">Pedidos</p>
            <p className="text-lg font-semibold">{decimal(todayOrders)}</p>
            <p className="text-xs">
              {pct(
                todayOrders !== null && yesterdayOrders
                  ? (todayOrders - yesterdayOrders) / yesterdayOrders
                  : null,
              )}{" "}
              vs. ayer
            </p>
          </div>
          {settings!.capabilities.spend && (
            <div>
              <p className="text-xs text-muted-foreground">CPV · costo por venta</p>
              <p className="text-lg font-semibold">{money(ratio(current, todayOrders))}</p>
            </div>
          )}
        </div>
        {settings!.capabilities.spend && (
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="yesterday" name="Ayer" fill="#cbd5e1" />
                <Bar dataKey="today" name="Hoy" fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      {hourly.isError && <Failure error={hourly.error} retry={hourly.refetch} />}
      {hourly.data?.available === false && (
        <p role="status" className="text-xs text-muted-foreground">
          El desglose por hora aún no está sincronizado. Actualiza Meta para consultar hoy y ayer.
        </p>
      )}
      {settings!.capabilities.spend && sales.data && scopes.some((scope) => !scope.available) && (
        <p role="status" className="text-xs text-muted-foreground">
          {scopes
            .filter((scope) => !scope.available)
            .map(
              (scope) =>
                `${scope.date}: ${spendAvailabilityDetail(sales.data!.summary, storeId, scope.date)}`,
            )
            .join(" · ")}
          . El desglose horario conserva pendientes los importes sin cobertura confirmada.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Las barras muestran 0–23 h. La comparación excluye la hora en curso para comparar el mismo
        tiempo transcurrido.
      </p>
    </Block>
  );
}
