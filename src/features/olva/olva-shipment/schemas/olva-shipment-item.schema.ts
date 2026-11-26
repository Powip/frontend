import { z } from "zod";
import { OLVA_DOCUMENT_NUMBER_LENGTH } from "../../olva-person/constants/olva-person.constants";
import { isValidOlvaDocumentNumber } from "../../olva-person/utils/is-valid-olva-document-number";
import {
  OLVA_DELIVERY_TYPES,
  OLVA_IDENTITY_DOCUMENT_TYPES,
  OLVA_PAYMENT_METHODS,
  OLVA_WHO_PAYS_OPTIONS,
} from "../../shared/constants/olva-enums.constants";
import {
  OLVA_EXTERNAL_REF_MAX_LENGTH,
  OLVA_HOME_DELIVERY_MIN_REFERENCE_LENGTH,
  OLVA_MAX_DECLARED_VALUE_WHEN_DESTINATION_PAYS,
  OLVA_MIN_DECLARED_VALUE,
  OLVA_PACKAGE_SHIPMENT_TYPE,
  OLVA_SHIPMENT_PIN_LENGTH,
  OLVA_UBIGEO_CODE_LENGTH,
} from "../constants/olva-shipment.constants";
import type { OlvaShipmentDeliveryInput } from "../models/create-olva-shipment-input";

// Same rules as shipment-item.schema.ts on the backend (shared by POST /shipments and /bulk).
// User-facing messages are in Spanish like the rest of the UI.
const requiredText = (message: string) =>
  z.string({ error: message }).trim().min(1, { error: message });

// A blank input means "not provided": it leaves the form as `undefined`
const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);

const blankToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

// Inputs hand over text: "" -> undefined, "12.5" -> 12.5
const optionalNumber = (message: string) =>
  z.preprocess(
    blankToUndefined,
    z.coerce.number<unknown>({ error: message }).positive({ error: message }).optional(),
  );

const recipientSchema = z
  .object({
    documentType: z.enum(OLVA_IDENTITY_DOCUMENT_TYPES).default(OLVA_IDENTITY_DOCUMENT_TYPES.DNI),
    documentNumber: requiredText("El documento del destinatario es obligatorio"),
    fullName: requiredText("El nombre del destinatario es obligatorio"),
    phone: requiredText("El teléfono del destinatario es obligatorio"),
    email: z
      .string()
      .trim()
      .optional()
      .transform((value) => value || undefined)
      .pipe(z.email({ error: "El formato del correo no es válido" }).optional()),
  })
  .superRefine(({ documentType, documentNumber }, ctx) => {
    // Empty is already reported above; do not stack a second message on it
    if (documentNumber === "" || isValidOlvaDocumentNumber(documentType, documentNumber)) return;

    ctx.addIssue({
      code: "custom",
      path: ["documentNumber"],
      message: `El ${documentType.toUpperCase()} debe tener ${OLVA_DOCUMENT_NUMBER_LENGTH[documentType]} dígitos`,
    });
  });

/**
 * The shape of one shipment, without the rules that look at several fields (see
 * `getOlvaShipmentItemIssues`). Zod cannot extend an already refined object, so each request
 * schema spreads these fields and applies those rules with its own `superRefine`.
 */
