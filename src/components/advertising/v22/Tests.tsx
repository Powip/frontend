"use client";
import { useEffect, useRef, useState } from "react";
import { FlaskConical, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  adsGet,
  adsWrite,
  decideAdsTest,
  getAllAdsCatalog,
  type AdsProduct,
  type AdsTest,
  type AdProduct,
} from "@/services/advertisingV22Service";
import { useAdvertisingStoreFilter } from "../AdvertisingStoreFilterContext";
import { useAdvertisingAccountFilter } from "../AdvertisingAccountFilterContext";
import { useAdsQuery, useAdsV22, useRefreshAds } from "./context";
import {
  adFinancial,
  financial,
  sumSales,
  summarySpendAvailable,
  dayKey,
  decimal,
  limaToday,
  money,
  numeric,
  ratio,
} from "./model";
import { Block, Failure, MetricCard, SelectField } from "./shared";
import { useNumbers } from "./Numbers";
import { parseISO, subDays } from "date-fns";
import { META_MANAGEMENT_UNAVAILABLE } from "./Actions";

export function AdvertisingTests() {
  const { identity, settings } = useAdsV22();
  const { storeId, stores } = useAdvertisingStoreFilter();
  const { accountId } = useAdvertisingAccountFilter();
  const refresh = useRefreshAds();
  const [newTest, setNewTest] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const [productId, setProductId] = useState("");
  const [adsetId, setAdsetId] = useState("");
  const [testStoreId, setTestStoreId] = useState(() =>
    stores.some((store) => store.id === storeId) ? storeId : "",
  );
  const [start, setStart] = useState(limaToday());
  const pagingScope = `${storeId}:${accountId}`;
  const [paging, setPaging] = useState({ storeId: pagingScope, page: 1 });
  const tests = useAdsQuery(["tests", storeId], (id, signal) =>
    adsGet<{ tests: AdsTest[] }>(id, "/v22/tests", { storeId }, signal),
  );
  const products = useAdsQuery(["products-v22", storeId], (id, signal) =>
    adsGet<{ products: AdsProduct[] }>(id, "/v22/products", { storeId }, signal),
  );
  const canOpenCreate = settings!.capabilities.edit && stores.length > 0;
  const canCreate = settings!.capabilities.edit && stores.some((store) => store.id === testStoreId);
  const testProducts = useAdsQuery(
    ["test-create-products", testStoreId],
    (id, signal) =>
      adsGet<{ products: AdsProduct[] }>(id, "/v22/products", { storeId: testStoreId }, signal),
    newTest && canCreate,
  );
  const ads = useAdsQuery(
    ["tests-catalog", testStoreId, accountId],
    (id, signal) =>
      getAllAdsCatalog(
        id,
        {
          from: dayKey(subDays(parseISO(limaToday()), 29)),
          to: limaToday(),
          storeId: testStoreId,
          accountId: accountId === "all" ? undefined : accountId,
          level: "ad",
        },
        signal,
      ),
    newTest && canCreate,
  );
  const allowed = settings!.capabilities.edit;
  useEffect(() => {
    setNewTest(false);
    setProductId("");
    setAdsetId("");
    setTestStoreId(stores.some((store) => store.id === storeId) ? storeId : "");
  }, [storeId, accountId]);
  const list = (tests.data?.tests ?? []).filter(
    (test) => accountId === "all" || test.accountId === accountId,
  );
  const earliestStart = list.map((test) => test.startAt.slice(0, 10)).sort()[0] ?? limaToday();
  const testsReady = !!tests.data && !tests.isError;
  const measurement = useNumbers(
    earliestStart, limaToday(), storeId, "tests-summary", accountId,
    testsReady && list.length > 0,
  );
  const adAssignments = useAdsQuery(
    ["ad-products"],
    (id, signal) => adsGet<{ assignments: AdProduct[] }>(id, "/v22/ad-products", undefined, signal),
    testsReady && list.length === 0,
  );
  const suggestionsReady = testsReady && list.length === 0 &&
    !!adAssignments.data && !adAssignments.isError;
  const testedProducts = new Set(
    (adAssignments.data?.assignments ?? measurement.data?.summary.adProducts ?? [])
      .map((assignment) => assignment.productId),
  );
  const testDays = measurement.data?.summary.days.filter((day) =>
    list.some(
      (test) =>
        test.accountId === day.accountId &&
        test.adIds.includes(day.adId) &&
        day.date >= test.startAt.slice(0, 10),
    ),
  );
  const spentInTests =
    measurement.data &&
    !measurement.isError &&
    summarySpendAvailable(measurement.data.summary, storeId) &&
    testDays &&
    testDays.every((day) => day.currency === "PEN" && numeric(day.spend) !== null)
      ? testDays.reduce((sum, day) => sum + (numeric(day.spend) ?? 0), 0)
      : null;
  const suggestions = (products.data?.products ?? [])
    .filter(
      (product) =>
        !testedProducts.has(product.id) &&
        !list.some((test) => test.productId === product.id) &&
        (product.canTest ??
          (numeric(product.unitCost) !== null ||
            product.variants.some((variant) => numeric(variant.unitCost) !== null))),
    )
    .slice(0, 3);
  const pageCount = Math.max(1, Math.ceil(list.length / 10));
  const currentPage = paging.storeId === pagingScope ? Math.min(paging.page, pageCount) : 1;
  const pageStart = (currentPage - 1) * 10;
  const visibleTests = list.slice(pageStart, pageStart + 10);
  const eligibleProducts = (products.data?.products ?? []).filter(
    (product) =>
      product.canTest ??
      (numeric(product.unitCost) !== null ||
        product.variants.some((variant) => numeric(variant.unitCost) !== null)),
  );
  const eligibleTestProducts = canCreate
    ? (testProducts.data?.products ?? []).filter(
        (product) =>
          product.canTest ??
          (numeric(product.unitCost) !== null ||
            product.variants.some((variant) => numeric(variant.unitCost) !== null)),
      )
    : [];
  async function create() {
    if (!identity || !productId || !adsetId || pending || !canCreate) return;
    const selected = eligibleTestProducts.find((row) => row.id === productId);
    if (!selected) return;
    const selectedAds = (ads.data?.rows ?? []).filter(
      (row) => row.adsetId === adsetId && row.store?.id === testStoreId,
    );
    if (!selectedAds.length) {
      setError(new Error("El conjunto debe tener anuncios asignados a la tienda del producto."));
      return;
    }
    if (
      new Set(selectedAds.map((row) => row.accountId)).size !== 1 ||
      (accountId !== "all" && !selectedAds.every((row) => row.accountId === accountId))
    ) {
      setError(
        new Error(
          "Los anuncios del conjunto no pertenecen a la cuenta seleccionada. Actualiza la selección antes de crear la prueba.",
        ),
      );
      return;
    }
    setPending(true);
    setError(null);
    try {
      await adsWrite(identity, "post", "/v22/tests", {
        productId,
        accountId: selectedAds[0].accountId,
        storeId: testStoreId,
        adsetId,
        adIds: selectedAds.map((row) => row.id),
        startAt: `${start}T00:00:00-05:00`,
      });
      await refresh();
      setNewTest(false);
    } catch (failure) {
      setError(failure);
    } finally {
      setPending(false);
    }
  }
  if (tests.isError)
    return (
      <div className="p-6">
        <Failure error={tests.error} retry={tests.refetch} />
      </div>
    );
  return (
    <main className="space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Pruebas de productos</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Cada prueba se mide desde su inicio, independientemente del período de Anuncios.
          </p>
        </div>
        <Button disabled={!canOpenCreate} onClick={() => setNewTest(true)}>
          Nueva prueba
        </Button>
      </div>
      {allowed && !canOpenCreate && (
        <p role="status" className="text-sm text-muted-foreground">
          Configura una tienda comercial antes de crear una prueba.
        </p>
      )}
      {!tests.data ? (
        <div role="status" aria-label="Cargando pruebas" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)}
        </div>
      ) : <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard
          label="Pruebas activas"
          value={list.filter((test) => test.status === "active").length}
        />
        <MetricCard
          label="Ganadores en escala"
          value={list.filter((test) => test.status === "scaled").length}
        />
        <MetricCard
          label="Hit rate con veredicto aplicado"
          value={decimal(
            ratio(
              list.filter((test) => test.status === "scaled").length * 100,
              list.filter((test) => test.status !== "active").length,
            ),
            "%",
          )}
        />
        <MetricCard
          label="Gastado en pruebas"
          value={tests.data && list.length === 0 ? money(0) : money(spentInTests)}
          detail="Desde el inicio de cada prueba; cada anuncio y día se cuenta una vez."
        />
      </div>}
      {error != null && <Failure error={error} />}
      {products.isError && <Failure error={products.error} retry={products.refetch} />}
      {adAssignments.isError && <Failure error={adAssignments.error} retry={adAssignments.refetch} />}
      {!tests.data && <Skeleton className="h-48 rounded-xl" />}
      <Block title="Pruebas y veredictos">
        <div className="space-y-4">
          {visibleTests.map((test) => (
            <TestRow
              key={test.id}
              test={test}
              product={products.data?.products.find((product) => product.id === test.productId)}
            />
          ))}
          {tests.data && list.length === 0 && (
            <div className="space-y-5">
              <div className="flex items-start gap-4 rounded-xl border border-dashed bg-muted/20 p-5">
                <div className="rounded-xl border bg-card p-3 text-primary"><FlaskConical className="size-5" aria-hidden="true" /></div>
                <div>
                  <h3 className="font-semibold">Tu primera prueba empieza con un producto</h3>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    Todavía no hay pruebas en esta tienda. Elige un producto y sus anuncios para seguir su rendimiento y decidir si escalar o descartar.
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">Cada prueba conserva sus resultados desde la fecha en que empieza.</p>
                </div>
              </div>
              {(!suggestionsReady || !products.data) && !products.isError && !adAssignments.isError && <p role="status" className="text-xs text-muted-foreground">Buscando productos listos para probar…</p>}
              {suggestionsReady && suggestions.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-3">
                  {suggestions.map((product) => {
                    const storeMetric = (measurement.data?.sales.byStore ?? []).find(
                      (row) => row.storeId === product.storeId,
                    );
                    const unitsPerOrder = storeMetric
                      ? ratio(storeMetric.units, storeMetric.orders)
                      : null;
                    const shippingPerOrder = storeMetric
                      ? ratio(numeric(storeMetric.shippingCost), storeMetric.delivered)
                      : null;
                    const price = numeric(product.netPrice),
                      cost = numeric(product.unitCost);
                    const maximum =
                      price !== null &&
                      cost !== null &&
                      unitsPerOrder !== null &&
                      shippingPerOrder !== null
                        ? (price - cost) * unitsPerOrder - shippingPerOrder
                        : null;
                    return (
                      <div key={product.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40">
                        <p className="w-fit rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">Listo para preparar</p>
                        <p className="flex-1 font-medium leading-snug">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {stores.find((store) => store.id === product.storeId)?.name} · Con costo,
                          sin anuncios
                        </p>
                        {settings!.capabilities.profit && (
                          <p
                            className="text-xs"
                            title={
                              maximum === null
                                ? "Faltan unidades por pedido o envío histórico de la tienda para calcular el máximo."
                                : "Referencia estimada con el precio y costo actuales y los promedios de la tienda."
                            }
                          >
                            Máximo por venta: {money(maximum)}
                            {maximum !== null ? " · Estimado" : ""}
                          </p>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-1 justify-between"
                          disabled={!canOpenCreate}
                          onClick={() => {
                            setTestStoreId(product.storeId);
                            setProductId(product.id);
                            setAdsetId("");
                            setNewTest(true);
                          }}
                        >
                          Probar
                          <ArrowRight className="size-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
              {suggestionsReady && products.data && suggestions.length === 0 && (
                <p className="text-sm text-muted-foreground">Revisa tus productos y sus asignaciones para preparar una nueva prueba.</p>
              )}
            </div>
          )}
        </div>
      </Block>
      {list.length > 10 && (
        <nav
          aria-label="Páginas de pruebas"
          className="flex flex-wrap items-center justify-between gap-3 text-sm"
        >
          <p>
            Mostrando {pageStart + 1}–{Math.min(pageStart + 10, list.length)} de {list.length}{" "}
            pruebas
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setPaging({ storeId: pagingScope, page: currentPage - 1 })}
            >
              Anterior
            </Button>
            <span>
              Página {currentPage} de {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === pageCount}
              onClick={() => setPaging({ storeId: pagingScope, page: currentPage + 1 })}
            >
              Siguiente
            </Button>
          </div>
        </nav>
      )}
      <Dialog open={newTest && canOpenCreate} onOpenChange={setNewTest}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva prueba</DialogTitle>
            <DialogDescription>
              Elige la tienda de esta prueba, un producto con costo y sus anuncios. La medición
              empieza en la fecha indicada.
            </DialogDescription>
          </DialogHeader>
          <SelectField
            label="Tienda de la prueba"
            value={testStoreId}
            onChange={(value) => {
              setTestStoreId(value);
              setProductId("");
              setAdsetId("");
            }}
            options={[
              { value: "", label: "Elegir tienda" },
              ...stores.map((store) => ({ value: store.id, label: store.name })),
            ]}
          />
          {testProducts.isError || ads.isError ? (
            <Failure error={testProducts.error ?? ads.error} />
          ) : (
            <div className="space-y-4">
              <SelectField
                label="Producto con costo"
                value={productId}
                onChange={setProductId}
                disabled={!canCreate}
                options={[
                  { value: "", label: "Elegir producto" },
                  ...eligibleTestProducts.map((product) => ({
                    value: product.id,
                    label: product.name,
                  })),
                ]}
              />
              <SelectField
                label="Conjunto de anuncios"
                value={adsetId}
                onChange={setAdsetId}
                disabled={!canCreate}
                options={[
                  { value: "", label: "Elegir conjunto" },
                  ...[
                    ...new Map(
                      (ads.data?.rows ?? [])
                        .filter(
                          (row) =>
                            row.adsetId &&
                            row.store?.id === testStoreId &&
                            (accountId === "all" || row.accountId === accountId),
                        )
                        .map((row) => [
                          row.adsetId!,
                          { value: row.adsetId!, label: `Conjunto de ${row.name}` },
                        ]),
                    ).values(),
                  ],
                ]}
              />
              <label className="block text-sm">
                Inicio
                <Input
                  type="date"
                  value={start}
                  max={limaToday()}
                  onChange={(event) => setStart(event.target.value)}
                />
              </label>
              {error != null && <Failure error={error} />}
              <Button
                disabled={!productId || !adsetId || pending || !canCreate}
                onClick={() => void create()}
              >
                {pending ? "Creando…" : "Crear prueba"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}

export function TestRow({ test, product }: { test: AdsTest; product?: AdsProduct }) {
  const { identity, settings } = useAdsV22();
  const refresh = useRefreshAds();
  const start = test.startAt.slice(0, 10);
  const today = limaToday();
  const query = useNumbers(start, today, test.storeId, `test:${test.id}`, test.accountId);
  const catalogFilters = {
    from: start,
    to: today,
    level: "ad" as const,
    storeId: test.storeId,
    accountId: test.accountId,
    adsetId: test.adsetId ?? undefined,
  };
  const catalog = useAdsQuery(["test-catalog", catalogFilters], (id, signal) =>
    getAllAdsCatalog(id, catalogFilters, signal),
  );
  const [modal, setModal] = useState<"scale" | "discard" | null>(null);
  const [method, setMethod] = useState("budget");
  const [campaign, setCampaign] = useState("");
  const [pending, setPending] = useState(false);
  const requestIds = useRef(new Map<string, string>());
  const [error, setError] = useState<unknown>(null);
  const canManageAds =
    settings!.capabilities.edit &&
    catalog.data?.capabilities?.canManageAds === true &&
    catalog.data.rows.length > 0 &&
    catalog.data.rows.every((row) => row.accountId === test.accountId);
  const rows =
    catalog.data?.rows.filter(
      (row) => row.accountId === test.accountId && test.adIds.includes(row.id),
    ) ?? [];
  const financials = query.data
    ? rows.map((row) => adFinancial(row, query.data!.summary, query.data!.sales, product))
    : [];
  const spend =
    financials.length && financials.every((row) => row.spend !== null)
      ? financials.reduce((sum, row) => sum + (row.spend ?? 0), 0)
      : null;
  const delivered = financials.reduce((sum, row) => sum + row.delivered, 0);
  const attributed =
    query.data?.sales.byAd.filter(
      (row) =>
        row.storeId === test.storeId &&
        !!row.adId &&
        test.adIds.includes(row.adId) &&
        (!row.accountId || row.accountId === test.accountId),
    ) ?? [];
  const ownProduct = attributed.length
    ? attributed
    : ((query.data?.sales.byProduct ?? []).filter(
        (row) => row.storeId === test.storeId && row.productId === test.productId,
      ) ?? []);
  const maximum =
    ownProduct.length && ownProduct.every((row) => row.missingCostOrders === 0)
      ? financial(0, sumSales(ownProduct), null).maximum
      : null;
  const costSale = ratio(spend, delivered);
  const rules = settings!.rules;
  const loading = !query.data || !catalog.data;
  const measurementFailed = query.isError || catalog.isError;
  const verdict = measurementFailed
    ? "Medición no disponible"
    : loading
      ? "Cargando medición…"
      : financials.some((value) => value.evidence?.partial)
        ? "Datos incompletos"
        : maximum === null || spend === null
          ? "Sin costo suficiente"
          : spend >= maximum * rules.testMultiplier && delivered === 0
            ? "Descartar"
            : delivered >= rules.testMinSales &&
                costSale !== null &&
                costSale < (maximum * rules.winPct) / 100
              ? "Ganador"
              : "Sigue probando";
  async function decide() {
    if (!identity || !modal || pending || !canManageAds || !settings!.capabilities.profit) return;
    setPending(true);
    setError(null);
    try {
      if (!rows[0]) throw new Error("Actualiza los anuncios de la prueba antes de decidir.");
      const key = `${modal}:${method}:${campaign}`;
      if (!requestIds.current.has(key)) requestIds.current.set(key, crypto.randomUUID());
      await decideAdsTest(
        identity,
        test,
        rows[0],
        modal,
        method as "budget" | "duplicate",
        campaign,
        requestIds.current.get(key)!,
      );
      await refresh();
      setModal(null);
    } catch (failure) {
      setError(failure);
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="space-y-3 rounded-md border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">{product?.name ?? "Producto"}</p>
          <p className="text-xs text-muted-foreground">
            Desde {start} ·{" "}
            {Math.max(
              1,
              Math.floor((parseISO(today).getTime() - parseISO(start).getTime()) / 86_400_000) + 1,
            )}{" "}
            días ·{" "}
            {test.status === "scaled"
              ? "🚀 En escala"
              : test.status === "discarded"
                ? "✖ Descartado"
                : settings!.capabilities.profit
                  ? verdict
                  : "En prueba"}
          </p>
        </div>
        {test.status === "active" &&
          canManageAds &&
          settings!.capabilities.profit &&
          (verdict === "Ganador" || verdict === "Descartar") && (
            <Button
              size="sm"
              variant={verdict === "Descartar" ? "destructive" : "default"}
              onClick={() => setModal(verdict === "Ganador" ? "scale" : "discard")}
            >
              {verdict === "Ganador" ? "Pasar a escala" : "Descartar y pausar"}
            </Button>
          )}
      </div>
      {!loading && test.status === "active" && settings!.capabilities.edit && !canManageAds && (
        <p role="status" className="text-xs text-muted-foreground">
          {META_MANAGEMENT_UNAVAILABLE}
        </p>
      )}
      {query.isError || catalog.isError ? (
        <Failure
          error={query.error ?? catalog.error}
          retry={() => {
            void query.refetch();
            void catalog.refetch();
          }}
        />
      ) : loading ? (
        <Skeleton className="h-10" aria-label="Cargando medición de la prueba" />
      ) : (
        <div className="flex flex-wrap gap-6 text-sm">
          {settings!.capabilities.spend && (
            <span>
              Gasto <strong>{money(spend)}</strong>
            </span>
          )}
          <span>
            Ventas <strong>{decimal(delivered)}</strong>
          </span>
          {settings!.capabilities.spend && (
            <span>
              C. venta <strong>{money(costSale)}</strong>
            </span>
          )}
          {settings!.capabilities.profit && (
            <span>
              Máximo <strong>{money(maximum)}</strong>
            </span>
          )}
          <span>{rows.length} anuncios</span>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {rows.map((row) => (
          <a
            key={row.id}
            href={`/publicidad/anuncios?storeId=${test.storeId}&adAccountId=${test.accountId}&from=${start}&to=${today}&adId=${row.id}`}
            className="text-xs text-primary underline"
          >
            {row.name}
          </a>
        ))}
      </div>
      {test.status === "active" &&
        settings!.capabilities.profit &&
        verdict === "Sigue probando" && (
          <p className="text-xs text-muted-foreground">
            {delivered < rules.testMinSales
              ? `Faltan ${decimal(rules.testMinSales - delivered)} ventas para decidir.`
              : "Su costo aún es alto."}
          </p>
        )}
      <Dialog
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open) setModal(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {modal === "discard" ? "Descartar y pausar anuncios" : "Pasar producto a escala"}
            </DialogTitle>
            <DialogDescription>
              {modal === "discard"
                ? "POWIP pausará los anuncios seleccionados y registrará el resultado solo cuando Meta confirme."
                : "Elige subir 30% el conjunto o duplicarlo en una campaña de escala."}
            </DialogDescription>
          </DialogHeader>
          <ul className="text-sm">
            {rows.map((row) => (
              <li key={row.id}>{row.name}</li>
            ))}
          </ul>
          {modal === "scale" && (
            <>
              <SelectField
                label="Cómo escalar"
                value={method}
                onChange={setMethod}
                options={[
                  { value: "budget", label: "Subir presupuesto del conjunto 30%" },
                  { value: "duplicate", label: "Duplicar a campaña de escala" },
                ]}
              />
              {method === "duplicate" && (
                <label className="text-sm">
                  La copia hereda el estado del conjunto original y puede empezar a gastar. ID de
                  campaña de escala
                  <Input value={campaign} onChange={(event) => setCampaign(event.target.value)} />
                </label>
              )}
            </>
          )}
          {error != null && <Failure error={error} />}
          <Button
            disabled={
              pending || !canManageAds || (modal === "scale" && method === "duplicate" && !campaign)
            }
            onClick={() => void decide()}
          >
            {pending ? "Aplicando en Meta…" : "Confirmar"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
