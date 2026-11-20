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

export const PAU_MODE_OPTIONS: Array<{
  value: PauMode;
  title: string;
  description: string;
}> = [
  {
    value: "off",
    title: "Apagado",
    description: "Pau no participa. Atiende solo tu equipo.",
  },
  {
    value: "copilot",
    title: "Copiloto",
    description:
      "Pau sugiere respuestas a la vendedora con un botón en el chat. Tú revisas y envías.",
  },
  {
    value: "auto",
    title: "Pau responde solo",
    description:
      "Pau responde al cliente por WhatsApp sin que nadie lo apruebe, y además puede sugerir respuestas.",
  },
];

export const PAU_MODE_LABEL: Record<PauMode, string> = {
  off: "Apagado",
  copilot: "Copiloto",
  auto: "Pau responde solo",
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
