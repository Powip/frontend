import type { SunatDocumentType } from "../../sunat-document/enums/sunat-document.enums";

/**
 * What a SUNAT "issuer access" fault means for the taxpayer and what they
 * have to do. These faults are SUNAT refusing the SOL user or the RUC
 * before looking at the document, so the fix is always in the taxpayer's
 * SUNAT account or in the SOL credentials stored in Powip - never in the
 * document.
 *
 * The steps deliberately avoid exact SUNAT menu names: SUNAT renames them
 * and they must be validated with an accountant before being more precise.
 */
export interface IssuerAccessError {
  code: string;
  /** One line: what SUNAT is saying, in plain Spanish. */
  title: string;
  /** Why it happens. */
  cause: string;
  /** What the taxpayer has to do. `{solUser}` is replaced by the SOL user. */
  steps: string[];
  /** Where it is fixed. */
  fixedIn: "SUNAT" | "POWIP";
}

const SUNAT_ACCOUNT_LAST_STEP =
  'Cuando esté corregido, vuelve aquí y pulsa "Ya lo corregí en SUNAT".';

const WRONG_CREDENTIALS_STEPS = [
  "Verifica en SUNAT el usuario SOL {solUser} y su clave: deben ser los de este RUC.",
  'En Powip el usuario y la clave SOL se cambian volviendo a registrar el RUC: pestaña "Certificado Digital", elimina este RUC y regístralo otra vez con los datos correctos.',
];

const ISSUER_ACCESS_ERRORS: IssuerAccessError[] = [
  {
    code: "0102",
    title: "El usuario o la clave SOL son incorrectos",
    cause: "SUNAT no reconoce el usuario o la clave SOL que Powip tiene guardados para este RUC.",
    steps: WRONG_CREDENTIALS_STEPS,
    fixedIn: "POWIP",
  },
  {
    code: "0103",
    title: "El usuario SOL no existe",
    cause: "SUNAT dice que el usuario SOL guardado en Powip no existe para este RUC.",
    steps: WRONG_CREDENTIALS_STEPS,
    fixedIn: "POWIP",
  },
  {
    code: "0105",
    title: "El usuario SOL no está activo",
    cause: "El usuario SOL existe pero SUNAT lo tiene inactivo.",
    steps: [
      "Entra a SUNAT con el usuario principal del RUC y activa el usuario SOL {solUser}, o crea uno nuevo.",
      "Si creas un usuario nuevo, vuelve a registrar el RUC en Powip con ese usuario.",
      SUNAT_ACCOUNT_LAST_STEP,
    ],
    fixedIn: "SUNAT",
  },
  {
    code: "0106",
    title: "El usuario SOL no es válido",
    cause: "SUNAT no acepta el usuario SOL guardado en Powip para este RUC.",
    steps: WRONG_CREDENTIALS_STEPS,
    fixedIn: "POWIP",
  },
  {
    code: "0110",
    title: "SUNAT no pudo identificar el tipo de usuario SOL",
    cause: "SUNAT no pudo obtener la información del usuario SOL con el que se envía.",
    steps: [
      "Verifica en SUNAT que el usuario SOL {solUser} exista y esté activo para este RUC.",
      SUNAT_ACCOUNT_LAST_STEP,
    ],
    fixedIn: "SUNAT",
  },
  {
    code: "0111",
    title: "El usuario SOL no tiene permiso para enviar comprobantes electrónicos",
    cause:
      "SUNAT reconoce al usuario SOL, pero ese usuario no tiene asignado el perfil para enviar comprobantes electrónicos.",
    steps: [
      "Entra a SUNAT Operaciones en Línea con el usuario principal del RUC (no con el usuario secundario).",
      "En la administración de usuarios secundarios, abre el usuario {solUser} y asígnale el perfil de envío de comprobantes electrónicos.",
      SUNAT_ACCOUNT_LAST_STEP,
    ],
    fixedIn: "SUNAT",
  },
  {
    code: "0112",
    title: "SUNAT exige que el envío lo haga un usuario secundario",
    cause: "El usuario SOL guardado en Powip no es un usuario secundario, y SUNAT lo exige.",
    steps: [
      "Entra a SUNAT con el usuario principal del RUC y crea un usuario secundario con el perfil de envío de comprobantes electrónicos.",
      "Vuelve a registrar el RUC en Powip con ese usuario secundario y su clave.",
    ],
    fixedIn: "SUNAT",
  },
  {
    code: "0113",
    title: "El RUC no está afiliado a la emisión electrónica",
    cause:
      "SUNAT dice que este RUC no está afiliado para emitir este comprobante de forma electrónica.",
    steps: [
      "Entra a SUNAT con el usuario principal del RUC y completa la afiliación como emisor electrónico.",
      SUNAT_ACCOUNT_LAST_STEP,
    ],
    fixedIn: "SUNAT",
  },
  {
    code: "0154",
    title: "El usuario SOL no pertenece a este RUC",
    cause:
      "SUNAT dice que el RUC del comprobante no corresponde al RUC del usuario SOL con el que se envió.",
    steps: [
      "Verifica que el usuario SOL {solUser} sea de este mismo RUC y no de otra empresa.",
      "Vuelve a registrar el RUC en Powip con un usuario SOL de este RUC.",
    ],
    fixedIn: "POWIP",
  },
];

const BY_CODE = new Map(ISSUER_ACCESS_ERRORS.map((error) => [error.code, error]));

/** SUNAT sends the same fault under several prefixes ("a:Client.0111"). */
function normalizeCode(sunatCode: string | null | undefined): string | null {
  return sunatCode ? (/(\d{4})\s*$/.exec(sunatCode)?.[1] ?? null) : null;
}

/** True when the code means SUNAT refused the issuer, not the document. */
export function isIssuerAccessCode(sunatCode: string | null | undefined): boolean {
  const code = normalizeCode(sunatCode);

  return code !== null && BY_CODE.has(code);
}

export function getIssuerAccessError(
  sunatCode: string | null | undefined,
): IssuerAccessError | undefined {
  const code = normalizeCode(sunatCode);

  return code === null ? undefined : BY_CODE.get(code);
}

/** Steps with the SOL user filled in ("tu usuario SOL" when unknown). */
export function getIssuerAccessSteps(error: IssuerAccessError, solUser: string | null): string[] {
  return error.steps.map((step) => step.replace("{solUser}", solUser ?? "de este RUC"));
}

const DOCUMENT_TYPE_PLURALS: Record<SunatDocumentType, string> = {
  "01": "facturas",
  "03": "boletas",
  "07": "notas de crédito",
  "08": "notas de débito",
};

export function getDocumentTypePlural(taxDocumentType: SunatDocumentType): string {
  return DOCUMENT_TYPE_PLURALS[taxDocumentType] ?? "comprobantes";
}