export const olvaShipmentItemFields = {
  recipient: recipientSchema,
  origin: z.object({
    headquarterId: requiredText("Elige la sede de origen"),
    address: optionalText,
  }),
  // Which fields apply depends on `deliveryType`: `agencyCode` for store pickup (the default),
  // `ubigeoCode` + `address` + `reference` for home delivery. `getOlvaShipmentItemIssues` checks it.
  destination: z.object({
    agencyCode: optionalText,
    ubigeoCode: optionalText,
    address: optionalText,
    reference: optionalText,
  }),
  package: z.object({
    weightKg: z.coerce
      .number<unknown>({ error: "El peso es obligatorio" })
      .min(0.01, { error: "El peso mínimo es 0.01 kg" }),
    // Olva only registers packages; blank means the default (2)
    shipmentType: z.preprocess(
      blankToUndefined,
      z.coerce
        .number<unknown>()
        .pipe(
          z.literal(OLVA_PACKAGE_SHIPMENT_TYPE, {
            error: "Olva solo registra paquetes (tipo 2)",
          }),
        )
        .optional(),
    ),
    sizeId: optionalText,
    // Olva rejects a shipment without a declared value
    declaredValue: z.preprocess(
      blankToUndefined,
      z.coerce
        .number<unknown>({ error: "El valor declarado es obligatorio" })
        .min(OLVA_MIN_DECLARED_VALUE, { error: "El valor declarado debe ser mayor a 0" }),
    ),
    insuranceAccepted: z.boolean().optional(),
    articleId: z.preprocess(
      blankToUndefined,
      z.coerce
        .number<unknown>({ error: "Categoría no válida" })
        .int({ error: "Categoría no válida" })
        .positive({ error: "Categoría no válida" })
        .optional(),
    ),
    description: optionalText,
    lengthCm: optionalNumber("El largo debe ser mayor a 0"),
    widthCm: optionalNumber("El ancho debe ser mayor a 0"),
    heightCm: optionalNumber("El alto debe ser mayor a 0"),
  }),
  whoPays: z.enum(OLVA_WHO_PAYS_OPTIONS).optional(),
  deliveryType: z.enum(OLVA_DELIVERY_TYPES).optional(),
  pin: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined)
    .pipe(
      z
        .string()
        .regex(new RegExp(`^\\d{${OLVA_SHIPMENT_PIN_LENGTH}}$`), {
          error: `El PIN debe tener exactamente ${OLVA_SHIPMENT_PIN_LENGTH} dígitos`,
        })
        .optional(),
    ),
  paymentMethod: z.enum(OLVA_PAYMENT_METHODS).optional(),
  // The caller's own order (and guide). Without an order id there is no reference at all.
  externalRef: z
    .object({
      orderId: z
        .string()
        .trim()
        .max(OLVA_EXTERNAL_REF_MAX_LENGTH, {
          error: `El pedido no puede superar los ${OLVA_EXTERNAL_REF_MAX_LENGTH} caracteres`,
        }),
      guideId: z
        .string()
        .trim()
        .max(OLVA_EXTERNAL_REF_MAX_LENGTH, {
          error: `La guía no puede superar los ${OLVA_EXTERNAL_REF_MAX_LENGTH} caracteres`,
        })
        .optional()
        .transform((value) => value || undefined),
    })
    .optional()
    .transform((value) => (value?.orderId ? value : undefined)),
};

const olvaShipmentItemObjectSchema = z.object(olvaShipmentItemFields);

export type OlvaShipmentItemValues = z.output<typeof olvaShipmentItemObjectSchema>;

export interface OlvaShipmentItemIssue {
  path: (string | number)[];
  message: string;
}

/**
 * Store pickup (the default) goes to an agency; home delivery goes to a ubigeo + address +
 * reference and is only registered paid online. Each issue points at the exact field.
 */
function getOlvaDestinationIssues(item: OlvaShipmentItemValues): OlvaShipmentItemIssue[] {
  const issues: OlvaShipmentItemIssue[] = [];
  const { destination } = item;

  if (item.deliveryType !== OLVA_DELIVERY_TYPES.HOME_DELIVERY) {
    if (!destination.agencyCode) {
      issues.push({ path: ["destination", "agencyCode"], message: "Elige la agencia de destino" });
    }

    // address and reference are dropped for store pickup; a ubigeo only means home delivery
    if (destination.ubigeoCode) {
      issues.push({
        path: ["destination", "ubigeoCode"],
        message: "El ubigeo solo aplica a la entrega a domicilio",
      });
    }

    return issues;
  }

  if (destination.agencyCode) {
    issues.push({
      path: ["destination", "agencyCode"],
      message: "La agencia solo aplica al recojo en tienda",
    });
  }

  if (!destination.ubigeoCode) {
    issues.push({
      path: ["destination", "ubigeoCode"],
      message: "Elige el distrito de destino para la entrega a domicilio",
    });
  } else if (!new RegExp(`^\\d{${OLVA_UBIGEO_CODE_LENGTH}}$`).test(destination.ubigeoCode)) {
    issues.push({
      path: ["destination", "ubigeoCode"],
      message: `El ubigeo debe tener exactamente ${OLVA_UBIGEO_CODE_LENGTH} dígitos`,
    });
  }

  if (!destination.address) {
    issues.push({
      path: ["destination", "address"],
      message: "La dirección de destino es obligatoria para entrega a domicilio",
    });
  }

  if ((destination.reference?.length ?? 0) < OLVA_HOME_DELIVERY_MIN_REFERENCE_LENGTH) {
    issues.push({
      path: ["destination", "reference"],
      message: `La referencia es obligatoria para entrega a domicilio (mínimo ${OLVA_HOME_DELIVERY_MIN_REFERENCE_LENGTH} caracteres)`,
    });
  }

  // Olva only registers home delivery paid online: paying at the destination is store pickup only
  if (item.whoPays !== OLVA_WHO_PAYS_OPTIONS.ONLINE) {
    issues.push({
      path: ["whoPays"],
      message: "La entrega a domicilio solo se registra pagada en línea",
    });
  }

  // Olva only takes a pickup PIN for store pickup
  if (item.pin) {
    issues.push({ path: ["pin"], message: "El PIN solo aplica al recojo en tienda" });
  }

  return issues;
}

