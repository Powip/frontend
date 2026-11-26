import { isMaskedPhone, toLocalPhone } from "@/lib/crmPhone";
import type { Client } from "@/interfaces/ICliente";
import type { CreateChatQuoteInput } from "@/types/crm";
import type { AiCartLine, StorePolicy } from "@/types/crmOrderPanel";
import type { QuotationAddress, QuotationPaymentType } from "@/types/quotations";

export interface CartLine {
  productVariantId: string;
  name: string;
  variant: string;
  sku: string;
  imageUrl?: string;
  unitPrice: number;
  quantity: number;
  stock: number;
}

/** Lo que hace falta para crear un POWIP Link desde el chat. */
export interface QuoteDraft {
  name: string;
  /** Teléfono de la conversación; puede venir oculto. */
  phone: string | null;
  storeId: string;
  inventoryId: string;
  cart: CartLine[];
  paymentType: QuotationPaymentType;
  /** Adelanto escrito; vacío sugiere el 30 % del total. */
  deposit: string;
  client: Client | null | undefined;
}

/** Cotización ya creada en Core. */
export interface CreatedQuote {
  quotationId: string;
  quotationNumber: string;
  publicUrl: string;
}

/** Primera tienda de `choices` que el usuario tiene; si ninguna, la primera suya. */
export function resolveStoreId(stores: { id: string }[], choices: Array<string | null | undefined>): string {
  return choices.find((id) => stores.some((s) => s.id === id)) ?? stores[0]?.id ?? "";
}

export function cartTotal(cart: CartLine[]): number {
  return cart.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
}

export function defaultDeposit(total: number): number {
  return Math.round(total * 30) / 100;
}

function suggestedDeposit({ deposit, cart }: QuoteDraft): number {
  return deposit === "" ? defaultDeposit(cartTotal(cart)) : Number(deposit);
}

/** Forma de pago que ofrece primero la tienda. */
export function paymentFromPolicy(p: StorePolicy): Pick<QuoteDraft, "paymentType" | "deposit"> {
  const asksDeposit = p.firstOffer === "dep" && p.depositEnabled && p.depositAmount > 0;
  return asksDeposit
    ? { paymentType: "ADELANTO", deposit: String(p.depositAmount) }
    : { paymentType: "COMPLETO", deposit: "" };
}

/** Línea leída del chat; sin stock conocido cuenta como 0 para no prometer de más. */
export function cartLineFromAi(l: AiCartLine): CartLine {
  return {
    productVariantId: l.productVariantId,
    name: l.name,
    variant: l.variant ?? "",
    sku: l.sku ?? "",
    unitPrice: l.unitPrice,
    quantity: l.quantity,
    stock: l.stockAvailable ?? 0,
  };
}

const isDeposit = (d: QuoteDraft) => d.paymentType === "ADELANTO";

/** Lo que impide crear el link, en el orden en que se le avisa a la vendedora. */
const CHECKS: Array<[(d: QuoteDraft) => boolean, string]> = [
  [(d) => !d.name.trim(), "Completa el nombre del cliente."],
  [(d) => !d.phone, "Guarda el teléfono del cliente antes de armar el pedido."],
  [(d) => (d.phone ?? "").length > 20, "El teléfono debe tener hasta 20 caracteres."],
  [(d) => !d.storeId, "Selecciona una tienda."],
  [(d) => !d.inventoryId, "Selecciona un almacén para el pedido."],
  [(d) => !d.cart.length, "Agrega al menos un producto."],
  [
    (d) => d.cart.some((l) => !Number.isInteger(l.quantity) || l.quantity < 1),
    "Cada producto necesita una cantidad entera mayor a cero.",
  ],
  [
    (d) => d.cart.some((l) => l.quantity > l.stock),
    "Hay productos sin stock suficiente. Reduce la cantidad o quita la línea.",
  ],
  [(d) => isDeposit(d) && !(suggestedDeposit(d) > 0), "Ingresa un adelanto sugerido mayor a cero."],
  [(d) => isDeposit(d) && suggestedDeposit(d) > cartTotal(d.cart), "El adelanto no puede ser mayor al total."],
];

/** Primer motivo por el que no se puede crear el link; null si está completo. */
export function quoteDraftError(draft: QuoteDraft): string | null {
  return CHECKS.find(([fails]) => fails(draft))?.[1] ?? null;
}

/**
 * Dirección del cliente de Core para la cotización. Core exige las cuatro
 * partes (departamento, provincia, distrito y dirección); si falta alguna no
 * se envía nada y el cliente la completa al abrir el enlace. En Clientes, el
 * departamento se guarda en `city`.
 */
function addressFromClient(client: Client): QuotationAddress | null {
  const department = client.city?.trim();
  const province = client.province?.trim();
  return client.address?.trim() && client.district?.trim() && department && province
    ? {
        address: client.address,
        district: client.district,
        department,
        province,
        // Sin valor se omiten: Core falla si llegan como null.
        ...(client.reference?.trim() ? { reference: client.reference.trim() } : {}),
        ...(client.documentNumber?.trim() ? { documentNumber: client.documentNumber.trim() } : {}),
      }
    : null;
}

function quoteLine(l: CartLine): CreateChatQuoteInput["lines"][number] {
  return {
    productVariantId: l.productVariantId,
    sku: l.sku || undefined,
    name: l.name.trim(),
    variant: l.variant,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    isManual: false,
    isPack: false,
    isGift: false,
    // El servidor solo acepta URL http(s); sin imagen se omite.
    ...(l.imageUrl && /^https?:\/\//i.test(l.imageUrl) ? { imageUrl: l.imageUrl } : {}),
  };
}

/** Cotización que espera el CRM. Llamar solo si `quoteDraftError` dio null. */
export function quotePayload(draft: QuoteDraft): CreateChatQuoteInput {
  const phone = draft.phone ?? "";
  const address = draft.client ? addressFromClient(draft.client) : null;
  return {
    storeId: draft.storeId,
    inventoryId: draft.inventoryId,
    customerName: draft.name.trim(),
    // Mismo formato que Clientes de Core: 9 dígitos si es de Perú.
    // Oculto: el CRM lo cambia por el real de la conversación.
    customerPhone: isMaskedPhone(phone) ? phone : toLocalPhone(phone),
    ...(address ? { address } : {}),
    paymentType: draft.paymentType,
    suggestedDeposit: isDeposit(draft) ? suggestedDeposit(draft) : undefined,
    validityHours: 24,
    lines: draft.cart.map(quoteLine),
  };
}

/** Lee la cotización creada que el CRM devuelve en `QUOTE_CREATED_NOT_LINKED`. */
export function createdFromError(e: unknown): CreatedQuote | null {
  const data = (e as { response?: { data?: Record<string, unknown> } })?.response?.data;
  if (!data || data.code !== "QUOTE_CREATED_NOT_LINKED") return null;
  const { quotationId, quotationNumber, publicUrl } = data;
  return typeof quotationId === "string" &&
    typeof quotationNumber === "string" &&
    typeof publicUrl === "string"
    ? { quotationId, quotationNumber, publicUrl }
    : null;
}
