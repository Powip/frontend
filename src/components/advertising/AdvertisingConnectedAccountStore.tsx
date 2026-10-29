"use client";

import Link from "next/link";
import type { AdvertisingSnapshotOptions } from "@/hooks/useAdvertisingSnapshot";
import { useAdvertisingAssignmentsV11 } from "@/hooks/useAdvertisingV11";
import { useAdvertisingStoreFilter } from "./AdvertisingStoreFilterContext";
import { advertisingSectionHref } from "./advertising-sections";

export function AdvertisingConnectedAccountStore({
  accountId,
  identity,
}: {
  accountId: string;
  identity: AdvertisingSnapshotOptions;
}) {
  const { storeId } = useAdvertisingStoreFilter();
  const query = useAdvertisingAssignmentsV11(identity);
  const account = query.data?.accounts.find((row) => row.id === accountId);
  const storeName =
    account?.mode === "multi"
      ? "Varias tiendas"
      : account?.storeId
        ? (query.data?.stores.find((store) => store.id === account.storeId)?.name ??
          "Tienda anterior")
        : account
          ? "Sin asignar"
          : "Por confirmar";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/30 px-3 py-2 text-sm">
      <span>Tienda: {storeName}</span>
      <Link
        href={advertisingSectionHref("/publicidad/asignaciones", identity.from, identity.to, {
          storeId,
        })}
        className="text-xs font-medium text-primary underline-offset-4 hover:underline"
      >
        Cambiar en Asignaciones →
      </Link>
      {query.isError ? (
        <span role="status" className="w-full text-xs text-muted-foreground">
          No se pudo consultar la asignación.
        </span>
      ) : null}
    </div>
  );
}
