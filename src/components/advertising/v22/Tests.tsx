"use client";
import { useEffect, useRef, useState } from "react";
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
} from "@/services/advertisingV22Service";
import { useAdvertisingStoreFilter } from "../AdvertisingStoreFilterContext";
import { useAdsQuery, useAdsV22, useRefreshAds } from "./context";
import {
  adFinancial,
  financial,
  sumSales,
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

export function AdvertisingTests() {
  const { identity, settings } = useAdsV22();
  const { storeId, stores } = useAdvertisingStoreFilter();
  const refresh = useRefreshAds();
  const [newTest, setNewTest] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const [productId, setProductId] = useState("");
  const [adsetId, setAdsetId] = useState("");
  const [start, setStart] = useState(limaToday());
  const tests = useAdsQuery(["tests", storeId], (id, signal) =>
    adsGet<{ tests: AdsTest[] }>(id, "/v22/tests", { storeId }, signal),
  );
  const products = useAdsQuery(["products-v22", storeId], (id, signal) =>
    adsGet<{ products: AdsProduct[] }>(id, "/v22/products", { storeId }, signal),
  );
  const ads = useAdsQuery(["tests-catalog", storeId], (id, signal) =>
    getAllAdsCatalog(
      id,
      { from: dayKey(subDays(parseISO(limaToday()), 29)), to: limaToday(), storeId, level: "ad" },
      signal,
    ),
  );
  const allowed = settings!.capabilities.edit;
  const canCreate = allowed && stores.some((store) => store.id === storeId);
  useEffect(() => {
    setNewTest(false);
    setProductId("");
    setAdsetId("");
  }, [storeId]);
  const list = tests.data?.tests ?? [];
  const eligibleProducts = (products.data?.products ?? []).filter(
    (product) =>
      product.canTest ??
      (numeric(product.unitCost) !== null ||
        product.variants.some((variant) => numeric(variant.unitCost) !== null)),
  );
  async function create() {
    if (!identity || !productId || !adsetId || pending || !canCreate) return;
    const selected = eligibleProducts.find((row) => row.id === productId);
    if (!selected) return;
    const selectedAds = (ads.data?.rows ?? []).filter(
      (row) => row.adsetId === adsetId && row.store?.id === selected.storeId,
    );
    if (!selectedAds.length) {
      setError(new Error("El conjunto debe tener anuncios asignados a la tienda del producto."));
      return;
    }
    setPending(true);
    setError(null);
    try {
      await adsWrite(identity, "post", "/v22/tests", {
        productId,
        accountId: selectedAds[0].accountId,
        storeId: selected.storeId,
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
    <main className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Pruebas de productos</h2>
          <p className="text-xs text-muted-foreground">
            Cada prueba se mide desde su inicio, independientemente del período de Anuncios.
          </p>
        </div>
        <Button disabled={!canCreate} onClick={() => setNewTest(true)}>
          Nueva prueba
        </Button>
      </div>
      {allowed && !canCreate && (
        <p role="status" className="text-sm text-muted-foreground">
          Selecciona una tienda comercial en el filtro superior para crear una prueba.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-4">
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
        <MetricCard label="Productos con costo" value={eligibleProducts.length} />
      </div>
      {error != null && <Failure error={error} />}
      {!tests.data && <Skeleton className="h-64" />}
      <Block title="Pruebas y veredictos">
        <div className="space-y-4">
          {list.map((test) => (
            <TestRow
              key={test.id}
              test={test}
              product={products.data?.products.find((product) => product.id === test.productId)}
            />
          ))}
          {tests.data && list.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No hay pruebas en esta tienda. Elige un producto con costo cargado y su conjunto para
              comenzar.
            </p>
          )}
        </div>
      </Block>
      <Dialog open={newTest && canCreate} onOpenChange={setNewTest}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva prueba</DialogTitle>
            <DialogDescription>
              Elige un producto con costo y los anuncios de su tienda. La medición empieza en la
              fecha indicada.
            </DialogDescription>
          </DialogHeader>
          {products.isError || ads.isError ? (
            <Failure error={products.error ?? ads.error} />
          ) : (
            <div className="space-y-4">
              <SelectField
                label="Producto con costo"
                value={productId}
                onChange={setProductId}
                options={[
                  { value: "", label: "Elegir producto" },
                  ...eligibleProducts.map((product) => ({
                    value: product.id,
                    label: `${product.name} · ${stores.find((store) => store.id === product.storeId)?.name ?? ""}`,
                  })),
                ]}
              />
              <SelectField
                label="Conjunto de anuncios"
                value={adsetId}
                onChange={setAdsetId}
                options={[
                  { value: "", label: "Elegir conjunto" },
                  ...[
                    ...new Map(
                      (ads.data?.rows ?? [])
                        .filter(
                          (row) =>
                            row.adsetId &&
                            (!productId ||
                              row.store?.id ===
                                eligibleProducts.find((product) => product.id === productId)
                                  ?.storeId),
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
  const query = useNumbers(start, today, test.storeId, `test:${test.id}`);
  const catalog = useAdsQuery(["test", test.id, start], (id, signal) =>
    getAllAdsCatalog(id, { from: start, to: today, level: "ad", storeId: test.storeId }, signal),
  );
  const [modal, setModal] = useState<"scale" | "discard" | null>(null);
  const [method, setMethod] = useState("budget");
  const [campaign, setCampaign] = useState("");
  const [pending, setPending] = useState(false);
  const requestIds = useRef(new Map<string, string>());
  const [error, setError] = useState<unknown>(null);
  const rows = catalog.data?.rows.filter((row) => test.adIds.includes(row.id)) ?? [];
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
    : (query.data?.sales.byProduct.filter(
        (row) => row.storeId === test.storeId && row.productId === test.productId,
      ) ?? []);
  const maximum =
    ownProduct.length && ownProduct.every((row) => row.missingCostOrders === 0)
      ? financial(0, sumSales(ownProduct), null).maximum
      : null;
  const costSale = ratio(spend, delivered);
  const rules = settings!.rules;
  const verdict = financials.some((value) => value.evidence?.partial)
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
    if (!identity || !modal || pending) return;
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
          settings!.capabilities.edit &&
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
      {query.isError || catalog.isError ? (
        <Failure error={query.error ?? catalog.error} />
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
            href={`/publicidad/anuncios?storeId=${test.storeId}&from=${start}&to=${today}&adId=${row.id}`}
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
            disabled={pending || (modal === "scale" && method === "duplicate" && !campaign)}
            onClick={() => void decide()}
          >
            {pending ? "Aplicando en Meta…" : "Confirmar"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
