import { a4Slot, computeA4Grid, pagesFor, thermalSlot } from "../grid";

describe("computeA4Grid (FEAT-24 H7-D6)", () => {
  it.each([
    [50, 25, 4, 11],
    [40, 30, 5, 9],
    [50, 50, 4, 5],
    [60, 40, 3, 7],
    [100, 50, 2, 5],
  ])("%i×%i mm fits %i columns × %i rows inside the 5 mm margins", (w, h, cols, rows) => {
    const grid = computeA4Grid(w, h);
    expect(grid).toMatchObject({ cols, rows, perPage: cols * rows });
    // La grilla queda dentro de la hoja con al menos 5 mm de margen.
    expect(grid.offsetX).toBeGreaterThanOrEqual(5);
    expect(grid.offsetY).toBeGreaterThanOrEqual(5);
    expect(grid.offsetX + cols * w).toBeLessThanOrEqual(205 + 1e-9);
    expect(grid.offsetY + rows * h).toBeLessThanOrEqual(292 + 1e-9);
  });

  it("centers the grid in the sheet", () => {
    const grid = computeA4Grid(60, 40); // 3 × 60 = 180 de 200 útiles; 7 × 40 = 280 de 287
    expect(grid.offsetX).toBeCloseTo(15);
    expect(grid.offsetY).toBeCloseTo(8.5);
  });

  it("rejects a non positive size", () => {
    expect(() => computeA4Grid(0, 25)).toThrow();
  });
});

describe("label slots", () => {
  const grid = computeA4Grid(50, 25); // 4 × 11 = 44 por hoja; 275 de 287 mm de alto → offsets 5 y 11

  it("fills A4 by rows, left to right, and moves to the next page", () => {
    expect(a4Slot(0, grid)).toEqual({ page: 0, x: 5, y: 11 });
    expect(a4Slot(3, grid)).toEqual({ page: 0, x: 155, y: 11 });
    expect(a4Slot(4, grid)).toEqual({ page: 0, x: 5, y: 36 });
    expect(a4Slot(43, grid)).toEqual({ page: 0, x: 155, y: 261 });
    expect(a4Slot(44, grid)).toEqual({ page: 1, x: 5, y: 11 });
  });

  it("puts each thermal label on its own page", () => {
    expect(thermalSlot(0)).toEqual({ page: 0, x: 0, y: 0 });
    expect(thermalSlot(7)).toEqual({ page: 7, x: 0, y: 0 });
  });

  it("counts the pages", () => {
    expect(pagesFor(0, "a4", grid)).toBe(0);
    expect(pagesFor(44, "a4", grid)).toBe(1);
    expect(pagesFor(45, "a4", grid)).toBe(2);
    expect(pagesFor(45, "termica", grid)).toBe(45);
  });
});
