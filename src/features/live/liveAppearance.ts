import type { CSSProperties } from "react";
import type { LiveAppearanceConfig } from "./types";

/**
 * FEAT-33 B5: apariencia del catálogo del comprador (tema oscuro o claro, color de la marca, logo y
 * nombre). Los colores de la página salen de variables CSS (`--b-*` del tema y `--acc*` de la marca),
 * así el mismo catálogo sirve para los dos temas y cualquier color.
 */
export type LiveTheme = "dark" | "light";
export interface LiveLook {
  theme: LiveTheme;
  color: string;
  displayName: string;
  logoUrl: string | null;
}

export const LIVE_DEFAULT_ACCENT = "#72efe8";
export const LIVE_ACCENTS = [
  { color: "#72efe8", label: "Turquesa" },
  { color: "#f37ea3", label: "Rosa" },
  { color: "#8b6cff", label: "Lila" },
  { color: "#ff7a45", label: "Coral" },
  { color: "#22c55e", label: "Verde" },
  { color: "#027778", label: "Teal" },
  { color: "#111111", label: "Negro" },
] as const;
const HEX = /^#[0-9a-f]{6}$/i;

export function liveAppearance(
  saved: LiveAppearanceConfig | undefined,
  storeName: string,
): LiveLook {
  return {
    theme: saved?.theme === "light" ? "light" : "dark",
    color: saved?.color && HEX.test(saved.color) ? saved.color.toLowerCase() : LIVE_DEFAULT_ACCENT,
    displayName: saved?.displayName?.trim() || storeName,
    logoUrl: saved?.logoUrl || null,
  };
}

function rgb(hex: string) {
  const value = parseInt(hex.slice(1), 16) || 0;
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}
function mix(a: string, b: string, t: number) {
  const A = rgb(a);
  const B = rgb(b);
  return `#${A.map((v, i) =>
    Math.round(v * (1 - t) + B[i] * t)
      .toString(16)
      .padStart(2, "0"),
  ).join("")}`;
}
function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** Relación de contraste WCAG entre dos colores #rrggbb. */
export function contrastRatio(a: string, b: string) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

/** Como el mockup: un color que casi no se ve sobre el fondo se muestra en blanco o negro, con aviso. */
export function liveEffectiveAccent(look: { theme: LiveTheme; color: string }) {
  const level = luminance(look.color);
  if (look.theme === "dark" && level < 0.03)
    return {
      color: "#f1f4f7",
      warning:
        "Ese color casi no se ve sobre fondo oscuro. Lo mostramos en blanco; para usar negro elige el tema claro.",
    };
  if (look.theme === "light" && level > 0.8)
    return {
      color: "#151a21",
      warning:
        "Ese color casi no se ve sobre fondo blanco. Lo mostramos en negro; para usar blanco elige el tema oscuro.",
    };
  return { color: look.color, warning: "" };
}

const THEMES: Record<LiveTheme, Record<string, string>> = {
  dark: {
    "--b-out": "#05070a",
    "--b-bg": "#0b0d11",
    "--b-card": "#14171c",
    "--b-in": "#0f1216",
    "--b-line": "#2a3039",
    "--b-line2": "#3a414c",
    "--b-ink": "#f1f4f7",
    "--b-ink2": "#d6dbe2",
    "--b-mut": "#9aa3b0",
    "--acc-soft": "color-mix(in srgb, var(--acc) 16%, var(--b-bg))",
    "--b-dis": "color-mix(in srgb, var(--acc) 22%, var(--b-bg))",
    "--b-dis-ink": "color-mix(in srgb, var(--acc) 55%, var(--b-bg))",
    "--b-err": "#ffb3c1",
    "--b-ok-bg": "#0f3324",
    "--b-ok": "#7be3ac",
    "--b-warn-bg": "#3a2c10",
    "--b-warn": "#ffd27a",
    "--b-bad-bg": "#3a1520",
    "--b-bad": "#ff9db0",
    "--b-live-bg": "#3a1520",
    "--b-live": "#ff8aa5",
    "--b-pur-bg": "#2a1f3d",
    "--b-pur": "#d5c2ff",
  },
  light: {
    "--b-out": "#e6eaee",
    "--b-bg": "#ffffff",
    "--b-card": "#ffffff",
    "--b-in": "#f5f6f8",
    "--b-line": "#e1e5ea",
    "--b-line2": "#c9d0d8",
    "--b-ink": "#151a21",
    "--b-ink2": "#3a4350",
    "--b-mut": "#687180",
    "--acc-soft": "color-mix(in srgb, var(--acc) 13%, #ffffff)",
    "--b-dis": "color-mix(in srgb, var(--acc) 30%, #ffffff)",
    "--b-dis-ink": "color-mix(in srgb, var(--acc) 60%, #000000)",
    "--b-err": "#c22a4a",
    "--b-ok-bg": "#e5f6ec",
    "--b-ok": "#1f8a4c",
    "--b-warn-bg": "#fff1c9",
    "--b-warn": "#7a4a00",
    "--b-bad-bg": "#fdecef",
    "--b-bad": "#c22a4a",
    "--b-live-bg": "#ffe3ea",
    "--b-live": "#c22a4a",
    "--b-pur-bg": "#efe9ff",
    "--b-pur": "#4C2FB5",
  },
};

/**
 * Variables CSS del catálogo. `--acc-ink` (texto sobre el botón de color) es el de mayor contraste
 * entre blanco y casi negro; `--acc-tx` (precio y enlaces del color de la marca) se aclara u oscurece
 * hasta leerse sobre el fondo (WCAG AA, 4.5:1).
 */
export function liveAppearanceStyle(look: { theme: LiveTheme; color: string }): CSSProperties {
  const accent = liveEffectiveAccent(look).color;
  const background = THEMES[look.theme]["--b-bg"];
  const ink =
    contrastRatio("#ffffff", accent) >= contrastRatio("#0b0d11", accent) ? "#ffffff" : "#0b0d11";
  const toward = look.theme === "dark" ? "#ffffff" : "#000000";
  let text = accent;
  for (let step = 1; step <= 20 && contrastRatio(text, background) < 4.5; step++)
    text = mix(accent, toward, step * 0.05);
  return {
    ...THEMES[look.theme],
    "--acc": accent,
    "--acc-ink": ink,
    "--acc-tx": text,
  } as CSSProperties;
}

/** «Kunca Store» → «KS»; «kunca» → «KU»; sin letras, «TU». */
export function liveInitials(name: string) {
  const words = name
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  const initials =
    words.length >= 2 ? `${[...words[0]][0]}${[...words[1]][0]}` : [...(words[0] || "")].slice(0, 2).join("");
  return initials.toUpperCase() || "TU";
}
