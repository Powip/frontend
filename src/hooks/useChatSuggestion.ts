"use client";
import { useState } from "react";
import { firstName, stepText } from "@/components/ventas-chat/ContentLib";
import { currentStep } from "@/components/ventas-chat/saleGuide";
import { suggestedMaterial } from "@/components/ventas-chat/suggestedMaterial";
import { pickSuggestion } from "@/components/ventas-chat/suggestionSource";
import { temperatureOf } from "@/components/ventas-chat/temperature";
import type { Conversation } from "@/types/crm";
import type { ObjectionDetection } from "@/types/crmSalesTools";
import { useChatCart } from "./useChatCart";
import { usePauSettings } from "./useCrmPau";
import { storeMode } from "@/components/ventas-chat/pau";
import { useGeneralMaterials, useRegisterObjectionUse, useScript } from "./useCrmContent";
import { useDetectObjection } from "./useCrmSalesTools";

type Objection = ObjectionDetection & { label: string; suggestedResponse: string };

function objectionOf(detected: ObjectionDetection | undefined): Objection | null {
  return detected?.label && detected.suggestedResponse ? (detected as Objection) : null;
}

/** Respuesta sugerida para el último mensaje del cliente; null si no hay o ya se usó. */
export function useChatSuggestion(conversation: Conversation | undefined, windowOpen: boolean) {
  const id = conversation?.id ?? null;
  const trigger = conversation?.lastInboundAt ?? null;
  const steps = useScript(true, conversation?.storeId).data?.steps ?? [];
  const materials = useGeneralMaterials().data ?? [];
  const registerUse = useRegisterObjectionUse(id ?? "");
  const { lowStock } = useChatCart(id);
  // Pau apagado (o modo aún sin leer): sin sugerencias ni detección de objeciones.
  // Copiloto y «Pau responde solo» sí sugieren.
  // Manda el modo de la tienda del chat; sin modo propio, el general.
  const pau = usePauSettings().data;
  const mode = pau ? storeMode(pau, conversation?.storeId) : undefined;
  const pauOn = !!mode && mode !== "off";
  const detected = useDetectObjection(id, trigger, windowOpen && pauOn).data;
  const objection = objectionOf(detected);
  const [dropped, setDropped] = useState<string | null>(null);
  if (!pauOn || !conversation || !windowOpen || conversation.status === "closed") return null;

  const step = steps.length ? currentStep(conversation, steps) : 0;
  const key = `${id}:${trigger ?? ""}:${step}`;
  const picked = pickSuggestion(detected, steps[step] ? stepText(steps[step], firstName(conversation)) : "");
  if (!picked || dropped === key) return null;

  return {
    text: picked.text,
    /** «IA» solo si la IA redactó el texto; si no, «Reglas». */
    source: picked.source,
    objection,
    step,
    stepCount: steps.length,
    stepName: steps[step]?.name ?? "",
    material: suggestedMaterial(materials, {
      objection: objection?.label ?? null,
      step,
      lowStock: lowStock !== null,
      temperature: temperatureOf(conversation),
    }),
    drop: () => setDropped(key),
    /** Cuenta la respuesta usada y retira la tarjeta. */
    use: () => {
      if (objection?.objectionId) registerUse.mutate(objection.objectionId);
      setDropped(key);
    },
  };
}

export type ChatSuggestion = NonNullable<ReturnType<typeof useChatSuggestion>>;
