import {
  LIVE_ACCENTS,
  contrastRatio,
  liveAppearance,
  liveAppearanceStyle,
  liveEffectiveAccent,
  liveInitials,
} from "../liveAppearance";

describe("catalog appearance (FEAT-33 B5)", () => {
  test("without anything saved it is dark with turquoise and the store name", () => {
    expect(liveAppearance(undefined, "Kunca")).toEqual({
      theme: "dark",
      color: "#72efe8",
      displayName: "Kunca",
      logoUrl: null,
    });
    expect(liveAppearance({ displayName: "  " }, "Kunca").displayName).toBe("Kunca");
    expect(liveAppearance({ displayName: "Kunca Store" }, "Kunca").displayName).toBe("Kunca Store");
  });

  test("offers the 7 colors of the mockup", () => {
    expect(LIVE_ACCENTS.map((a) => a.label)).toEqual([
      "Turquesa",
      "Rosa",
      "Lila",
      "Coral",
      "Verde",
      "Teal",
      "Negro",
    ]);
  });

  test.each([
    [
      "dark",
      "#111111",
      "#f1f4f7",
      "Ese color casi no se ve sobre fondo oscuro. Lo mostramos en blanco; para usar negro elige el tema claro.",
    ],
    [
      "light",
      "#ffffff",
      "#151a21",
      "Ese color casi no se ve sobre fondo blanco. Lo mostramos en negro; para usar blanco elige el tema oscuro.",
    ],
    ["dark", "#f37ea3", "#f37ea3", ""],
    ["light", "#111111", "#111111", ""],
  ] as const)("%s theme with %s shows %s", (theme, color, shown, warning) => {
    expect(liveEffectiveAccent({ theme, color })).toEqual({ color: shown, warning });
  });

  test.each([
    ["dark", "#72efe8"],
    ["dark", "#f37ea3"],
    ["dark", "#027778"],
    ["dark", "#8b6cff"],
    ["light", "#72efe8"],
    ["light", "#22c55e"],
    ["light", "#ff7a45"],
    ["light", "#111111"],
  ] as const)("%s + %s: button text and accent text are readable", (theme, color) => {
    const style = liveAppearanceStyle({ theme, color }) as Record<string, string>;
    const accent = style["--acc"];
    const background = theme === "dark" ? "#0b0d11" : "#ffffff";
    // Texto sobre el botón de color: AA para texto grande/negrita (los botones son 15–17 px bold).
    expect(contrastRatio(style["--acc-ink"], accent)).toBeGreaterThanOrEqual(3);
    // Precio y enlaces en el color de la marca sobre el fondo: AA normal.
    expect(contrastRatio(style["--acc-tx"], background)).toBeGreaterThanOrEqual(4.5);
  });

  test("the theme sets the page colors", () => {
    const dark = liveAppearanceStyle({ theme: "dark", color: "#72efe8" }) as Record<string, string>;
    const light = liveAppearanceStyle({ theme: "light", color: "#72efe8" }) as Record<string, string>;
    expect(dark["--b-bg"]).toBe("#0b0d11");
    expect(light["--b-bg"]).toBe("#ffffff");
    expect(dark["--b-ink"]).toBe("#f1f4f7");
    expect(light["--b-ink"]).toBe("#151a21");
  });

  test.each([
    ["Kunca Store", "KS"],
    ["kunca", "KU"],
    ["  Ñaña   Ropa ", "ÑR"],
    ["", "TU"],
    ["@@", "TU"],
  ])("initials of %p are %p", (name, initials) => {
    expect(liveInitials(name)).toBe(initials);
  });
});
