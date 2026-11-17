"use client";

import Link from "next/link";
import { ArrowRightLeft, ChevronRight, ClipboardCheck, Undo2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { warehouseAccess } from "@/lib/warehouseMode";

// FEAT-24 H6-D (H6-D3) — Recibir: hoy solo devoluciones (H2). Las órdenes de
// compra llegan con H3 y los traslados con H5: se ven pero deshabilitados.

const OPTIONS = [
  { title: "Devoluciones", description: "Lo que volvió del courier", href: "/almacen/recibir/devoluciones", icon: Undo2 },
  { title: "Órdenes de compra", description: "Próximamente", icon: ClipboardCheck },
  { title: "Traslados", description: "Próximamente", icon: ArrowRightLeft },
] as const;

export default function ReceiveMenu() {
  const { auth, hasPermission } = useAuth();
  const access = warehouseAccess(auth?.user, (permission) => hasPermission?.(permission) ?? false);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold tracking-tight">Recibir</h1>
      {!access.receiveReturns ? (
        <p role="alert" className="rounded-md border p-4 text-sm">
          Tu rol no recibe mercadería. Lo hacen Administrador, Operaciones y Almacén.
        </p>
      ) : null}
      <ul className="space-y-2">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const enabled = "href" in option && access.receiveReturns;
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
