"use client";

import { ArrowLeft, CreditCard, ExternalLink, Loader2, RefreshCw, Unplug } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { MERCHANT_MP_UUID } from "@/lib/merchantMercadoPago";
import {
  connectMerchantMercadoPago,
  disconnectMerchantMercadoPago,
  getMerchantMercadoPagoConnection,
  type MerchantMercadoPagoConnection,
  merchantMercadoPagoError,
  openMerchantMercadoPagoAuthorization,
} from "@/services/merchantMercadoPagoService";

type Store = { id: string; name: string };

function StoreConnection({
  store,
  token,
  result,
  onReload,
}: {
  store: Store;
  token: string;
  result: string | null;
  onReload: () => void;
}) {
  const [metadata, setMetadata] = useState<{
    token: string;
    value: MerchantMercadoPagoConnection;
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"connect" | "disconnect" | null>(null);
  const scope = useRef<AbortController | null>(null);
  const operation = useRef(false);
  const currentToken = useRef(token);
  currentToken.current = token;
  const connection = metadata?.token === token ? metadata.value : null;

  useEffect(() => {
    const controller = new AbortController();
    scope.current = controller;
    operation.current = false;
    setMetadata(null);
    setBusy(null);
    setError("");
    const isCurrent = () =>
      scope.current === controller && !controller.signal.aborted && currentToken.current === token;
    getMerchantMercadoPagoConnection(store.id, token, controller.signal)
      .then((value) => {
        if (isCurrent()) setMetadata({ token, value });
      })
      .catch((cause: unknown) => {
        if (isCurrent()) setError(merchantMercadoPagoError(cause));
      });
    return () => {
      controller.abort();
      if (scope.current === controller) scope.current = null;
    };
  }, [store.id, token]);

  async function run(action: "connect" | "disconnect") {
    const controller = scope.current;
    if (
      !controller ||
      controller.signal.aborted ||
      operation.current ||
      !connection?.canManage ||
      (action === "connect" && !connection.oauthReady)
    )
      return;
    operation.current = true;
    setBusy(action);
    setError("");
    const isCurrent = () =>
      scope.current === controller && !controller.signal.aborted && currentToken.current === token;
    try {
      if (action === "connect") {
        const authorizationUrl = await connectMerchantMercadoPago(
          store.id,
          token,
          controller.signal,
        );
        if (isCurrent()) openMerchantMercadoPagoAuthorization(authorizationUrl);
      } else {
        await disconnectMerchantMercadoPago(store.id, token, controller.signal);
        if (!isCurrent()) return;
        // A mutation response or callback hint never substitutes for connection metadata.
        setMetadata(null);
        const value = await getMerchantMercadoPagoConnection(store.id, token, controller.signal);
        if (isCurrent()) setMetadata({ token, value });
      }
    } catch (cause) {
      if (isCurrent()) setError(merchantMercadoPagoError(cause));
    } finally {
      if (isCurrent()) {
        operation.current = false;
        setBusy(null);
      }
    }
  }

  return (
    <section
      aria-label={`Cuenta de Mercado Pago de ${store.name}`}
      className="rounded-2xl border bg-card p-5 text-card-foreground sm:p-7 space-y-5"
    >
      <div className="flex items-start gap-3">
        <CreditCard className="mt-1 h-6 w-6 shrink-0 text-sky-600" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="text-lg font-semibold break-words">Cuenta de {store.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Autoriza la cuenta de Mercado Pago de tu negocio para recibir los cobros de esta tienda.
          </p>
        </div>
      </div>

      {result === "error" && (
        <p
          role="status"
          className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
        >
          No se completó la autorización. Puedes volver a conectar tu cuenta.
        </p>
      )}
      {result === "connected" && connection?.connected && (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          La cuenta figura conectada en POWIP para esta tienda.
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
        >
          <p>{error}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!!busy}
            className="mt-3"
            onClick={onReload}
          >
            Volver a consultar
          </Button>
        </div>
      )}

      {!connection ? (
        !error && (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Consultando conexión…
          </p>
        )
      ) : (
        <>
          <div className="space-y-2" aria-live="polite">
            <p className="font-semibold">
              {connection.connected ? "Cuenta conectada" : "Sin cuenta conectada"}
            </p>
            {connection.accountLabel && (
              <p className="break-words text-sm">{connection.accountLabel}</p>
            )}
            {connection.collectorId && (
              <p className="text-sm text-muted-foreground">
                Identificador de cuenta: <span className="font-mono">{connection.collectorId}</span>
              </p>
            )}
            {connection.connected && (
              <p className="text-sm text-muted-foreground">
                Modo: {connection.mode === "production" ? "Producción" : "Pruebas"}
              </p>
            )}
            {connection.connected && connection.mode === "test" && (
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Esta cuenta está en modo de pruebas. Conecta una cuenta de producción para recibir
                pagos reales.
              </p>
            )}
            {connection.revocationRequired && (
              <p className="text-sm text-muted-foreground">
                La cuenta está desconectada en POWIP. También puedes retirar la autorización desde
                tu cuenta de Mercado Pago.
              </p>
            )}
            {!connection.oauthReady && (
              <p className="text-sm text-amber-700 dark:text-amber-300">
                La conexión estará disponible cuando POWIP complete la configuración de Mercado
                Pago.
              </p>
            )}
            {!connection.canManage && (
              <p className="text-sm text-muted-foreground">
                El administrador de la empresa puede conectar o desconectar esta cuenta.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {connection.canManage && (
              <Button
                type="button"
                disabled={!!busy || !connection.oauthReady}
                onClick={() => void run("connect")}
              >
                {busy === "connect" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                )}
                {busy === "connect"
                  ? "Abriendo Mercado Pago…"
                  : connection.connected
                    ? "Conectar otra cuenta"
                    : "Conectar Mercado Pago"}
              </Button>
            )}
            {connection.canManage && connection.connected && (
              <Button
                type="button"
                variant="outline"
                disabled={!!busy}
                onClick={() => void run("disconnect")}
              >
                {busy === "disconnect" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Unplug className="h-4 w-4" aria-hidden="true" />
                )}
                {busy === "disconnect" ? "Desconectando…" : "Desconectar"}
              </Button>
            )}
            <Button type="button" variant="outline" disabled={!!busy} onClick={onReload}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Actualizar estado
            </Button>
          </div>
          {connection.connected && connection.canManage && (
            <p className="text-xs text-muted-foreground">
              Al desconectar, esta tienda dejará de ofrecer nuevos cobros con esta cuenta.
            </p>
          )}
        </>
      )}
      <p className="border-t pt-4 text-sm text-muted-foreground">
        Inicia sesión y autoriza a POWIP directamente en Mercado Pago. Tu contraseña se ingresa
        únicamente allí.
      </p>
    </section>
  );
}

function StoreSelector({
  stores,
  token,
  preferredStoreId,
  hintedStoreId,
  result,
}: {
  stores: Store[];
  token: string;
  preferredStoreId: string | null;
  hintedStoreId: string | null;
  result: string | null;
}) {
  const [selected, setSelected] = useState(
    () =>
      [hintedStoreId, preferredStoreId].find((id) => stores.some((store) => store.id === id)) ||
      stores[0]?.id ||
      "",
  );
  const [revision, setRevision] = useState(0);
  const store = stores.find((item) => item.id === selected) || stores[0];
  if (!store)
    return (
      <p className="rounded-xl border p-5 text-sm">
        Crea una{" "}
        <Link href="/configuracion/tiendas" className="underline">
          tienda
        </Link>{" "}
        para conectar su cuenta de Mercado Pago.
      </p>
    );
  return (
    <div className="space-y-5">
      <div className="max-w-md space-y-2">
        <label htmlFor="merchant-mp-store" className="block text-sm font-semibold">
          Tienda
        </label>
        <select
          id="merchant-mp-store"
          value={store.id}
          onChange={(event) => setSelected(event.target.value)}
          className="h-11 w-full rounded-lg border bg-background px-3 text-sm"
        >
          {stores.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      <StoreConnection
        key={`${store.id}:${revision}`}
        store={store}
        token={token}
        result={hintedStoreId === store.id ? result : null}
        onReload={() => setRevision((value) => value + 1)}
      />
    </div>
  );
}

export default function MerchantMercadoPagoSettings() {
  const { auth, loading, selectedStoreId } = useAuth();
  const search = useSearchParams();
  const stores = (auth?.company?.stores || []).filter((store) => MERCHANT_MP_UUID.test(store.id));
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-8">
      <Link
        href="/configuracion/integraciones"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Integraciones
      </Link>
      <header>
        <h1 className="text-2xl font-bold">Mercado Pago</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Elige la tienda y conecta la cuenta que recibirá sus pagos.
        </p>
      </header>
      {loading ? (
        <p role="status">Cargando tu empresa…</p>
      ) : !auth?.company?.id || !auth.accessToken ? (
        <p role="alert">Inicia sesión con una empresa para configurar Mercado Pago.</p>
      ) : (
        <StoreSelector
          key={`${auth.user.id}:${auth.company.id}`}
          stores={stores}
          token={auth.accessToken}
          preferredStoreId={selectedStoreId}
          hintedStoreId={search.get("storeId")}
          result={search.get("mp")}
        />
      )}
    </main>
  );
}
