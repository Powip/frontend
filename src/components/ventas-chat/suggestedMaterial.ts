import type { Material, TemperatureKey } from "@/types/crmContent";

export interface MaterialContext {
  objection: string | null;
  /** Paso del guion (0 = primero). */
  step: number;
  lowStock: boolean;
  temperature: TemperatureKey;
}

type Wanted = (m: Material) => boolean;

const titled =
  (re: RegExp): Wanted =>
  (m) =>
    re.test(m.title);
const SIZES = titled(/medida|talla/i);
const TESTIMONIAL = titled(/testimonio|reseña/i);
const LAST_UNITS = titled(/[uú]ltim/i);
const PAYMENT: Wanted = (m) => !!m.payment;
const PAYMENT_STEP = 4;

/** Qué material pide el momento de la venta, del caso más específico al general. */
const RULES: Array<[(c: MaterialContext) => boolean, Wanted]> = [
  [(c) => /talla|medida/i.test(c.objection ?? ""), SIZES],
  [(c) => /conf[ií]a|estafa|segur/i.test(c.objection ?? ""), TESTIMONIAL],
  [(c) => c.step >= PAYMENT_STEP, PAYMENT],
  [(c) => c.lowStock, LAST_UNITS],
  [(c) => c.temperature === "tibio", TESTIMONIAL],
  [(c) => c.step === 0, (m) => m.kind === "photo"],
  [(c) => c.step === 1, SIZES],
  [() => true, (m) => m.kind === "video"],
];

/** Material para «Enviar también»; si el que toca no existe, el primero de la lista. */
export function suggestedMaterial(materials: Material[], context: MaterialContext): Material | undefined {
  const wanted = RULES.find(([applies]) => applies(context))?.[1];
  return materials.find((m) => wanted?.(m)) ?? materials[0];
}
