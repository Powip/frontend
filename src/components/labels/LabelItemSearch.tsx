"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listPurchasableProducts, type PurchasableProduct } from "@/services/purchasesService";
import { lookupVariantsByCodes, type VariantCodeMatch } from "@/services/variantCodesService";

// Correcciones 11-20 (B2) — buscador de «Imprimir etiquetas»: por nombre o SKU se elige un producto (entra con
// sus variantes); con Enter o el lector, el código exacto (código de barras, SKU de la variante o EAN de Powip)
// agrega solo esa variante.

const MAX_MATCHES = 8;

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

interface Props {
  companyId: string;
  disabled?: boolean;
  /** Agrega el producto con todas sus variantes; devuelve el aviso para el usuario. */
  onAddProduct: (product: PurchasableProduct) => string;
  /** Agrega solo la variante del código; devuelve el aviso para el usuario. */
  onAddVariant: (match: VariantCodeMatch) => string;
}

export function LabelItemSearch({ companyId, disabled = false, onAddProduct, onAddVariant }: Props) {
  const [search, setSearch] = useState("");
  const [looking, setLooking] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const query = search.trim();

  const products = useQuery({
    queryKey: ["purchasable-products", companyId],
    queryFn: ({ signal }) => listPurchasableProducts(companyId, signal),
    enabled: Boolean(companyId) && query !== "",
    staleTime: 60_000,
  });
  const matches = useMemo(() => {
    const folded = fold(query);
    if (!folded) return [];
    return (products.data ?? [])
      .filter((product) => product.status && [product.name, product.sku, product.companySku ?? ""].some((value) => fold(value).includes(folded)))
      .slice(0, MAX_MATCHES);
  }, [products.data, query]);

  const addProduct = (product: PurchasableProduct) => {
    setInfo(onAddProduct(product));
    setSearch("");
  };

  const lookupCode = async () => {
    if (!query || looking) return;
    setLooking(true);
    setInfo(null);
    try {
      const [match] = await lookupVariantsByCodes([query], companyId);
      if (match) {
        setInfo(onAddVariant(match));
        setSearch("");
      } else if (matches.length === 1) {
        addProduct(matches[0]);
      } else {
        setInfo(`No encontramos «${query}». Elige el producto en la lista.`);
      }
    } catch {
      setInfo("No se pudo buscar el código. Inténtalo de nuevo.");
    } finally {
      setLooking(false);
    }
  };

  return (
    <div className="space-y-1">
      <Label htmlFor="labels-search">Agregar a la lista</Label>
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <Input
          id="labels-search"
          className="pl-8"
          autoComplete="off"
          placeholder="Nombre, SKU o código de barras (Enter para el código)"
          value={search}
          disabled={disabled}
          onChange={(event) => {
            setSearch(event.target.value);
            setInfo(null);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            void lookupCode();
          }}
        />
        {looking ? <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" /> : null}
      </div>
      {query && matches.length > 0 ? (
        <ul className="max-h-40 overflow-auto rounded-md border p-1">
          {matches.map((product) => {
            const label = `${product.name}${product.companySku || product.sku ? ` · ${product.companySku || product.sku}` : ""}`;
            return (
              <li key={product.id}>
                <button
                  type="button"
                  aria-label={`Agregar ${label}`}
                  className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-muted"
                  onClick={() => addProduct(product)}
                >
                  <Plus className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {query && products.isFetching && !products.data ? <p className="text-xs text-muted-foreground">Buscando…</p> : null}
      {info ? (
        <p role="status" className="text-xs text-muted-foreground">
          {info}
        </p>
      ) : null}
    </div>
  );
}
