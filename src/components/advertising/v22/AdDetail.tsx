"use client";
import { useRef, useState } from "react";
import axios from "axios";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  adsGet,
  adsOptions,
  adsUrl,
  adsWrite,
  type AdsDetail,
  type AdsRow,
  type AdsSummary,
  type AdsSales,
  type AdProduct,
  type AdsProduct,
} from "@/services/advertisingV22Service";
import { useAdsQuery, useAdsV22, useRefreshAds } from "./context";
import {
  adFinancial,
  financialBasis,
  financialCauses,
  creativeAverage,
  creativeMetrics,
  decimal,
  diagnosis,
  money,
  metaStatusLabel,
  numeric,
  pct,
  ratio,
  resultCount,
  daysForRow,
} from "./model";
import { catalogChannels } from "./ads-list-model";
import { Block, Failure, MetricCard, SelectField } from "./shared";
import { META_MANAGEMENT_UNAVAILABLE, type ActionSelection } from "./Actions";

export function AdvertisingAdDetail({
  row,
  from,
  to,
  summary,
  sales,
  average,
  onClose,
  onAction,
}: {
  row: AdsRow;
  from: string;
  to: string;
  summary?: AdsSummary;
  sales?: AdsSales;
  average: ReturnType<typeof creativeAverage>;
  onClose: () => void;
  onAction: (selection: ActionSelection) => void;
}) {
  const { identity, settings } = useAdsV22();
  const refresh = useRefreshAds();
  const [placement, setPlacement] = useState("facebook_feed");
  const [variation, setVariation] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const query = useAdsQuery(["ad-detail", row.id, row.accountId, from, to], (id, signal) =>
    adsGet<AdsDetail>(
      id,
      `/meta/v22/ads/${encodeURIComponent(row.id)}`,
      { accountId: row.accountId, from, to },
      signal,
    ),
  );
  const preview = useAdsQuery(["ad-preview", row.id, placement], (id, signal) =>
    adsGet<{ html: string }>(
      id,
      `/meta/v22/ads/${encodeURIComponent(row.id)}/preview`,
      { accountId: row.accountId, placement },
      signal,
    ),
  );
  const productQuery = useAdsQuery(["products-v22", row.store?.id], (id, signal) =>
    adsGet<{ products: AdsProduct[] }>(
      id,
      "/v22/products",
      { storeId: row.store?.id ?? "all" },
      signal,
    ),
  );
  const detail = query.data;
  const canManageAds =
    settings?.capabilities.edit === true && detail?.capabilities?.canManageAds === true;
  const item = detail?.row ?? row;
  const creative = detail?.creative ?? item.creative;
  const assignment = summary?.adProducts.find(
    (ad) => ad.adId === row.id && ad.accountId === row.accountId,
  );
  const product = productQuery.data?.products.find((entry) => entry.id === assignment?.productId);
  const value = summary && sales ? adFinancial(item, summary, sales, product) : null;
  const metric = creativeMetrics(item);
  const assignedDays = summary ? daysForRow(item, summary) : [];
  const assignedChannels = new Set(
    assignedDays
      .map((day) => day.channel)
      .filter((channel) => channel === "messages" || channel === "web"),
  );
  const resultChannels = assignedChannels.size ? assignedChannels : catalogChannels(item);
  const estimatedSalesUnknown =
    !value ||
    (value.evidence?.basis === "estimated" &&
      value.evidence.issues.some((issue) => ["store", "channel", "results"].includes(issue)));
  const creativeDiagnostic = diagnosis(item, average, undefined, settings!.rules.highFrequency);
  const diagnostic =
    (!value || value.evidence?.partial) &&
    creativeDiagnostic.label === "Funciona: haz variaciones del gancho"
      ? {
          ...creativeDiagnostic,
          label:
            "Datos incompletos: confirma las ventas y la rentabilidad antes de evaluar el desempeño.",
        }
      : creativeDiagnostic;
  const family = [
    ...new Map(
      [item, ...(detail?.variations ?? [])].map((variant) => [
        `${variant.accountId}:${variant.id}`,
        variant as AdsRow & { variationType?: string; parentAdId?: string | null },
      ]),
    ).values(),
  ];
  const account = detail?.account;
  const metaUrl = `https://www.facebook.com/adsmanager/manage/ads?act=${encodeURIComponent(account?.externalId ?? row.accountId)}&selected_ad_ids=${encodeURIComponent(row.id)}`;
  async function tag(type: "hookId" | "creatorId", value: string) {
    if (!identity || !settings?.capabilities.edit || !summary) return;
    try {
      await adsWrite(identity, "put", `/v22/ad-products/${row.id}`, {
        accountId: row.accountId,
        productId: assignment?.productId ?? null,
        origin: assignment?.origin ?? "manual",
        hookId: assignment?.hookId ?? null,
        creatorId: assignment?.creatorId ?? null,
        [type]: value || null,
      });
      await refresh();
    } catch (failure) {
      setError(failure);
    }
  }
  const retention = [
    { label: "25%", value: ratio(numeric(item.insights.videoP25), metric.video3s) },
    { label: "50%", value: ratio(numeric(item.insights.videoP50), metric.video3s) },
    { label: "75%", value: ratio(numeric(item.insights.videoP75), metric.video3s) },
    { label: "95%", value: ratio(numeric(item.insights.videoP95), metric.video3s) },
    { label: "100%", value: ratio(numeric(item.insights.videoP100), metric.video3s) },
  ];
  const daily = detail?.daily as
    | Array<
        AdsDetail["daily"][number] & {
          ctrLink?: string | null;
          inlineLinkClicks?: string | null;
          results?: number | null;
          costPerResult?: string | null;
        }
      >
    | undefined;
  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DialogContent className="max-h-[94dvh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{item.name}</DialogTitle>
            <DialogDescription>
              {account?.name ?? "Cuenta"} › {item.campaignId ? "Campaña" : ""} ›{" "}
              {item.adsetId ? "Conjunto" : ""} · {item.store?.name ?? "Sin tienda"}
            </DialogDescription>
          </DialogHeader>
          {query.isError ? (
            <Failure error={query.error} retry={query.refetch} />
          ) : !detail ? (
            <Skeleton className="h-40" />
          ) : (
            <div className="space-y-5">
              <p className="text-sm">
                {metaStatusLabel(item)} · {creative?.format ?? "—"} · {diagnostic.label}
              </p>
              <Block
                title="Vista previa real de Meta"
                tools={
                  <SelectField
                    label="Ubicación"
                    value={placement}
                    onChange={setPlacement}
                    options={[
                      { value: "facebook_feed", label: "Feed Facebook" },
                      { value: "instagram_feed", label: "Feed Instagram" },
                      { value: "stories", label: "Stories" },
                      { value: "reels", label: "Reels" },
                    ]}
                  />
                }
              >
                {preview.isError ? (
                  <>
                    <Failure error={preview.error} />
                    <a
                      className="text-sm text-primary underline"
                      href={metaUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Ver en Meta
                    </a>
                  </>
                ) : preview.data?.html ? (
                  <iframe
                    title={`Vista previa de ${item.name}`}
                    srcDoc={preview.data.html}
                    sandbox="allow-scripts allow-popups"
                    className="h-[480px] w-full rounded border bg-white"
                  />
                ) : (
                  <Skeleton className="h-64" />
                )}
              </Block>
              <div className="space-y-1 rounded-md bg-muted p-4">
                <p className="whitespace-pre-line text-sm">
                  {creative?.body ?? "Sin texto principal"}
                </p>
                <p className="font-medium">{creative?.title}</p>
                <p className="text-xs text-muted-foreground">{creative?.cta}</p>
              </div>
              <Block title="Qué hacer">
                <p className="text-sm">{diagnostic.label}</p>
              </Block>
              <div className="space-y-1 text-sm text-muted-foreground" role="status">
                {value ? (
                  <>
                    <p>
                      {financialBasis(value)}
                      {value.evidence?.basis === "measured"
                        ? ` · ${pct(value.evidence.attributionCoverage)} de pedidos identificados`
                        : ""}
                    </p>
                    {financialCauses(value, settings!.capabilities.profit).map((cause) => (
                      <p key={cause}>{cause}</p>
                    ))}
                  </>
                ) : (
                  <p>
                    Las ventas y la rentabilidad aún no se han podido consultar. El creativo y los
                    resultados de Meta siguen disponibles.
                  </p>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {settings!.capabilities.spend && (
                  <MetricCard
                    label="Gasto"
                    value={money(
                      value
                        ? value.spend
                        : item.insights.coverage?.spendAvailable === false
                          ? null
                          : numeric(item.insights.spend),
                    )}
                  />
                )}
                {[...resultChannels]
                  .filter((channel) => channel === "messages" || channel === "web")
                  .map((channel) => (
                    <MetricCard
                      key={channel}
                      label={`Resultados · ${channel === "web" ? "Web" : "Mensajes"}`}
                      value={decimal(resultCount(item, channel))}
                      detail={
                        settings!.capabilities.spend
                          ? `Costo por resultado ${money(numeric(item.insights.resultMetrics?.[channel === "web" ? "webPurchases" : "messages"].costPerResult))}`
                          : undefined
                      }
                    />
                  ))}
                <MetricCard
                  label="Ventas"
                  value={decimal(estimatedSalesUnknown ? null : value?.delivered)}
                />
                {settings!.capabilities.spend && (
                  <>
                    <MetricCard label="Costo por venta" value={money(value?.costSale)} />
                    <MetricCard label="ROAS" value={decimal(value?.roas, "×")} />
                  </>
                )}
                {settings!.capabilities.profit && (
                  <>
                    <MetricCard label="Máximo" value={money(value?.maximum)} />
                    <MetricCard label="Ganancia" value={money(value?.gain)} />
                  </>
                )}
                <MetricCard
                  label="Frecuencia · Meta"
                  value={decimal(numeric(item.insights.frequency))}
                />
              </div>
              <Block title="Creativo y diagnóstico">
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { label: "Hook", value: metric.hook, average: average.hook },
                    { label: "Hold", value: metric.hold, average: average.hold },
                    {
                      label: "Conversión del clic",
                      value: metric.conversion,
                      average: average.conversion,
                    },
                  ].map((entry) => (
                    <div key={entry.label}>
                      <p className="text-xs text-muted-foreground">{entry.label}</p>
                      <p className="text-lg font-semibold">
                        {entry.label === "Conversión del clic" || creative?.format === "video"
                          ? pct(entry.value)
                          : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Promedio 30 días: {pct(entry.average)}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  CTR enlace {decimal(numeric(item.insights.ctr), "%")} · todos{" "}
                  {decimal(numeric(item.insights.ctrAll), "%")} · único{" "}
                  {decimal(numeric(item.insights.ctrUnique), "%")} · saliente{" "}
                  {decimal(numeric(item.insights.ctrOutbound), "%")}
                  {settings!.capabilities.spend
                    ? ` · CPM ${money(numeric(item.insights.cpm))}`
                    : ""}
                </p>
              </Block>
              {creative?.format === "video" && (
                <Block title="Curva de retención">
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={retention.map((item) => ({
                          ...item,
                          value: item.value === null ? null : item.value * 100,
                        }))}
                      >
                        <XAxis dataKey="label" />
                        <YAxis unit="%" />
                        <Tooltip />
                        <Bar dataKey="value" name="Retención sobre vistas de 3 s" fill="#6366f1" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Tiempo promedio visto: {decimal(numeric(item.insights.avgWatch), " s")}. La
                    retención compara vistas de cada tramo con las vistas de 3 segundos.
                  </p>
                </Block>
              )}
              <Block title="CTR de enlace · últimos 7 días">
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={daily?.slice(-7).map((day) => ({
                        date: day.date,
                        ctr:
                          numeric(day.ctrLink) ??
                          (numeric(day.inlineLinkClicks) !== null && numeric(day.impressions)
                            ? (Number(day.inlineLinkClicks) / Number(day.impressions)) * 100
                            : null),
                      }))}
                    >
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line
                        dataKey="ctr"
                        name="CTR enlace %"
                        stroke="#6366f1"
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {(item.ctrDecline ?? 0) >= 0.25 && (
                  <p className="text-sm text-amber-700">♻ El CTR está bajando.</p>
                )}
              </Block>
              <Block title="Etiquetas editables">
                <div className="flex flex-wrap gap-3">
                  <SelectField
                    label="Tipo de gancho"
                    disabled={!settings!.capabilities.edit || !summary}
                    value={assignment?.hookId ?? ""}
                    onChange={(value) => void tag("hookId", value)}
                    options={[
                      { value: "", label: "Sin etiqueta" },
                      ...settings!.tags.hooks.map((tag) => ({ value: tag.id, label: tag.name })),
                    ]}
                  />
                  <SelectField
                    label="Creador"
                    disabled={!settings!.capabilities.edit || !summary}
                    value={assignment?.creatorId ?? ""}
                    onChange={(value) => void tag("creatorId", value)}
                    options={[
                      { value: "", label: "Sin etiqueta" },
                      ...settings!.tags.creators.map((tag) => ({ value: tag.id, label: tag.name })),
                    ]}
                  />
                </div>
              </Block>
              <Block title="Variaciones de este creativo">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      {[
                        "Anuncio",
                        ...(settings!.capabilities.spend ? ["Gasto"] : []),
                        "CTR",
                        "Estado",
                      ].map((label) => (
                        <th key={label} className="p-2 text-left">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {family.map((variant) => (
                      <tr key={`${variant.accountId}:${variant.id}`} className="border-t">
                        <td className="p-2">
                          {variant.name}
                          {variant.variationType === "original" ||
                          (!variant.variationType && !variant.parentAdId && variant.id === item.id)
                            ? " · original"
                            : " · variación"}
                        </td>
                        {settings!.capabilities.spend && (
                          <td className="p-2">{money(numeric(variant.insights?.spend))}</td>
                        )}
                        <td className="p-2">{decimal(numeric(variant.insights?.ctr), "%")}</td>
                        <td className="p-2">{metaStatusLabel(variant)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Block>
              <Block title="Historial de cambios">
                <ul className="space-y-2 text-xs">
                  {detail.changes?.map((change, index) => (
                    <li key={change.id ?? index}>
                      {change.createdAt ?? change.date} · {change.source} ·{" "}
                      {change.description ?? change.action}
                    </li>
                  ))}
                </ul>
                {!detail.changes?.length && (
                  <p className="text-xs text-muted-foreground">Sin cambios registrados.</p>
                )}
              </Block>
              {error != null && <Failure error={error} />}
              <div className="flex flex-wrap gap-2">
                {canManageAds && (
                  <>
                    <Button size="sm" onClick={() => setVariation(true)}>
                      ✨ Crear variación
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onAction({ rows: [item], action: "budget", canManageAds })}
                    >
                      Presupuesto
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        onAction({
                          rows: [item],
                          action: item.effectiveStatus === "PAUSED" ? "activate" : "pause",
                          canManageAds,
                        })
                      }
                    >
                      {item.effectiveStatus === "PAUSED" ? "Activar" : "Pausar"}
                    </Button>
                  </>
                )}
                <a
                  className="inline-flex items-center text-sm text-primary underline"
                  href={metaUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver en Meta ↗
                </a>
              </div>
              {settings!.capabilities.edit && !canManageAds && (
                <p role="status" className="text-sm text-muted-foreground">
                  {META_MANAGEMENT_UNAVAILABLE}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      {variation && canManageAds && (
        <VariationDialog
          row={item}
          canManageAds={canManageAds}
          canGenerateAdText={detail?.capabilities?.canGenerateAdText === true}
          diagnosisText={diagnostic.label}
          suggested={diagnostic.suggested}
          product={productQuery.data?.products.find(
            (product) => product.id === assignment?.productId,
          )}
          hook={settings!.tags.hooks.find((tag) => tag.id === assignment?.hookId)?.name}
          onClose={() => setVariation(false)}
        />
      )}
    </>
  );
}

function VariationDialog({
  row,
  canManageAds,
  canGenerateAdText,
  diagnosisText,
  suggested,
  product,
  hook,
  onClose,
}: {
  row: AdsRow;
  canManageAds: boolean;
  canGenerateAdText: boolean;
  diagnosisText: string;
  suggested: string;
  product?: AdsProduct;
  hook?: string;
  onClose: () => void;
}) {
  const { identity, settings } = useAdsV22();
  const refresh = useRefreshAds();
  const [tab, setTab] = useState(suggested);
  const [productName, setProductName] = useState(product?.name ?? "");
  const [netPrice, setNetPrice] = useState(product?.netPrice ?? "");
  const [hookName, setHookName] = useState(hook ?? "");
  const [texts, setTexts] = useState<string[]>([]);
  const [selectedText, setSelectedText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [assetIndex, setAssetIndex] = useState("0");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState("");
  const requestIds = useRef(new Map<string, string>());
  const uploadedMedia = useRef<{ file: File; id: string } | null>(null);
  const brief = `Creativo: ${row.name}\nFormato: ${row.creative?.format ?? "—"}\nCTR enlace: ${decimal(numeric(row.insights.ctr), "%")}\nHook: ${pct(creativeMetrics(row).hook)}\nHold: ${pct(creativeMetrics(row).hold)}\nDiagnóstico: ${diagnosisText}\nPedir: una variación que conserve lo que funciona y corrija este diagnóstico. Entregar para revisión antes de activar.`;
  async function generate() {
    if (!identity || pending || !settings!.capabilities.edit || !canGenerateAdText) return;
    setPending(true);
    setError(null);
    try {
      const result = await adsWrite<{ texts: string[] }>(
        identity,
        "post",
        `/meta/v22/ads/${row.id}/text-variations`,
        {
          accountId: row.accountId,
          productName,
          netPrice,
          hook: hookName,
          diagnosis: diagnosisText,
        },
      );
      if (!Array.isArray(result.texts) || result.texts.length !== 3)
        throw new Error("El generador no devolvió tres propuestas.");
      setTexts(result.texts);
      setSelectedText(result.texts[0]);
    } catch (failure) {
      setError(failure);
    } finally {
      setPending(false);
    }
  }
  async function create() {
    if (
      !identity ||
      pending ||
      !settings!.capabilities.edit ||
      !canManageAds ||
      (tab === "text" && !selectedText.trim())
    )
      return;
    setPending(true);
    setError(null);
    try {
      let mediaId: string | undefined;
      if (tab === "media") {
        if (!file) throw new Error("Elige una imagen o video.");
        if (uploadedMedia.current?.file !== file) {
          const form = new FormData();
          form.append("accountId", row.accountId);
          form.append("file", file);
          const result = await axios.post<{ id: string }>(
            `${adsUrl(identity.companyId)}/meta/v22/media`,
            form,
            adsOptions(identity.token),
          );
          uploadedMedia.current = { file, id: result.data.id };
        }
        mediaId = uploadedMedia.current!.id;
      }
      const requestKey = `${tab}:${selectedText}:${mediaId ?? ""}:${assetIndex}`;
      if (!requestIds.current.has(requestKey))
        requestIds.current.set(requestKey, crypto.randomUUID());
      const result = await adsWrite<{ adId: string; status: string; metaStatus?: string }>(
        identity,
        "post",
        `/meta/v22/ads/${row.id}/variations`,
        {
          requestId: requestIds.current.get(requestKey),
          accountId: row.accountId,
          type: tab,
          ...((row.creative?.assetCount ?? 0) > 1 ? { assetIndex: Number(assetIndex) } : {}),
          ...(tab === "text" ? { body: selectedText } : { mediaId }),
        },
      );
      if (result.status !== "succeeded" || result.metaStatus !== "PAUSED")
        throw new Error("Meta no confirmó la variación pausada. Revisa el historial.");
      await refresh();
      setNotice("Variación creada en Meta y pausada para revisión.");
    } catch (failure) {
      setError(failure);
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Crear variación</DialogTitle>
          <DialogDescription>
            La variación se crea pausada en el mismo conjunto y queda ligada al original.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-1">
          {[
            { id: "text", label: "Cambiar texto" },
            { id: "media", label: "Otra imagen o video" },
            { id: "brief", label: "Brief" },
          ].map((item) => (
            <Button
              key={item.id}
              variant={tab === item.id ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setTab(item.id)}
            >
              {suggested === item.id ? "★ " : ""}
              {item.label}
            </Button>
          ))}
        </div>
        {tab === "text" && (
          <div className="space-y-3">
            <label className="block text-xs">
              Producto
              <Input value={productName} onChange={(event) => setProductName(event.target.value)} />
            </label>
            <label className="block text-xs">
              Precio neto S/
              <Input
                type="number"
                min="0"
                step=".01"
                value={netPrice}
                onChange={(event) => setNetPrice(event.target.value)}
              />
            </label>
            <label className="block text-xs">
              Gancho
              <Input value={hookName} onChange={(event) => setHookName(event.target.value)} />
            </label>
            <Button
              variant="outline"
              disabled={
                pending ||
                !canGenerateAdText ||
                !productName.trim() ||
                !/^\d+(?:\.\d{1,2})?$/.test(netPrice) ||
                !hookName.trim()
              }
              onClick={() => void generate()}
            >
              Generar 3 textos
            </Button>
            {!canGenerateAdText && (
              <p role="status" className="text-xs text-muted-foreground">
                La generación con IA no está disponible. Solicita a administración que habilite el
                generador de textos. Puedes escribir tu propio texto para crear la variación.
              </p>
            )}
            {texts.map((text, index) => (
              <label key={index} className="flex items-start gap-2 rounded-md border p-3 text-sm">
                <input
                  type="radio"
                  name="variation-text"
                  checked={selectedText === text}
                  onChange={() => setSelectedText(text)}
                />
                {text}
              </label>
            ))}
            <label htmlFor="variation-ad-text" className="block space-y-1 text-xs">
              Texto de la variación
              <Textarea
                id="variation-ad-text"
                value={selectedText}
                onChange={(event) => setSelectedText(event.target.value)}
              />
            </label>
            {texts.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Se usa la imagen o video original. El generador utiliza el producto, precio, gancho
                y diagnóstico disponibles.
              </p>
            )}
          </div>
        )}
        {tab === "media" && (
          <div className="space-y-2">
            {(row.creative?.assetCount ?? 0) > 1 && (
              <SelectField
                label="Tarjeta o recurso a reemplazar"
                value={assetIndex}
                onChange={setAssetIndex}
                options={Array.from({ length: row.creative!.assetCount! }, (_, index) => ({
                  value: String(index),
                  label: `Recurso ${index + 1}`,
                }))}
              />
            )}
            <Input
              aria-label="Imagen o video de la variación"
              type="file"
              accept="image/*,video/*"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">
              Se conserva el texto original.{" "}
              {file ? file.name : "Selecciona el archivo que se subirá a Meta."}
            </p>
          </div>
        )}
        {tab === "brief" && (
          <>
            <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">{brief}</pre>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(brief)
                    .then(() => setNotice("Brief copiado."))
                    .catch(setError)
                }
              >
                Copiar brief
              </Button>
              <a
                className="inline-flex items-center text-sm text-primary underline"
                href="https://www.canva.com/"
                target="_blank"
                rel="noreferrer"
              >
                Abrir en Canva ↗
              </a>
            </div>
          </>
        )}
        {error != null && <Failure error={error} />}
        {notice && (
          <p role="status" className="text-sm text-emerald-700">
            {notice}
          </p>
        )}
        {tab !== "brief" && (
          <Button
            disabled={
              pending ||
              !canManageAds ||
              (tab === "text" ? !selectedText.trim() : !file) ||
              !!notice
            }
            onClick={() => void create()}
          >
            {pending ? "Creando en Meta…" : "Crear variación pausada"}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
