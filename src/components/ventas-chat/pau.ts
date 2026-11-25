import type {
  PauMode,
  PauProviderKind,
  PauSandboxToolCall,
  PauUsage,
} from "@/types/crm";

export const PAU_INSTRUCTIONS_MAX = 4000;
export const PAU_KNOWLEDGE_MAX = 40000;
export const PAU_MIN_CAP = 1000;
export const ANTHROPIC_DEFAULT_MODEL = "claude-opus-5-5";

/** Nombres y textos del mockup 152 (Pau › Quién vende). */
export const PAU_MODE_OPTIONS: Array<{
  value: PauMode;
  title: string;
  description: string;
}> = [
  {
    value: "off",
    title: "Solo CRM",
    description: "Pau no escribe ni sugiere. Tu equipo atiende todo. No necesita llaves de IA.",
  },
  {
    value: "copilot",
    title: "Copiloto",
    description:
      "Pau sugiere la respuesta con datos del producto y arma el pedido. La vendedora decide y envía.",
  },
  {
    value: "auto",
    title: "Pau vende y cobra",
    description:
      "Pau atiende, vende y pide el comprobante sola por chat. Lee el comprobante y lo pasa a Finanzas para el visto final. Casos especiales pasan a una persona.",
  },
];

/** Modo de Pau en una tienda: el suyo o, si no tiene, el general. */
export function storeMode(
  s: { mode: PauMode; storeModes?: Record<string, PauMode> },
  storeId: string | null | undefined,
): PauMode {
  return (storeId && s.storeModes?.[storeId]) || s.mode;
}

export const PAU_MODE_LABEL: Record<PauMode, string> = {
  off: "Solo CRM",
  copilot: "Copiloto",
  auto: "Pau vende y cobra",
};

export const PROVIDER_LABEL: Record<PauProviderKind, string> = {
  anthropic: "Anthropic · Claude",
  openai: "OpenAI",
  openai_compatible: "Compatible con OpenAI (URL propia)",
};

export const USAGE_GROUPS: Array<{ label: string; kinds: PauUsage["byKind"][number]["kind"][] }> = [
  { label: "Sugerencias", kinds: ["suggest"] },
  { label: "Respuestas automáticas", kinds: ["auto"] },
  { label: "Pruebas", kinds: ["sandbox", "test"] },
];

export function formatTokens(n: number): string {
  return n.toLocaleString("es-PE");
}

export function groupUsage(usage: PauUsage) {
  return USAGE_GROUPS.map((g) => {
    const rows = usage.byKind.filter((k) => g.kinds.includes(k.kind));
    return {
      label: g.label,
      calls: rows.reduce((a, r) => a + r.calls, 0),
      inputTokens: rows.reduce((a, r) => a + r.inputTokens, 0),
      outputTokens: rows.reduce((a, r) => a + r.outputTokens, 0),
    };
  });
}

/** Porcentaje usado del tope (0-100, sin pasar de 100). */
export function capPercent(total: number, cap: number | null): number | null {
  if (!cap || cap <= 0) return null;
  return Math.min(100, Math.round((total / cap) * 100));
}

/** Texto claro de lo que Pau habría hecho en el ensayo. */
export function describeToolCall(call: PauSandboxToolCall): string {
  const i = call.input ?? {};
  const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : "—");
  switch (call.name) {
    case "pedir_ayuda_humana":
      return `Pediría ayuda a una asesora: ${str(i.motivo)}`;
    case "crear_recordatorio":
      return `Crearía un recordatorio en ${str(i.en_horas)} h: ${str(i.titulo)}`;
    case "mover_etapa":
      return `Movería el chat a ${str(i.etapa)}`;
    default:
      return `Haría la acción «${call.name}»`;
  }
}
