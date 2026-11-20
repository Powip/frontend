"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import { Boxes, ClipboardList, Download, Inbox, PackageCheck, Scale, ScanLine, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isCourierRole } from "@/config/permissions.config";
import { useWarehouseQueue } from "@/components/almacen/WarehouseQueueContext";
import { useAuth } from "@/contexts/AuthContext";
import { warehouseAccess } from "@/lib/warehouseMode";

// FEAT-24 H6-D (H6-D3) — inicio del modo almacén: los 4 accesos. Contar y
// recibir traslados llegaron con H5.

interface TileProps {
  href?: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  /** Motivo por el que no se puede usar (se muestra en lugar de entrar). */
  disabledReason?: string;
}

function Tile({ href, title, description, icon: Icon, disabledReason }: TileProps) {
  const body: ReactNode = (
    <>
      <Icon className="h-8 w-8" aria-hidden="true" />
      <span className="text-base font-semibold">{title}</span>
      <span className="text-xs text-muted-foreground">{disabledReason ?? description}</span>
    </>
  );
  const base = "flex min-h-32 flex-col items-start gap-2 rounded-xl border p-4 text-left";
  if (disabledReason || !href)
    return (
      <div aria-disabled="true" className={`${base} cursor-not-allowed bg-muted/40 opacity-60`} data-testid={`tile-${title}`}>
        {body}
      </div>
    );
  return (
    <Link href={href} className={`${base} bg-card shadow-sm transition-colors hover:bg-muted/50 active:bg-muted`} data-testid={`tile-${title}`}>
      {body}
    </Link>
  );
}

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

/** «Instalar» cuando el navegador lo ofrece (Chrome en Android); en iPhone se agrega desde Compartir. */
function InstallButton() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  useEffect(() => {
    const offer = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", offer);
    return () => window.removeEventListener("beforeinstallprompt", offer);
  }, []);
  if (!prompt) return null;
  return (
    <Button
      variant="outline"
      className="w-full"
      onClick={() => {
        void prompt.prompt().finally(() => setPrompt(null));
      }}
    >
      <Download className="mr-2 h-4 w-4" aria-hidden="true" />
      Instalar en este celular
    </Button>
  );
}

export default function WarehouseHome() {
  const { auth, hasPermission } = useAuth();
  const { outbox, review, persistent, otherSessions } = useWarehouseQueue();
  const access = warehouseAccess(auth?.user, (permission) => hasPermission?.(permission) ?? false);
  // FEAT-24 H8-D5: el personal del courier ve su portal (stock, recibir traslados, contar y la conciliación).
  const courier = isCourierRole(auth?.user?.role);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight">{courier ? "Portal del courier" : "Modo almacén"}</h1>
        <p className="text-sm text-muted-foreground">Escanea con la cámara o con el lector. Sin señal, lo que hagas se guarda y se envía después.</p>
      </div>

      {courier ? (
        <div className="grid grid-cols-2 gap-3">
          <Tile href="/almacen/stock" title="Stock" description="Tu almacén: POWIP y lo que reportas" icon={Boxes} />
          <Tile href="/almacen/recibir/traslados" title="Recibir" description="Traslados que llegan a tu almacén" icon={PackageCheck} />
          <Tile href="/almacen/contar" title="Contar" description="Tomas de inventario en curso" icon={ClipboardList} />
          <Tile href="/almacen/conciliacion" title="Conciliación" description="Diferencias con POWIP" icon={Scale} />
        </div>
      ) : (
      <div className="grid grid-cols-2 gap-3">
        <Tile href="/almacen/consultar" title="Consultar" description="Producto y stock por almacén" icon={Search} />
        <Tile
          href="/almacen/recibir"
          title="Recibir"
          description="Devoluciones, compras y traslados"
          icon={PackageCheck}
          disabledReason={access.receiveReturns ? undefined : "Tu rol no recibe mercadería"}
        />
        <Tile
          href="/almacen/contar"
          title="Contar"
          description="Tomas de inventario en curso"
          icon={ClipboardList}
          disabledReason={access.count ? undefined : "Tu rol no cuenta inventario"}
        />
        <Tile
          href="/almacen/picking"
          title="Picking"
          description="Pedidos a despachar"
          icon={ScanLine}
          disabledReason={access.picking ? undefined : "Necesitas permiso de Operaciones"}
        />
      </div>
      )}

      {outbox.length > 0 || review.length > 0 ? (
        <Link href="/almacen/revisar" className="flex items-center gap-3 rounded-xl border p-4 hover:bg-muted/50">
          <Inbox className="h-6 w-6 shrink-0" aria-hidden="true" />
          <span className="text-sm">
            {outbox.length > 0 ? <span className="block">{outbox.length} por enviar</span> : null}
            {review.length > 0 ? <span className="block font-medium text-destructive">{review.length} para revisar</span> : null}
          </span>
        </Link>
      ) : null}

      {!persistent ? (
        <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          Este navegador no permite guardar datos: lo que quede sin enviar se pierde si recargas la página.
        </p>
      ) : null}
      {otherSessions > 0 ? (
        <p className="text-xs text-muted-foreground">
          Hay {otherSessions} acción(es) guardadas de otro usuario o negocio en este celular: se envían cuando esa persona vuelva a entrar.
        </p>
      ) : null}

      <InstallButton />
      <p className="text-center text-xs text-muted-foreground">
        En iPhone: en Safari, Compartir › «Agregar a pantalla de inicio». La app necesita señal para abrir la sesión.
      </p>
    </div>
  );
}
