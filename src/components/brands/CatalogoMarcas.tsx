"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useCompanyBrands, type CompanyBrand } from "@/hooks/useCompanyBrands";
import { apiErrorInfo } from "@/lib/catalog/catalogPayloads";

const MAX_NAME = 255;
const clean = (value: string) => value.trim().replace(/\s+/g, " ");
const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * Configuración › Tiendas › Marcas (correcciones 11-20, B1): las marcas de la empresa del token (`/brands` de
 * ms-products, FEAT-24 H0), las mismas que se eligen o crean en el producto. Se crean, renombran y desactivan
 * (desactivar no borra: los productos que la tienen la conservan, y crearla de nuevo con el mismo nombre la
 * reactiva). Reemplaza la pantalla por proveedor, que llamaba a `/brand` (ruta que ya no existe).
 */
export default function CatalogoMarcas() {
  const { brands, isLoading, isError, createBrand, renameBrand, deactivateBrand } = useCompanyBrands();
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDeactivate, setToDeactivate] = useState<CompanyBrand | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => {
    const query = fold(clean(search));
    const sorted = [...brands].sort((a, b) => a.name.localeCompare(b.name, "es"));
    return query ? sorted.filter((brand) => fold(brand.name).includes(query)) : sorted;
  }, [brands, search]);

  const create = async () => {
    const name = clean(newName);
    if (!name || creating) return;
    setCreating(true);
    setError(null);
    try {
      const brand = await createBrand(name);
      setNewName("");
      toast.success(`Marca «${brand.name}» lista`);
    } catch (err) {
      setError(apiErrorInfo(err, "No se pudo crear la marca.").message);
    } finally {
      setCreating(false);
    }
  };

  const saveRename = async () => {
    if (!editing) return;
    const name = clean(editing.name);
    if (!name) return setError("Escribe el nombre de la marca.");
    setSaving(true);
    setError(null);
    try {
      await renameBrand(editing.id, name);
      setEditing(null);
      toast.success("Marca renombrada");
    } catch (err) {
      setError(apiErrorInfo(err, "No se pudo renombrar la marca.").message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDeactivate = async () => {
    if (!toDeactivate) return;
    setError(null);
    try {
      await deactivateBrand(toDeactivate.id);
      toast.success(`Marca «${toDeactivate.name}» desactivada`);
    } catch (err) {
      setError(apiErrorInfo(err, "No se pudo desactivar la marca.").message);
    } finally {
      setToDeactivate(null);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border bg-card p-6">
      <div>
        <h3 className="text-lg font-medium">Marcas</h3>
        <p className="text-sm text-muted-foreground">
          Las marcas de tu empresa. También se crean desde el producto, escribiendo el nombre en «Marca».
        </p>
      </div>

      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
      >
        <div className="space-y-1 sm:w-72">
          <Label htmlFor="brand-new">Nueva marca</Label>
          <Input id="brand-new" value={newName} maxLength={MAX_NAME} placeholder="Ej.: Nike" onChange={(event) => setNewName(event.target.value)} />
        </div>
        <Button type="submit" disabled={!clean(newName) || creating}>
          {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="mr-2 h-4 w-4" aria-hidden="true" />}
          Crear marca
        </Button>
      </form>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="relative sm:w-72">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <Input aria-label="Buscar marca" className="pl-8" placeholder="Buscar marca" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>

      {isLoading ? (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Cargando marcas…
        </p>
      ) : isError ? (
        <p role="alert" className="text-sm text-destructive">
          No se pudieron cargar las marcas.
        </p>
      ) : visible.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          {brands.length === 0 ? "Aún no tienes marcas. Crea la primera arriba." : "Ninguna marca coincide con la búsqueda."}
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {visible.map((brand) =>
            editing?.id === brand.id ? (
              <li key={brand.id}>
                <form
                  className="flex flex-col gap-2 p-2 sm:flex-row sm:items-center"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveRename();
                  }}
                >
                  <Input
                    aria-label={`Nuevo nombre de ${brand.name}`}
                    className="sm:w-72"
                    value={editing.name}
                    maxLength={MAX_NAME}
                    autoFocus
                    onChange={(event) => setEditing({ id: brand.id, name: event.target.value })}
                  />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={saving}>
                      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                      Guardar
                    </Button>
                    <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={() => setEditing(null)}>
                      Cancelar
                    </Button>
                  </div>
                </form>
              </li>
            ) : (
              <li key={brand.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="text-sm">{brand.name}</span>
                <span className="flex gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    aria-label={`Renombrar ${brand.name}`}
                    onClick={() => {
                      setError(null);
                      setEditing({ id: brand.id, name: brand.name });
                    }}
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    aria-label={`Desactivar ${brand.name}`}
                    onClick={() => {
                      setError(null);
                      setToDeactivate(brand);
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </span>
              </li>
            ),
          )}
        </ul>
      )}

      <AlertDialog open={toDeactivate !== null} onOpenChange={(open) => (open ? null : setToDeactivate(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{`¿Desactivar la marca «${toDeactivate?.name ?? ""}»?`}</AlertDialogTitle>
            <AlertDialogDescription>
              Deja de ofrecerse al elegir la marca de un producto. Los productos que ya la tienen no cambian. Si la vuelves a
              crear con el mismo nombre, se reactiva.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmDeactivate();
              }}
            >
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
