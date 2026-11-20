"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { hasAdminAccess } from "@/config/permissions.config";
import { useCatalogCategories } from "@/hooks/useCatalogCategories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiErrorInfo } from "@/lib/catalog/catalogPayloads";
import {
  CATEGORY_NAME_MAX,
  flattenCategoryTree,
  MAX_CATEGORY_LEVELS,
  siblingsOf,
  validateCategoryName,
  type CatalogCategoryNode,
} from "@/lib/catalog/categoryTree";
import { NATIVE_SELECT_CLASS } from "./CategoryTreeSelect";

const ROOT = "";

/**
 * Correcciones 11-20 (B1) — «Nueva categoría» al lado del selector de categoría del producto (alta y ficha):
 * se crea sin salir del formulario y queda elegida. Mismas reglas que Catálogo › Categorías (H4-D): solo el
 * Administrador, nombre único entre hermanas y hasta 3 niveles (se ofrecen de padre solo las activas con lugar).
 */
export default function CategoryQuickCreate({
  tree,
  onCreated,
  disabled = false,
}: {
  tree: CatalogCategoryNode[];
  onCreated: (categoryId: string) => void;
  disabled?: boolean;
}) {
  const { auth } = useAuth();
  const { createCategory } = useCatalogCategories();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState(ROOT);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!hasAdminAccess(auth?.user?.role)) return null;

  const parents = flattenCategoryTree(tree, { activeOnly: true }).filter((option) => option.level < MAX_CATEGORY_LEVELS);

  const submit = async () => {
    const clean = name.trim().replace(/\s+/g, " ");
    const problem = validateCategoryName(clean, siblingsOf(tree, parentId || null));
    if (problem) return setError(problem);
    setSaving(true);
    setError(null);
    try {
      const created = await createCategory({ name: clean, parentId: parentId || null });
      onCreated(created.id);
      toast.success(`Categoría «${created.name}» creada`);
      setOpen(false);
    } catch (err) {
      setError(apiErrorInfo(err, "No se pudo crear la categoría.").message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 shrink-0"
        disabled={disabled}
        onClick={() => {
          setName("");
          setParentId(ROOT);
          setError(null);
          setOpen(true);
        }}
      >
        <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
        Nueva categoría
      </Button>
      <Dialog open={open} onOpenChange={(next) => !saving && setOpen(next)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva categoría</DialogTitle>
            <DialogDescription>Queda elegida en este producto. Se administran en Catálogo › Categorías.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="category-quick-name">Nombre</Label>
              <Input id="category-quick-name" value={name} maxLength={CATEGORY_NAME_MAX} autoFocus onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="category-quick-parent">Dentro de</Label>
              <select id="category-quick-parent" className={NATIVE_SELECT_CLASS} value={parentId} onChange={(event) => setParentId(event.target.value)}>
                <option value={ROOT}>Ninguna (categoría principal)</option>
                {parents.map((option) => (
                  <option key={option.id} value={option.id} title={option.path}>
                    {`${"   ".repeat(option.level - 1)}${option.name}`}
                  </option>
                ))}
              </select>
            </div>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={saving} onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || !name.trim()}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                Crear categoría
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
