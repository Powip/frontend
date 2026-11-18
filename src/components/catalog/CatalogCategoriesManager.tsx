"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FolderTree, Loader2, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { hasAdminAccess } from "@/config/permissions.config";
import { useCatalogCategories } from "@/hooks/useCatalogCategories";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NATIVE_SELECT_CLASS } from "./CategoryTreeSelect";
import { apiErrorInfo } from "@/lib/catalog/catalogPayloads";
import {
  MAX_CATEGORY_LEVELS,
  canAddChild,
  categoryPath,
  moveTargets,
  siblingsOf,
  validateCategoryName,
  type CatalogCategoryNode,
} from "@/lib/catalog/categoryTree";

type DialogState =
  | { mode: "create"; parent: CatalogCategoryNode | null }
  | { mode: "rename"; node: CatalogCategoryNode }
  | { mode: "move"; node: CatalogCategoryNode };

const ROOT = "__root__";

/**
 * FEAT-24 H4 (H4-D4) — Catálogo › Categorías: árbol propio de la empresa, hasta 3 niveles. Crear,
 * renombrar, mover y desactivar (no se borran). Solo el administrador edita.
 */
export default function CatalogCategoriesManager() {
  const { auth } = useAuth();
  const canEdit = hasAdminAccess(auth?.user?.role);
  const { tree, isLoading, error, refetch, createCategory, updateCategory, isSaving } = useCatalogCategories();
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [name, setName] = useState("");
  const [target, setTarget] = useState(ROOT);
  const [formError, setFormError] = useState<string | null>(null);

  const open = (next: DialogState) => {
    setDialog(next);
    setFormError(null);
    setName(next.mode === "rename" ? next.node.name : "");
    // Una de nivel 1 no puede «quedarse» en el nivel 1: arranca en el primer destino posible.
    setTarget(next.mode === "move" && !next.node.parentId ? moveTargets(tree, next.node.id)[0]?.id ?? ROOT : ROOT);
  };

  const submit = async () => {
    if (!dialog) return;
    setFormError(null);
    try {
      if (dialog.mode === "create") {
        const problem = validateCategoryName(name, siblingsOf(tree, dialog.parent?.id ?? null));
        if (problem) return setFormError(problem);
        await createCategory({ name: name.trim().replace(/\s+/g, " "), parentId: dialog.parent?.id ?? null });
        toast.success("Categoría creada");
      } else if (dialog.mode === "rename") {
        const problem = validateCategoryName(name, siblingsOf(tree, dialog.node.parentId), dialog.node.id);
        if (problem) return setFormError(problem);
        await updateCategory({ id: dialog.node.id, name: name.trim().replace(/\s+/g, " ") });
        toast.success("Categoría renombrada");
      } else {
        const parentId = target === ROOT ? null : target;
        const problem = validateCategoryName(dialog.node.name, siblingsOf(tree, parentId), dialog.node.id);
        if (problem) return setFormError(problem);
        await updateCategory({ id: dialog.node.id, parentId });
        toast.success("Categoría movida");
      }
      setDialog(null);
    } catch (err) {
      setFormError(apiErrorInfo(err, "No se pudo guardar la categoría.").message);
    }
  };

  const toggleActive = async (node: CatalogCategoryNode) => {
    try {
      await updateCategory({ id: node.id, active: !node.active });
      toast.success(node.active ? `«${node.name}» desactivada` : `«${node.name}» activada`);
    } catch (err) {
      toast.error(apiErrorInfo(err, "No se pudo cambiar el estado de la categoría.").message);
    }
  };

  const renderNode = (node: CatalogCategoryNode) => (
    <li key={node.id}>
      <div className="flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50">
        <span className={node.active ? "font-medium" : "font-medium text-muted-foreground line-through"}>{node.name}</span>
        <Badge variant="outline" className="text-[10px]">Nivel {node.level}</Badge>
        {!node.active ? <Badge variant="outline" className="text-muted-foreground">Desactivada</Badge> : null}
        {canEdit ? (
          <span className="ml-auto flex flex-wrap gap-1">
            {canAddChild(node) ? <Button size="sm" variant="ghost" aria-label={`Nueva subcategoría en ${node.name}`} onClick={() => open({ mode: "create", parent: node })}><Plus className="mr-1 h-3 w-3" />Subcategoría</Button> : null}
            <Button size="sm" variant="ghost" aria-label={`Renombrar ${node.name}`} onClick={() => open({ mode: "rename", node })}>Renombrar</Button>
            {node.active ? <Button size="sm" variant="ghost" aria-label={`Mover ${node.name}`} onClick={() => open({ mode: "move", node })}>Mover</Button> : null}
            <Button size="sm" variant="ghost" aria-label={`${node.active ? "Desactivar" : "Activar"} ${node.name}`} disabled={isSaving} onClick={() => void toggleActive(node)}>{node.active ? "Desactivar" : "Activar"}</Button>
          </span>
        ) : null}
      </div>
      {node.children.length ? <ul className="ml-5 border-l pl-3">{node.children.map(renderNode)}</ul> : null}
    </li>
  );

  const moveOptions = dialog?.mode === "move" ? moveTargets(tree, dialog.node.id) : [];
  const title = dialog?.mode === "create" ? (dialog.parent ? `Nueva subcategoría en «${dialog.parent.name}»` : "Nueva categoría")
    : dialog?.mode === "rename" ? `Renombrar «${dialog.node.name}»`
    : dialog?.mode === "move" ? `Mover «${dialog.node.name}»` : "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Categorías de tu catálogo, hasta {MAX_CATEGORY_LEVELS} niveles (ej.: Ropa › Polos › Manga corta). Una categoría con productos no se borra: se desactiva.
          «Shopify» ya no es una categoría: es un canal.
        </p>
        {canEdit ? <Button onClick={() => open({ mode: "create", parent: null })}><Plus className="mr-2 h-4 w-4" />Nueva categoría</Button> : null}
      </div>
      {!canEdit ? <p className="text-sm text-muted-foreground">Solo el administrador puede crear o cambiar categorías.</p> : null}
      <Card>
        <CardContent className="pt-6">
          {error ? <div role="alert">No se pudieron cargar las categorías. <Button variant="outline" size="sm" onClick={() => void refetch()}>Reintentar</Button></div>
            : isLoading ? <p role="status">Cargando categorías...</p>
            : tree.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
                <FolderTree className="h-8 w-8" />
                <p>Todavía no hay categorías. {canEdit ? "Crea la primera con «Nueva categoría»." : ""}</p>
              </div>
            ) : <ul className="space-y-1">{tree.map(renderNode)}</ul>}
        </CardContent>
      </Card>

      <Dialog open={dialog !== null} onOpenChange={(value) => { if (!value && !isSaving) setDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {dialog?.mode === "move" ? `Hoy está en ${dialog.node.parentId ? categoryPath(tree, dialog.node.parentId) : "el nivel 1"}.` : "El nombre no se puede repetir dentro del mismo nivel."}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
            {dialog?.mode === "move" ? (
              <div className="space-y-2">
                <Label htmlFor="category-move-target">Nueva ubicación</Label>
                <select id="category-move-target" className={NATIVE_SELECT_CLASS} value={target} onChange={(event) => setTarget(event.target.value)}>
                  {dialog.node.parentId ? <option value={ROOT}>Nivel 1 (sin categoría padre)</option> : <option value={ROOT} disabled>Elige dónde moverla</option>}
                  {moveOptions.map((option) => <option key={option.id} value={option.id}>{option.path}</option>)}
                </select>
                {moveOptions.length === 0 && !dialog.node.parentId ? <p className="text-xs text-muted-foreground">No hay dónde moverla sin pasar de {MAX_CATEGORY_LEVELS} niveles.</p> : null}
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="category-name">Nombre</Label>
                <Input id="category-name" autoFocus value={name} maxLength={100} onChange={(event) => { setName(event.target.value); setFormError(null); }} />
              </div>
            )}
            {formError ? <p role="alert" className="text-sm text-red-600">{formError}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={isSaving} onClick={() => setDialog(null)}>Cancelar</Button>
              <Button type="submit" disabled={isSaving || (dialog?.mode === "move" && !dialog.node.parentId && target === ROOT)}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
