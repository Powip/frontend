import {
  canAddChild,
  categoryPath,
  descendantIds,
  findCategory,
  flattenCategoryTree,
  moveTargets,
  siblingsOf,
  subtreeHeight,
  validateCategoryName,
  type CatalogCategoryNode,
} from "../categoryTree";

const node = (id: string, name: string, level: number, children: CatalogCategoryNode[] = [], active = true, parentId: string | null = null): CatalogCategoryNode =>
  ({ id, name, level, children, active, parentId });

// Ropa › Polos › Manga corta ; Ropa › Pantalones ; Calzado (desactivada) › Zapatillas ; Accesorios
const TREE: CatalogCategoryNode[] = [
  node("acc", "Accesorios", 1),
  node("cal", "Calzado", 1, [node("zap", "Zapatillas", 2, [], true, "cal")], false),
  node("ropa", "Ropa", 1, [
    node("pan", "Pantalones", 2, [], true, "ropa"),
    node("pol", "Polos", 2, [node("mc", "Manga corta", 3, [], true, "pol")], true, "ropa"),
  ]),
];

describe("categoryTree (FEAT-24 H4)", () => {
  it("aplana el árbol en orden con la ruta completa", () => {
    expect(flattenCategoryTree(TREE).map((o) => `${o.level}:${o.path}`)).toEqual([
      "1:Accesorios", "1:Calzado", "2:Calzado › Zapatillas", "1:Ropa", "2:Ropa › Pantalones", "2:Ropa › Polos", "3:Ropa › Polos › Manga corta",
    ]);
  });

  it("con activeOnly, una desactivada se va con lo que cuelga de ella", () => {
    expect(flattenCategoryTree(TREE, { activeOnly: true }).map((o) => o.id)).toEqual(["acc", "ropa", "pan", "pol", "mc"]);
  });

  it("encuentra una categoría, su ruta y su rama", () => {
    expect(findCategory(TREE, "mc")?.name).toBe("Manga corta");
    expect(findCategory(TREE, "nada")).toBeNull();
    expect(categoryPath(TREE, "pol")).toBe("Ropa › Polos");
    expect(categoryPath(TREE, null)).toBeNull();
    expect(descendantIds(TREE, "ropa").sort()).toEqual(["mc", "pan", "pol", "ropa"]);
    expect(descendantIds(TREE, "nada")).toEqual([]);
  });

  it("no deja pasar de 3 niveles ni crear dentro de una desactivada", () => {
    expect(subtreeHeight(findCategory(TREE, "ropa")!)).toBe(3);
    expect(canAddChild(findCategory(TREE, "pol")!)).toBe(true);
    expect(canAddChild(findCategory(TREE, "mc")!)).toBe(false);
    expect(canAddChild(findCategory(TREE, "cal")!)).toBe(false);
  });

  it("mover: sin ella misma, sin su rama, sin el padre actual y sin pasar de 3 niveles", () => {
    // Polos tiene altura 2: solo entra bajo una categoría de nivel 1 activa que no sea Ropa (su padre).
    expect(moveTargets(TREE, "pol").map((o) => o.id)).toEqual(["acc"]);
    // Ropa (altura 3) no entra debajo de nadie.
    expect(moveTargets(TREE, "ropa")).toEqual([]);
    // Manga corta (hoja) entra en nivel 1 y 2 activos, menos su padre.
    expect(moveTargets(TREE, "mc").map((o) => o.id)).toEqual(["acc", "ropa", "pan"]);
  });

  it("valida el nombre: vacío, largo y repetido en el mismo nivel (sin importar mayúsculas)", () => {
    expect(validateCategoryName("  ", TREE)).toMatch(/Escribe el nombre/);
    expect(validateCategoryName("x".repeat(101), TREE)).toMatch(/más de 100/);
    expect(validateCategoryName(" ropa ", siblingsOf(TREE, null))).toMatch(/Ya existe la categoría «ropa»/);
    expect(validateCategoryName("Ropa", siblingsOf(TREE, null), "ropa")).toBeNull();
    expect(validateCategoryName("Ropa", siblingsOf(TREE, "pol"))).toBeNull();
  });
});
