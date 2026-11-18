"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, CloudOff, Inbox, RefreshCw, Wifi } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { WarehouseQueueProvider, useWarehouseQueue } from "./WarehouseQueueContext";
import CourierScopeGate from "./CourierScopeGate";

// FEAT-24 H6-D (H6-D1) — el marco del modo almacén: cabecera móvil con la
// señal, lo que falta enviar y la bandeja «Para revisar», y el registro del
// service worker que guarda el shell de /almacen para abrirlo sin señal.

/** El service worker vive en /almacen-sw.js y solo controla /almacen (no el resto de POWIP). */
export const WAREHOUSE_SW_URL = "/almacen-sw.js";
export const WAREHOUSE_SCOPE = "/almacen";

export function registerWarehouseServiceWorker(nav: Navigator | undefined = typeof navigator === "undefined" ? undefined : navigator) {
  if (!nav || !("serviceWorker" in nav)) return;
  // En desarrollo no: la caché de /_next/static pisaría la recarga en caliente.
  if (process.env.NODE_ENV !== "production") return;
  void nav.serviceWorker.register(WAREHOUSE_SW_URL, { scope: WAREHOUSE_SCOPE }).catch(() => undefined);
}

function Header() {
  const pathname = usePathname();
  const { auth } = useAuth();
  const { online, outbox, review, syncing, flush } = useWarehouseQueue();
  const home = pathname === WAREHOUSE_SCOPE;
  const back = pathname.startsWith("/almacen/recibir/") ? "/almacen/recibir" : WAREHOUSE_SCOPE;

  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-lg items-center gap-2 px-4 py-2">
        {home ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/almacen/icon-192.png" alt="" width={32} height={32} className="h-8 w-8" />
        ) : (
          <Link href={back} aria-label="Volver" className="-ml-2 rounded-md p-2 hover:bg-muted">
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">Almacén</p>
          <p className="truncate text-xs text-muted-foreground">{auth?.company?.name ?? ""}</p>
        </div>
        {outbox.length > 0 ? (
          <button
            type="button"
            onClick={() => void flush()}
            disabled={!online || syncing}
            className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900 disabled:opacity-80 dark:bg-amber-950 dark:text-amber-200"
            aria-label={`${outbox.length} por enviar. Enviar ahora`}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} aria-hidden="true" />
            {outbox.length}
          </button>
        ) : null}
        {review.length > 0 ? (
          <Link
            href="/almacen/revisar"
            className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive"
            aria-label={`${review.length} para revisar`}
          >
            <Inbox className="h-3.5 w-3.5" aria-hidden="true" />
            {review.length}
          </Link>
        ) : null}
        <span
          role="status"
          className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
            online ? "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200" : "bg-muted text-muted-foreground"
          }`}
        >
          {online ? <Wifi className="h-3.5 w-3.5" aria-hidden="true" /> : <CloudOff className="h-3.5 w-3.5" aria-hidden="true" />}
          {online ? "En línea" : "Sin señal"}
        </span>
      </div>
    </header>
  );
}

export default function WarehouseShell({ children }: { children: ReactNode }) {
  useEffect(() => registerWarehouseServiceWorker(), []);
  return (
    <WarehouseQueueProvider>
      <div className="min-h-full bg-background">
        <Header />
        <div className="mx-auto max-w-lg px-4 pb-10 pt-4">
          <CourierScopeGate>{children}</CourierScopeGate>
        </div>
      </div>
    </WarehouseQueueProvider>
  );
}
