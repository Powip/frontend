/**
 * FEAT-24 H4 (H4-D4) — categorías propias de la empresa, hasta 3 niveles. Lógica pura sobre el árbol
 * que devuelve `GET /catalog-categories` (ms-products): `[{ id, name, parentId, active, level, children }]`.
 */

export const MAX_CATEGORY_LEVELS = 3;
export const CATEGORY_NAME_MAX = 100;

export interface CatalogCategoryNode {
  id: string;
  name: string;
  parentId: string | null;
  active: boolean;
  level: number;
  children: CatalogCategoryNode[];
}

/** Una categoría aplanada para listas y selectores (orden del árbol, padre antes que hijos). */
export interface CategoryOption {
  id: string;
  name: string;
  level: number;
  active: boolean;
  /** «Ropa › Polos › Manga corta». */
  path: string;
}

export const PATH_SEPARATOR = " › ";

const nameKey = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("es");

/** Recorre el árbol en orden (padre, luego hijos). Con `activeOnly`, una desactivada se va con lo que cuelga. */
export function flattenCategoryTree(tree: CatalogCategoryNode[], options: { activeOnly?: boolean } = {}): CategoryOption[] {
  const out: CategoryOption[] = [];
  const walk = (nodes: CatalogCategoryNode[], prefix: string, depth: number) => {
    for (const node of nodes) {
      if (options.activeOnly && !node.active) continue;
      const path = prefix ? `${prefix}${PATH_SEPARATOR}${node.name}` : node.name;
      out.push({ id: node.id, name: node.name, level: depth, active: node.active, path });
      walk(node.children ?? [], path, depth + 1);
    }
  };
  walk(tree, "", 1);
  return out;
}

export function findCategory(tree: CatalogCategoryNode[], id: string | null | undefined): CatalogCategoryNode | null {
  if (!id) return null;
  for (const node of tree) {
    if (node.id === id) return node;
    const found = findCategory(node.children ?? [], id);
    if (found) return found;
  }
  return null;
}

/** «Ropa › Polos» o `null` si la categoría no está en el árbol. */
export function categoryPath(tree: CatalogCategoryNode[], id: string | null | undefined): string | null {
  if (!id) return null;
  return flattenCategoryTree(tree).find((option) => option.id === id)?.path ?? null;
}

/** La categoría y todo lo que cuelga de ella (para filtrar el listado por una rama). */
export function descendantIds(tree: CatalogCategoryNode[], id: string): string[] {
  const node = findCategory(tree, id);
  if (!node) return [];
  return [node.id, ...flattenCategoryTree(node.children ?? []).map((option) => option.id)];
}

/** Altura del subárbol: una hoja = 1. */
export function subtreeHeight(node: CatalogCategoryNode): number {
  return 1 + Math.max(0, ...(node.children ?? []).map(subtreeHeight));
}

/** ¿Se le puede crear una subcategoría? (no pasar de 3 niveles y estar activa). */
export function canAddChild(node: CatalogCategoryNode): boolean {
  return node.active && node.level < MAX_CATEGORY_LEVELS;
}

/**
 * Padres válidos para mover `id`: activos, que no sean ella ni algo que cuelgue de ella, y donde el
 * subárbol entero entre en 3 niveles. «Nivel 1» (sin padre) lo agrega la pantalla.
 */
export function moveTargets(tree: CatalogCategoryNode[], id: string): CategoryOption[] {
  const node = findCategory(tree, id);
  if (!node) return [];
  const blocked = new Set(descendantIds(tree, id));
  const height = subtreeHeight(node);
  return flattenCategoryTree(tree, { activeOnly: true })
    .filter((option) => !blocked.has(option.id) && option.id !== node.parentId && option.level + height <= MAX_CATEGORY_LEVELS);
}

export function siblingsOf(tree: CatalogCategoryNode[], parentId: string | null): CatalogCategoryNode[] {
  if (!parentId) return tree;
  return findCategory(tree, parentId)?.children ?? [];
}

/** Valida el nombre antes de mandarlo (el servidor igual responde 409 si se repite en el nivel). */
export function validateCategoryName(name: string, siblings: CatalogCategoryNode[], exceptId?: string): string | null {
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean) return "Escribe el nombre de la categoría.";
  if (clean.length > CATEGORY_NAME_MAX) return `El nombre tiene más de ${CATEGORY_NAME_MAX} caracteres.`;
  if (siblings.some((sibling) => sibling.id !== exceptId && nameKey(sibling.name) === nameKey(clean))) {
    return `Ya existe la categoría «${clean}» en ese nivel.`;
  }
  return null;
}
