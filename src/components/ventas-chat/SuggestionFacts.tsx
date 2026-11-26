"use client";
import Link from "next/link";
import { useChatCart } from "@/hooks/useChatCart";
import { useScript, useSheets } from "@/hooks/useCrmContent";
import { useStorePolicy } from "@/hooks/useCrmOrderPanel";
import type { ScriptClosingRules, Sheet } from "@/types/crmContent";
import type { StorePolicy } from "@/types/crmOrderPanel";
import type { QuotationLine } from "@/types/quotations";
import { stockText } from "./chatCart";
import { formatMoney } from "./format";
import { dispatchText } from "./saleGuide";

interface FactSources {
  line: QuotationLine;
  sheet?: Sheet;
  policy?: StorePolicy;
  rules?: ScriptClosingRules;
  /** Promo vigente hoy (vence a las 23:59 de Lima); la guardada ayer ya no se ofrece. */
  promo?: string | null;
}

function labelled(label: string, value: string | null | undefined): string | null {
  return value ? `${label}${value}` : null;
}

function shippingText(policy: StorePolicy | undefined): string | null {
  if (!policy) return null;
  return policy.shipCharge > 0 ? `Envío ${formatMoney(policy.shipCharge)}` : "Envío gratis";
}

/** Datos reales detrás de la sugerencia; los que no se conocen no salen. */
function factsOf({ line, sheet, policy, rules, promo }: FactSources): string[] {
  const variant = line.variant ? `${line.variant}: ` : "";
  const highlight = sheet?.highlights?.split(/\r?\n|·|;/)[0].trim();
  const facts = [
    formatMoney(line.unitPrice),
    labelled(`Stock ${variant}`, stockText(line, rules?.lastUnits)),
    shippingText(policy),
    dispatchText(rules),
    labelled("Promo ", promo?.trim()),
    labelled("Destaca: ", highlight),
  ];
  return facts.filter((f): f is string => !!f);
}

/** «Usa: Ficha X · precio · stock · envío…»: de dónde sale lo que se le dice al cliente. */
export default function SuggestionFacts({ conversationId }: { conversationId: string }) {
  const { line, storeId } = useChatCart(conversationId);
  const script = useScript().data;
  const rules = script?.closingRules;
  const policy = useStorePolicy(storeId, !!line && !!storeId).data;
  const sheets = useSheets("", !!line).data;
  if (!line) return null;
  const sheet = sheets?.find((s) => !!s.coreProductId && s.coreProductId === line.productId);
  return (
    <span className="text-xs text-muted-foreground" data-testid="suggestion-facts">
      Usa: <b>{sheet ? `Ficha ${sheet.name}` : line.name}</b> · {factsOf({ line, sheet, policy, rules, promo: script?.activePromo }).join(" · ")}
      {sheet && (
        <Link href="/comercial/ventas-chat/ficha" className="ml-1.5 font-semibold text-primary underline">
          Ver ficha
        </Link>
      )}
    </span>
  );
}
