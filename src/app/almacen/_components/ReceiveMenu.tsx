"use client";

import Link from "next/link";
import { ArrowRightLeft, ChevronRight, ClipboardCheck, Undo2 } from "lucide-react";
import { isCourierRole } from "@/config/permissions.config";
import { useAuth } from "@/contexts/AuthContext";
import { warehouseAccess } from "@/lib/warehouseMode";

// FEAT-24 H6-D (H6-D3) — Recibir: devoluciones (H2), órdenes de compra (H3) y
// traslados en camino (H5).

const OPTIONS = [
  { title: "Devoluciones", description: "Lo que volvió del courier", href: "/almacen/recibir/devoluciones", icon: Undo2 },
  { title: "Órdenes de compra", description: "Lo que llega del proveedor", href: "/almacen/recibir/compras", icon: ClipboardCheck },
  { title: "Traslados", description: "Lo que llega de otro almacén", href: "/almacen/recibir/traslados", icon: ArrowRightLeft },
] as const;

export default function ReceiveMenu() {
  const { auth, hasPermission } = useAuth();
  const access = warehouseAccess(auth?.user, (permission) => hasPermission?.(permission) ?? false);
  // FEAT-24 H8-D5: el courier solo recibe traslados en su almacén; no se le ofrece lo demás.
  const courier = isCourierRole(auth?.user?.role);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold tracking-tight">Recibir</h1>
      {!access.receiveReturns && !courier ? (
        <p role="alert" className="rounded-md border p-4 text-sm">
          Tu rol no recibe mercadería. Lo hacen Administrador, Operaciones y Almacén.
        </p>
      ) : null}
      <ul className="space-y-2">
        {OPTIONS.filter((option) => !courier || option.href.endsWith("/traslados")).map((option) => {
          const Icon = option.icon;
          const enabled =
            "href" in option &&
            (option.href.endsWith("/compras")
              ? access.receivePurchases
              : option.href.endsWith("/traslados")
                ? access.receiveTransfers
                : access.receiveReturns);
          const content = (
            <>
              <Icon className="h-6 w-6 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{option.title}</span>
                <span className="block text-xs text-muted-foreground">{option.description}</span>
              </span>
              {enabled ? <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" /> : null}
            </>
          );
          return (
            <li key={option.title}>
              {enabled && "href" in option ? (
                <Link href={option.href} className="flex items-center gap-3 rounded-xl border p-4 hover:bg-muted/50 active:bg-muted">
                  {content}
                </Link>
              ) : (
                <div aria-disabled="true" className="flex cursor-not-allowed items-center gap-3 rounded-xl border bg-muted/40 p-4 opacity-60">
                  {content}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