/**
 * Rules between fields of one shipment that Olva would otherwise reject later with a vague 4xx.
 * Pure on purpose: it returns the issues and each schema decides how to report them (the path is
 * relative to the shipment, so inside a lot zod prefixes it with `items.N`). What depends on the
 * origin headquarter (which `whoPays` it offers) needs the catalog: see
 * `requiresOlvaPaymentMethod` in olva-catalog; whether the ubigeo exists needs the catalog too:
 * see `isKnownOlvaUbigeo`.
 *
 * The recipient document length is checked in `recipientSchema`.
 */
export function getOlvaShipmentItemIssues(item: OlvaShipmentItemValues): OlvaShipmentItemIssue[] {
  const issues: OlvaShipmentItemIssue[] = [];

  // Paying online needs a way to pay, and no other mode accepts one
  if (item.whoPays === OLVA_WHO_PAYS_OPTIONS.ONLINE) {
    if (!item.paymentMethod) {
      issues.push({ path: ["paymentMethod"], message: "Elige un método de pago" });
    }
  } else if (item.paymentMethod) {
    issues.push({
      path: ["paymentMethod"],
      message: "El método de pago solo aplica cuando se paga en línea",
    });
  }

  issues.push(...getOlvaDestinationIssues(item));

  const declaredValue = item.package.declaredValue;

  if (
    item.whoPays === OLVA_WHO_PAYS_OPTIONS.DESTINATION &&
    typeof declaredValue === "number" &&
    declaredValue > OLVA_MAX_DECLARED_VALUE_WHEN_DESTINATION_PAYS
  ) {
    issues.push({
      path: ["package", "declaredValue"],
      message: `El valor declarado no puede superar ${OLVA_MAX_DECLARED_VALUE_WHEN_DESTINATION_PAYS} cuando paga el destinatario`,
    });
  }

  return issues;
}

/**
 * Narrows the flat, validated fields that depend on the delivery type to the union the request
 * mapper takes, so an agency can never travel with a home delivery. Only valid after
 * `getOlvaShipmentItemIssues` found nothing (zod stops before a transform when there are
 * issues), so the checks below only narrow the types. Fields of the other delivery type are
 * dropped here.
 */
export function narrowOlvaShipmentDelivery(
  item: OlvaShipmentItemValues,
): OlvaShipmentDeliveryInput {
  const { destination, paymentMethod } = item;

  if (item.deliveryType === OLVA_DELIVERY_TYPES.HOME_DELIVERY) {
    if (
      !destination.ubigeoCode ||
      !destination.address ||
      !destination.reference ||
      !paymentMethod
    ) {
      throw new Error("A home delivery reached the narrowing step without its required fields");
    }

    return {
      deliveryType: item.deliveryType,
      destination: {
        ubigeoCode: destination.ubigeoCode,
        address: destination.address,
        reference: destination.reference,
      },
      whoPays: OLVA_WHO_PAYS_OPTIONS.ONLINE,
      paymentMethod,
    };
  }

  if (!destination.agencyCode) {
    throw new Error("A store pickup reached the narrowing step without its agency");
  }

  return {
    deliveryType: item.deliveryType,
    destination: { agencyCode: destination.agencyCode },
    whoPays: item.whoPays,
    paymentMethod,
    pin: item.pin,
  };
}

/**
 * The validated item with its delivery fields replaced by the narrowed union (the flat ones are
 * left out, or an optional `deliveryType` of the union would keep the flat one's value).
 * Each request schema ends with this transform.
 */
export function withNarrowedOlvaDelivery<T extends OlvaShipmentItemValues>(item: T) {
  const {
    destination: _destination,
    deliveryType: _deliveryType,
    whoPays: _whoPays,
    paymentMethod: _paymentMethod,
    pin: _pin,
    ...rest
  } = item;

  return { ...rest, ...narrowOlvaShipmentDelivery(item) };
}
