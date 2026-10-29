"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdvertisingStoreFilter } from "../AdvertisingStoreFilterContext";
import { useAdvertisingAccountFilter } from "../AdvertisingAccountFilterContext";
import { useAdsQuery, useAdsV22, useRefreshAds } from "./context";
import { Block, Failure, SelectField } from "./shared";
import {
  getV23Settings,
  saveAdsetAssignment,
  saveCodSetting,
  suggestAdsetChannel,
  type AdsetAssignment,
  type AssignmentChannel,
  type CodStoreSetting,
  type V23Settings,
} from "@/services/advertisingV23SettingsService";
const CHANNELS = [
  { value: "wa", label: "WhatsApp" },
  { value: "ig", label: "Instagram" },
  { value: "messenger", label: "Messenger" },
  { value: "web", label: "Web" },
  { value: "shopify_cod", label: "Shopify COD" },
];
export function V23AdsetAssignments() {
  const { identity } = useAdsV22(),
    refresh = useRefreshAds();
  const { storeId } = useAdvertisingStoreFilter(),
    { accountId } = useAdvertisingAccountFilter();
  const query = useAdsQuery(["v23-settings"], getV23Settings);
  const [pending, setPending] = useState(false),
    [error, setError] = useState<unknown>(null),
    [notice, setNotice] = useState("");
  const data = query.data;
  const rows = (data?.adsets ?? []).filter(
    (r) =>
      (accountId === "all" || r.accountId === accountId) &&
      (r.effectiveStatus === "ACTIVE" || r.effectiveStatus === null),
  );
  const visible = rows.filter(
    (r) =>
      storeId === "all" ||
      (data?.assignments.find((a) => a.accountId === r.accountId && a.adsetId === r.adsetId)
        ?.storeId ?? r.currentStoreId) === storeId,
  );
  const suggestions = visible.flatMap((row) => {
    const previous = data?.assignments.find(
        (a) => a.accountId === row.accountId && a.adsetId === row.adsetId,
      ),
      channel = suggestAdsetChannel(row),
      selectedStore = row.currentStoreId;
    return !previous && channel && selectedStore ? [{ row, channel, storeId: selectedStore }] : [];
  });
  async function applySuggestions() {
    if (!identity || !data?.capabilities.configure || pending) return;
    setPending(true);
    setError(null);
    let applied = 0;
    try {
      for (const s of suggestions) {
        await saveAdsetAssignment(identity, {
          accountId: s.row.accountId,
          adsetId: s.row.adsetId,
          storeId: s.storeId,
          channel: s.channel,
          sellerMode: "none",
          sellerId: null,
          origin: "suggested",
          effectiveFrom: data.today,
          apply: "from_date",
          expectedVersion: 0,
        });
        applied++;
      }
      await refresh();
      setNotice(
        `${applied} sugerencias aplicadas desde hoy. Asigna la vendedora responsable en cada conjunto.`,
      );
    } catch (e) {
      setError(e);
      if (applied) await refresh();
    } finally {
      setPending(false);
    }
  }
  return (
    <Block
      title="Canal y vendedora de cada conjunto"
      tools={
        <Button
          variant="outline"
          size="sm"
          disabled={!data?.capabilities.configure || pending || !suggestions.length}
          onClick={() => void applySuggestions()}
        >
          Aplicar sugerencias ({suggestions.length})
        </Button>
      }
    >
      <p className="text-sm text-muted-foreground">
        El gasto sigue el canal y la responsable del conjunto. Las ventas se atribuyen a quien
        confirma la venta. En Shopify COD puedes repartir el gasto por los leads asignados.
      </p>
      {notice ? (
        <p role="status" className="text-sm text-emerald-700">
          {notice}
        </p>
      ) : null}
      {query.isError || error ? (
        <Failure error={error ?? query.error} retry={query.refetch} />
      ) : null}
      {query.isPending ? (
        <p role="status" className="animate-pulse rounded-md bg-muted p-4">
          Cargando conjuntos…
        </p>
      ) : null}
      {data ? (
        <div className="space-y-3">
          {visible.map((row) => (
            <AssignmentEditor
              key={`${row.accountId}:${row.adsetId}:${data.assignments.find((a) => a.accountId === row.accountId && a.adsetId === row.adsetId)?.version ?? 0}`}
              row={row}
              data={data}
              pendingAll={pending}
            />
          ))}
          {!visible.length ? (
            <p className="p-4 text-sm text-muted-foreground">
              Sin conjuntos activos sincronizados en esta selección. Revisa las cuentas y tiendas o
              actualiza los datos de Meta en Anuncios.
            </p>
          ) : null}
        </div>
      ) : null}
    </Block>
  );
}
function AssignmentEditor({
  row,
  data,
  pendingAll,
}: {
  row: V23Settings["adsets"][number];
  data: V23Settings;
  pendingAll: boolean;
}) {
  const { identity } = useAdsV22(),
    refresh = useRefreshAds();
  const previous = data.assignments.find(
    (a) => a.accountId === row.accountId && a.adsetId === row.adsetId,
  );
  const [store, setStore] = useState(previous?.storeId ?? row.currentStoreId ?? ""),
    [channel, setChannel] = useState<AssignmentChannel | "">(
      previous?.channel ?? suggestAdsetChannel(row) ?? "",
    );
  const [seller, setSeller] = useState(
    previous?.sellerMode === "by_leads" ? "by_leads" : (previous?.sellerId ?? ""),
  );
  const [date, setDate] = useState(data.today),
    [scope, setScope] = useState<AdsetAssignment["apply"]>("from_date");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [saved, setSaved] = useState(false);
  async function save() {
    if (!identity || !store || !channel || busy) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await saveAdsetAssignment(identity, {
        accountId: row.accountId,
        adsetId: row.adsetId,
        storeId: store,
        channel,
        sellerId: seller && seller !== "by_leads" ? seller : null,
        sellerMode: seller === "by_leads" ? "by_leads" : seller ? "fixed" : "none",
        origin: "manual",
        effectiveFrom: date,
        apply: scope,
        expectedVersion: previous?.version ?? 0,
      });
      setSaved(true);
      await refresh();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="space-y-3 rounded-lg border p-4">
      <div>
        <p className="font-medium">{row.name}</p>
        <p className="text-xs text-muted-foreground">
          {row.accountName} › {row.campaignName || "Campaña sincronizada"}
        </p>
        <p className="mt-1 text-xs">
          Destino:{" "}
          {row.destinations
            .map((d) => `${d.type}: ${d.label ?? d.identifier ?? "sin detalle"}`)
            .join(" · ") ||
            row.destinationType ||
            "Sin destino sincronizado"}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <SelectField
          label="Tienda del conjunto"
          value={store}
          onChange={setStore}
          disabled={!data.capabilities.configure || busy || pendingAll}
          options={[
            { value: "", label: "Selecciona tienda" },
            ...data.stores.map((s) => ({ value: s.id, label: s.name })),
          ]}
        />
        <SelectField
          label="Canal principal"
          value={channel}
          onChange={(v) => {
            setChannel(v as AssignmentChannel);
            if (v !== "shopify_cod" && seller === "by_leads") setSeller("");
          }}
          disabled={!data.capabilities.configure || busy || pendingAll}
          options={[{ value: "", label: "Selecciona canal" }, ...CHANNELS]}
        />
        <SelectField
          label="Vendedora del conjunto"
          value={seller}
          onChange={setSeller}
          disabled={!data.capabilities.configure || busy || pendingAll}
          options={[
            { value: "", label: "Sin vendedora" },
            ...(channel === "shopify_cod"
              ? [{ value: "by_leads", label: "Reparto por leads asignados" }]
              : []),
            ...data.sellers.map((s) => ({ value: s.id, label: s.name })),
          ]}
        />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <SelectField
          label="Aplicar al gasto"
          value={scope}
          onChange={(v) => setScope(v as AdsetAssignment["apply"])}
          disabled={!data.capabilities.configure || busy}
          options={[
            { value: "from_date", label: "Desde una fecha" },
            { value: "all_history", label: "Todo el historial (recalcular)" },
          ]}
        />
        {scope === "from_date" ? (
          <label className="text-xs">
            Desde
            <Input
              aria-label="Fecha inicial de la asignación"
              type="date"
              max={data.today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={!data.capabilities.configure || busy}
            />
          </label>
        ) : (
          <p className="text-xs text-amber-800">
            Recalcula la tienda, canal y gasto por vendedora de los períodos anteriores. Queda en el
            historial.
          </p>
        )}
        <Button
          size="sm"
          disabled={
            !data.capabilities.configure || !store || !channel || !date || busy || pendingAll
          }
          onClick={() => void save()}
        >
          {busy ? "Guardando…" : "Guardar asignación"}
        </Button>
      </div>
      {previous ? (
        <p className="text-xs text-muted-foreground">
          Última asignación:{" "}
          {previous.apply === "all_history"
            ? "todo el historial"
            : `desde ${previous.effectiveFrom}`}{" "}
          · versión {previous.version}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-sm text-emerald-700">
          Asignación guardada.
        </p>
      ) : null}
      {error ? <Failure error={error} /> : null}
    </article>
  );
}
export function V23ShopifyCodSettings() {
  const query = useAdsQuery(["v23-settings"], getV23Settings),
    { storeId } = useAdvertisingStoreFilter();
  return (
    <Block title="Shopify COD">
      <p className="text-sm text-muted-foreground">
        Activa el bloque de leads solo para las tiendas que usan un formulario COD. Cada lead se
        mantiene separado del pedido hasta que se convierte en Gestión COD.
      </p>
      {query.isError ? <Failure error={query.error} retry={query.refetch} /> : null}
      {query.isPending ? (
        <p role="status" className="animate-pulse bg-muted p-4">
          Consultando conexión de leads…
        </p>
      ) : null}
      {query.data?.shopifyCod
        .filter((s) => storeId === "all" || s.storeId === storeId)
        .map((s) => (
          <CodEditor
            key={`${s.storeId}:${s.version}`}
            item={s}
            canConfigure={query.data!.capabilities.configure === true}
          />
        ))}
    </Block>
  );
}
function CodEditor({ item, canConfigure }: { item: CodStoreSetting; canConfigure: boolean }) {
  const { identity } = useAdsV22(),
    refresh = useRefreshAds();
  const [enabled, setEnabled] = useState(item.enabled),
    [app, setApp] = useState(item.app),
    [name, setName] = useState(item.appName),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  async function save() {
    if (!identity || !canConfigure || busy) return;
    setBusy(true);
    setError(null);
    try {
      await saveCodSetting(identity, {
        storeId: item.storeId,
        enabled,
        app,
        appName: name,
        expectedVersion: item.version,
      });
      await refresh();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="space-y-3 rounded-lg border p-4">
      <p className="font-semibold">{item.storeName}</p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          role="switch"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          disabled={!canConfigure || busy}
        />
        Esta tienda usa Shopify COD (formulario de leads)
      </label>
      <div className="flex flex-wrap items-end gap-3">
        <SelectField
          label="App del formulario"
          value={app}
          onChange={(v) => setApp(v as CodStoreSetting["app"])}
          disabled={!canConfigure || busy}
          options={[
            { value: "releasit", label: "Releasit" },
            { value: "easysell", label: "EasySell" },
            { value: "other", label: "Otra" },
          ]}
        />
        {app === "other" ? (
          <label className="text-xs">
            Nombre de la app
            <Input
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              disabled={!canConfigure || busy}
            />
          </label>
        ) : null}
        <Button size="sm" disabled={!canConfigure || busy} onClick={() => void save()}>
          {busy ? "Guardando…" : "Guardar Shopify COD"}
        </Button>
      </div>
      <p className="text-sm">
        Conexión de leads:{" "}
        {item.connection === "connected"
          ? "Shopify conectado · fuente de leads habilitada"
          : item.connection === "flow_disabled"
            ? "Shopify conectado · activa la recepción en Gestión COD"
            : item.connection === "leads_schema_missing"
              ? "Shopify conectado · falta habilitar la recepción de leads"
              : "Conecta Shopify para recibir leads"}
      </p>
      <p className="text-sm">
        Leads recibidos hoy: <strong>{item.leadsToday ?? "—"}</strong>
      </p>
      {item.lastLeadAt ? (
        <p className="text-xs text-muted-foreground">
          Último lead:{" "}
          {new Date(item.lastLeadAt).toLocaleString("es-PE", { timeZone: "America/Lima" })}
        </p>
      ) : null}
      {error ? <Failure error={error} /> : null}
    </article>
  );
}
