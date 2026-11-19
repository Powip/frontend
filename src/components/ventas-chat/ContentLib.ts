import type { Conversation } from "@/types/crm";
import type { Material, MaterialKind, ScriptStep } from "@/types/crmContent";

export const SCRIPT_MAX_STEPS = 10;
export const SCRIPT_NAME_MAX = 40;
export const SCRIPT_MESSAGE_MAX = 600;
export const SCRIPT_QUESTION_MAX = 200;
export const SCRIPT_NOTE_MAX = 200;
export const OBJECTION_NAME_MAX = 80;
export const OBJECTION_RESPONSE_MAX = 800;
export const SHEET_NAME_MAX = 120;
export const SHEET_TEXT_MAX = 1000;
export const MATERIAL_TITLE_MAX = 120;
export const MATERIAL_URL_MAX = 500;
/** Mínimo de conversaciones para mostrar «la que más termina en venta». */
export const MIN_CONVERSATIONS_FOR_RATE = 5;

export const ADMIN_ONLY_NOTICE = "Solo un administrador puede ver esta sección";

export const MATERIAL_KIND_OPTIONS: Array<{ value: MaterialKind; label: string }> = [
  { value: "photo", label: "Foto" },
  { value: "video", label: "Video" },
  { value: "audio", label: "Audio" },
  { value: "pdf", label: "PDF" },
  { value: "link", label: "Enlace" },
];
export const MATERIAL_KIND_LABEL: Record<MaterialKind, string> = {
  photo: "Foto",
  video: "Video",
  audio: "Audio",
  pdf: "PDF",
  link: "Enlace",
};

/** Primer nombre del contacto; vacío si el chat solo tiene teléfono. */
export function firstName(c: Pick<Conversation, "contactName">): string {
  return c.contactName?.trim().split(/\s+/)[0] ?? "";
}

/** Reemplaza `{nombre}`. Sin nombre, quita el marcador y su coma o espacio sobrante. */
export function fillName(text: string, name: string): string {
  if (name) return text.replace(/\{nombre\}/g, name);
  return text
    .replace(/^\{nombre\}[,:]?\s*/, "")
    .replace(/\s*\{nombre\}/g, "")
    .replace(/\{nombre\}/g, "");
}

/** Texto que el paso pone en la caja: mensaje y, si existe, la pregunta en otra línea. */
export function stepText(step: ScriptStep, name: string): string {
  const message = fillName(step.message, name).trim();
  const question = fillName(step.question, name).trim();
  return question ? `${message}\n${question}` : message;
}

export function materialText(m: Pick<Material, "title" | "url">): string {
  return `${m.title}: ${m.url}`;
}

/** Porcentaje (0 a 100, entero) de conversaciones que terminaron en venta; null si no hay base. */
export function wonRate(won: number, conversations: number): number | null {
  if (!conversations) return null;
  return Math.round((won / conversations) * 100);
}

export function formatRate(won: number, conversations: number): string {
  const r = wonRate(won, conversations);
  return r === null ? "—" : `${r} %`;
}

/** Intercambia dos posiciones de una lista (devuelve copia). */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export const emptyStep = (): ScriptStep => ({ name: "", message: "", question: "" });

export function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
