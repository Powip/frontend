import type { Preset } from "./engagement";

/**
 * Secuencias rápidas con los tiempos de la «Metodología Maestra de Venta por
 * Impulso POWIP» (PDF, sección 8):
 * - Recuperación: +3 h, +8 h, D2, D3 y D4; cada toque con un ángulo distinto.
 * - Upsell inmediato: a los minutos de confirmar el pago, una sola oferta.
 * - Postventa y recompra: D0 (entregado), D7, D15 y D30.
 * La cobranza de saldo se mantiene como en el mockup 152.
 */
const H = 60;
const D = 1440;

export const PDF_PRESETS: Preset[] = [
  {
    key: "recuperacion-pdf",
    objective: "sale",
    name: "Recuperación de 4 días",
    description: "+3 h dolor · +8 h prueba social · día 2 antes/después · día 3 autoridad · día 4 última llamada.",
    pickTemplate: true,
    steps: [
      { name: "+3 h · dolor", trigger: "customer_silent", waitMinutes: 3 * H, target: "customer", useTemplate: false, message: "¿Sigues con eso que te preocupa, {nombre}? Con tu producto puedes lograrlo. Hoy tienes la oferta del día. ¿Te separo el tuyo?" },
      { name: "+8 h · prueba social", trigger: "customer_silent", waitMinutes: 8 * H, target: "customer", useTemplate: false, message: "Mira lo que nos contó otra clienta con tu mismo caso. Tú también puedes lograrlo. ¿Te lo reservo hoy con el descuento, {nombre}?" },
      { name: "Día 2 · antes y después", trigger: "customer_silent", waitMinutes: 2 * D, target: "customer", useTemplate: true, message: "¡Hola {nombre}! Ayer viste el producto y aún no confirmas. Mira este antes y después real. ¿Te lo separo o prefieres reservar con un adelanto y pagar el resto al recibir?" },
      { name: "Día 3 · autoridad", trigger: "customer_silent", waitMinutes: 3 * D, target: "customer", useTemplate: true, message: "{nombre}, recuerda lo que hace diferente a tu producto. Aún está la promo. ¿Te lo separo ya?" },
      { name: "Día 4 · última llamada", trigger: "customer_silent", waitMinutes: 4 * D, target: "customer", useTemplate: true, message: "Última llamada, {nombre}: hoy cierra la promo. Las próximas compras reciben un regalo. ¿Te separo el tuyo?" },
    ],
  },
  {
    key: "upsell-pdf",
    objective: "sale",
    name: "Upsell después del pago",
    description: "A los 5 min de pasar a Venta: una sola oferta del complemento, antes del despacho. Usa la primera etapa Venta.",
    needsWonStage: true,
    steps: [
      { name: "Upsell · 5 min", trigger: "stage_idle", waitMinutes: 5, target: "customer", useTemplate: false, message: "¡Gracias por tu compra, {nombre}! Tu pedido ya se está preparando. Como eres clienta activa, puedes agregar un complemento a precio especial. Llega en el mismo paquete, sin costo de envío. ¿Lo agrego a tu pedido?" },
    ],
  },
  {
    key: "cobranza-saldo",
    objective: "collection",
    name: "Cobranza de saldo",
    description: "Avisos al día 1 y 3 al cliente · al día 5 tarea para la vendedora.",
    pickTemplate: true,
    steps: [
      { name: "Saldo · aviso amable", trigger: "customer_silent", waitMinutes: D, target: "customer", useTemplate: true, message: "{nombre}, ¿nos confirmas cuándo pagas el saldo de tu pedido? 🙌" },
      { name: "Saldo · último aviso", trigger: "customer_silent", waitMinutes: 3 * D, target: "customer", useTemplate: true, message: "{nombre}, ¿pagas, reprogramamos o lo cancelamos sin problema?" },
      { name: "Saldo · pasa a la vendedora", trigger: "customer_silent", waitMinutes: 5 * D, target: "agent", useTemplate: false, message: "{vendedora}, {nombre} no respondió a los avisos de saldo. Llámalo." },
    ],
  },
  {
    key: "postventa-pdf",
    objective: "aftersale",
    name: "Testimonio y recompra",
    description: "Día 0 modo de uso · día 7 ¿cómo te va? · día 15 constancia · día 30 testimonio. Usa la etapa Entregado si existe.",
    pickTemplate: true,
    needsWonStage: true,
    steps: [
      { name: "D0 · modo de uso", trigger: "stage_idle", waitMinutes: 5, target: "customer", useTemplate: false, message: "¡Gracias, {nombre}! Así se usa en 3 pasos. Tómate una foto hoy para comparar tu antes y después 💜" },
      { name: "D7 · ¿cómo te va?", trigger: "stage_idle", waitMinutes: 7 * D, target: "customer", useTemplate: true, message: "¿Cómo te va con tu producto, {nombre}? ¿Alguna duda con el uso?" },
      { name: "D15 · constancia", trigger: "stage_idle", waitMinutes: 15 * D, target: "customer", useTemplate: true, message: "{nombre}, a esta altura es normal notar los primeros cambios. ¡Mándanos tu avance!" },
      { name: "D30 · testimonio", trigger: "stage_idle", waitMinutes: 30 * D, target: "customer", useTemplate: true, message: "{nombre}, ¿nos mandas tu foto de antes y después o una reseña? Te damos un descuento en tu próxima compra." },
    ],
  },
];

/** Etapa para postventa: «Entregado» si existe; si no, la primera ganada. */
export function presetStage<T extends { name: string; kind: string }>(
  presetKey: string,
  stages: T[],
  firstWon: T | null,
): T | null {
  if (presetKey === "postventa-pdf") {
    return stages.find((s) => s.kind === "won" && s.name.trim().toLowerCase() === "entregado") ?? firstWon;
  }
  return firstWon;
}
