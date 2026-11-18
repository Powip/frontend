"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { opsErrorMessage, type DraftLine } from "@/lib/warehouseOps";
import { formatVariantLabel } from "@/lib/variantAttributes";
import { listProductVariants, listPurchasableProducts, type PurchasableProduct } from "@/services/purchasesService";
import { SELECT_CLASS } from "./OpsBits";

// FEAT-24 H5-C — «Agregar producto con sus variantes» (el mismo buscador de la
// orden de compra, mockup mTraslado): se elige el producto y entran todas sus
// variantes activas como líneas (cantidad vacía, o la que se pase).

const MAX_MATCHES = 30;

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

interface Props {
  companyId: string;
  disabled?: boolean;
  /** Cantidad inicial de cada variante agregada. */
  initialQuantity?: string;
  idPrefix?: string;
  onAdd: (lines: DraftLine[]) => number;
}

export default function VariantLinePicker({ companyId, disabled = false, initialQuantity = "", idPrefix = "ops", onAdd }: Props) {
  const [search, setSearch] = useState("");
  const [productId, setProductId] = useState("");
  const [adding, setAdding] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const productsQuery = useQuery({
    queryKey: ["purchasable-products", companyId],
    queryFn: ({ signal }) => listPurchasableProducts(companyId, signal),
    enabled: !!companyId,
    staleTime: 60_000,
  });
  const products = useMemo(() => (productsQuery.data ?? []).filter((product) => product.status), [productsQuery.data]);
  const matches = useMemo(() => {
    const query = fold(search.trim());
    if (!query) return products.slice(0, MAX_MATCHES);
    return products
      .filter((product) => [product.name, product.sku, product.companySku ?? ""].some((value) => fold(value).includes(query)))
      .slice(0, MAX_MATCHES);
  }, [products, search]);

  const add = async (product: PurchasableProduct) => {
    setAdding(true);
    setInfo(null);
    try {
      const variants = (await listProductVariants(product.id)).filter((variant) => variant.isActive && !variant.mergedInto);
      if (variants.length === 0) {
        setInfo(`${product.name} no tiene variantes activas.`);
        return;
      }
      const added = onAdd(
        variants.map((variant) => ({
          variantId: variant.id,
          label: [product.name, formatVariantLabel(variant.attributeValues)].filter(Boolean).join(" · "),
          sku: variant.companySku || variant.sku,
          quantity: initialQuantity,
        })),
      );
      setInfo(
        added === 0
          ? `Las variantes de ${product.name} ya están en la lista.`
          : `${added === 1 ? "Se agregó 1 variante" : `Se agregaron ${added} variantes`} de ${product.name}.`,
      );
      setProductId("");
    } catch (error) {
      setInfo(opsErrorMessage(error, "No se pudieron traer las variantes. Inténtalo de nuevo."));
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-2 rounded-md border p-3">
      <Label htmlFor={`${idPrefix}-product-search`}>Agregar producto</Label>
      <div className="flex flex-col gap-2 md:flex-row">
        <div className="relative md:w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            id={`${idPrefix}-product-search`}
            className="pl-8"
            placeholder="Busca por nombre o SKU"
            value={search}
            disabled={disabled}
            onChange={(event) => {
              setSearch(event.target.value);
              setProductId("");
            }}
          />
        </div>
        <select
          aria-label="Producto"
          className={`${SELECT_CLASS} md:flex-1`}
          value={productId}
          disabled={disabled || adding}
          onChange={(event) => setProductId(event.target.value)}
        >
          <option value="">{productsQuery.isLoading ? "Cargando productos…" : `Elige un producto (${matches.length})`}</option>
          {matches.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
              {product.companySku || product.sku ? ` · ${product.companySku || product.sku}` : ""}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="outline"
          disabled={!productId || adding || disabled}
          onClick={() => {
            const product = products.find((candidate) => candidate.id === productId);
            if (product) void add(product);
          }}
        >
          {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="mr-2 h-4 w-4" aria-hidden="true" />}
          Agregar con sus variantes
        </Button>
      </div>
      {productsQuery.isError ? (
        <p role="alert" className="text-xs text-destructive">
          {opsErrorMessage(productsQuery.error, "No se pudieron cargar los productos.")}
        </p>
      ) : null}
      {info ? (
        <p role="status" className="text-xs text-muted-foreground">
          {info}
        </p>
      ) : null}
    </div>
  );
}
