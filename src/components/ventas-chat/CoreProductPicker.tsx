"use client";
import { useEffect, useMemo, useState } from "react";
import { Package, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCoreCatalog } from "@/hooks/useCrmSalesTools";

interface Props {
  /** productId del Core vinculado; vacío = sin vínculo. */
  value: string;
  onChange: (productId: string) => void;
}

/** Vincula una ficha a un producto de Powip Core (fila 49). */
export default function CoreProductPicker({ value, onChange }: Props) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);
  const catalog = useCoreCatalog(debounced, open || !!value);

  // Una fila por producto (las variantes se ven en la Ficha).
  const products = useMemo(() => {
    const map = new Map<string, { productId: string; name: string; variants: number; from: number }>();
    for (const it of catalog.data?.items ?? []) {
      const cur = map.get(it.productId);
      if (cur) {
        cur.variants += 1;
        cur.from = Math.min(cur.from, it.unitPrice);
      } else map.set(it.productId, { productId: it.productId, name: it.name, variants: 1, from: it.unitPrice });
    }
    return [...map.values()];
  }, [catalog.data]);
  const current = products.find((p) => p.productId === value);

  return (
    <div className="space-y-1">
      <Label htmlFor="sh-core-search">Producto del Core (precios y stock en vivo)</Label>
      {value ? (
        <div className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm" data-testid="core-linked">
          <Package className="h-4 w-4 text-primary" aria-hidden />
          <span className="min-w-0 flex-1 break-words sm:truncate">{current?.name ?? `Producto ${value}`}</span>
          <Button type="button" size="sm" variant="ghost" aria-label="Quitar vínculo con el Core" onClick={() => onChange("")}>
            <X />
          </Button>
        </div>
      ) : (
        <>
          <Input
            id="sh-core-search"
            icon={Search}
            placeholder="Buscar en el catálogo…"
            value={search}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setSearch(e.target.value);
              setOpen(true);
            }}
          />
          {open && (
            <ul aria-label="Productos del Core" className="max-h-40 space-y-1 overflow-y-auto">
              {catalog.data?.source === "mock" && (
                <li>
                  <Badge variant="outline">Catálogo de demostración</Badge>
                </li>
              )}
              {catalog.isLoading && <li className="text-xs text-muted-foreground">Buscando…</li>}
              {catalog.data && products.length === 0 && (
                <li className="text-xs text-muted-foreground">Ningún producto coincide.</li>
              )}
              {products.map((p) => (
                <li key={p.productId}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(p.productId);
                      setOpen(false);
                    }}
                    className="flex w-full items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-left text-xs hover:bg-accent/50"
                  >
                    <span className="min-w-0 break-words sm:truncate font-medium">{p.name}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {p.variants} var. · desde S/ {p.from.toFixed(2)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
