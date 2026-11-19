import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import type { CatalogCategoryNode } from "@/lib/catalog/categoryTree";

/** FEAT-24 H4 (H4-D4) — categorías propias de la empresa (la empresa sale del token en ms-products). */
const api = () => `${process.env.NEXT_PUBLIC_API_PRODUCTOS || GATEWAY.products}/catalog-categories`;

function readTree(data: unknown): CatalogCategoryNode[] {
  if (!Array.isArray(data)) throw new Error("No se pudieron leer las categorías.");
  const walk = (nodes: unknown[], level: number, parentId: string | null): CatalogCategoryNode[] =>
    nodes.map((raw) => {
      const node = (raw ?? {}) as Record<string, unknown>;
      if (typeof node.id !== "string" || typeof node.name !== "string") throw new Error("No se pudieron leer las categorías.");
      return {
        id: node.id,
        name: node.name,
        parentId: typeof node.parentId === "string" ? node.parentId : parentId,
        active: node.active !== false,
        level: Number.isInteger(node.level) ? (node.level as number) : level,
        children: walk(Array.isArray(node.children) ? node.children : [], level + 1, node.id),
      };
    });
  return walk(data, 1, null);
}

export async function listCatalogCategories({ activeOnly = false, signal }: { activeOnly?: boolean; signal?: AbortSignal } = {}): Promise<CatalogCategoryNode[]> {
  const { data } = await axiosAuth.get(api(), { params: activeOnly ? { activeOnly: true } : undefined, signal });
  return readTree(data);
}

export async function createCatalogCategory(body: { name: string; parentId?: string | null }) {
  const { data } = await axiosAuth.post(api(), { name: body.name, ...(body.parentId ? { parentId: body.parentId } : {}) });
  return data as { id: string; name: string; parentId: string | null; active: boolean };
}

export async function updateCatalogCategory(id: string, body: { name?: string; parentId?: string | null; active?: boolean }) {
  const { data } = await axiosAuth.put(`${api()}/${encodeURIComponent(id)}`, body);
  return data as { id: string; name: string; parentId: string | null; active: boolean };
}
