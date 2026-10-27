"use client";

import { Loader2, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LiveEmpty, LiveErrorBanner, LiveProductImage } from "./LiveShared";
import { getLiveCatalog, liveError, liveMoney } from "./liveService";
import type { LiveProduct } from "./types";

type CatalogSnapshot = {
  storeId: string;
  products: LiveProduct[];
  loading: boolean;
  error: string;
};

export default function LiveCatalogDialog({
  storeId,
  onClose,
  onSelect,
}: {
  storeId: string;
  onClose: () => void;
  onSelect: (item: LiveProduct) => void;
}) {
  const [search, setSearch] = useState("");
  const [snapshot, setSnapshot] = useState<CatalogSnapshot | null>(null);
  const request = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setSnapshot({ storeId, products: [], loading: true, error: "" });
    try {
      const result = await getLiveCatalog(storeId, "", controller.signal);
      if (!controller.signal.aborted)
        setSnapshot({ storeId, products: result.products, loading: false, error: "" });
    } catch (cause) {
      if (!controller.signal.aborted)
        setSnapshot({ storeId, products: [], loading: false, error: liveError(cause) });
    }
  }, [storeId]);
  useEffect(() => {
    void load();
    return () => request.current?.abort();
  }, [load]);

  // Keep a fresh snapshot for this opening; typing only filters these local rows.
  const items = useMemo(() => {
    if (snapshot?.storeId !== storeId) return [];
    const query = search.trim().toLocaleLowerCase();
    return query
      ? snapshot.products.filter((item) =>
          `${item.name} ${item.sku} ${item.variantLabel ?? ""}`.toLocaleLowerCase().includes(query),
        )
      : snapshot.products;
  }, [snapshot, storeId, search]);
  const current = snapshot?.storeId === storeId ? snapshot : null;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agregar al live</DialogTitle>
          <DialogDescription>
            Selecciona una variante de tu catálogo y define su precio live.
          </DialogDescription>
        </DialogHeader>
        <Input
          placeholder="Buscar por nombre o SKU"
          aria-label="Buscar producto para live"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {current?.error ? (
          <LiveErrorBanner message={current.error} onRetry={() => void load()} />
        ) : !current || current.loading ? (
          <div role="status" className="flex items-center justify-center gap-2 p-6 text-sm">
            <Loader2 className="animate-spin" aria-hidden="true" />
            Cargando productos…
          </div>
        ) : items.length ? (
          <div className="divide-y">
            {items.map((item) => (
              <button
                key={item.variantId}
                type="button"
                onClick={() => onSelect(item)}
                className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-muted"
              >
                <LiveProductImage product={item} className="h-12 w-12" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.variantLabel || item.sku} · {liveMoney(item.regularPrice)} ·{" "}
                    {item.availableStock} disp.
                  </p>
                </div>
                <Plus className="h-4 w-4" />
              </button>
            ))}
          </div>
        ) : (
          <LiveEmpty>No se encontraron variantes.</LiveEmpty>
        )}
      </DialogContent>
    </Dialog>
  );
}
