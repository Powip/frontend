"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useCompanyBrands } from "@/hooks/useCompanyBrands";

const normalize = (value: string) =>
  value.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");

/** FEAT-24 H0 — marca de la empresa, con "Crear marca" en la misma lista. Ya no pasa por el proveedor. */
export default function BrandSelect({ value, onChange, disabled }: { value: string; onChange: (brandId: string) => void; disabled?: boolean }) {
  const { brands, createBrand } = useCompanyBrands();
  const selected = brands.find((brand) => brand.id === value);
  const [query, setQuery] = useState(selected?.name ?? "");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) setQuery(selected?.name ?? "");
  }, [selected?.name, open]);

  const typed = normalize(query);
  const showAll = !typed || typed === normalize(selected?.name ?? "");
  const matches = showAll ? brands : brands.filter((brand) => normalize(brand.name).includes(typed));
  const exact = brands.some((brand) => normalize(brand.name) === typed);

  const choose = (brandId: string, name: string) => {
    onChange(brandId);
    setQuery(name);
    setOpen(false);
  };

  const create = async () => {
    const name = query.trim().replace(/\s+/g, " ");
    setCreating(true);
    try {
      const brand = await createBrand(name);
      choose(brand.id, brand.name);
    } catch {
      toast.error("No se pudo crear la marca.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="relative space-y-2">
      <Label htmlFor="brand-select">Marca</Label>
      <Input
        id="brand-select"
        autoComplete="off"
        placeholder="Busca o crea una marca"
        value={query}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
      />
      {open && !disabled ? (
        <ul role="listbox" className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover p-1 shadow">
          <li>
            <button type="button" role="option" aria-selected={!value} className="w-full rounded px-2 py-1 text-left text-sm text-muted-foreground hover:bg-muted" onMouseDown={(event) => event.preventDefault()} onClick={() => choose("", "")}>
              Sin marca
            </button>
          </li>
          {matches.map((brand) => (
            <li key={brand.id}>
              <button type="button" role="option" aria-selected={brand.id === value} className="w-full rounded px-2 py-1 text-left text-sm hover:bg-muted" onMouseDown={(event) => event.preventDefault()} onClick={() => choose(brand.id, brand.name)}>
                {brand.name}
              </button>
            </li>
          ))}
          {typed && !exact ? (
            <li>
              <button type="button" role="option" aria-selected={false} disabled={creating} className="w-full rounded px-2 py-1 text-left text-sm font-medium text-primary hover:bg-muted" onMouseDown={(event) => event.preventDefault()} onClick={() => void create()}>
                {`Crear marca "${query.trim().replace(/\s+/g, " ")}"`}
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
