/**
 * Teléfonos (B2): formato internacional E.164 sin romper el peruano.
 *
 * - Un celular peruano se sigue guardando como 9 dígitos sin prefijo ("999888777").
 * - Un número extranjero se guarda canónico con "+" y código de país ("+5491123456789").
 *   E.164 admite "+" y hasta 15 dígitos.
 * - Los separadores (espacio, guion, punto, paréntesis) se aceptan al teclear y se quitan
 *   al guardar. Es la misma regla que aplica ms-ventas (common/phone/phone.util.ts).
 *
 * Es solo formato: no valida que el número exista ni el plan de numeración de cada país.
 */

export interface PhoneCountry {
  iso: string;
  name: string;
  /** Código de país sin "+". */
  dial: string;
}

/** Perú primero: es el país por defecto. */
export const COUNTRIES: PhoneCountry[] = [
  { iso: "PE", name: "Perú", dial: "51" },
  { iso: "AR", name: "Argentina", dial: "54" },
  { iso: "BO", name: "Bolivia", dial: "591" },
  { iso: "BR", name: "Brasil", dial: "55" },
  { iso: "CL", name: "Chile", dial: "56" },
  { iso: "CO", name: "Colombia", dial: "57" },
  { iso: "CR", name: "Costa Rica", dial: "506" },
  { iso: "CU", name: "Cuba", dial: "53" },
  { iso: "EC", name: "Ecuador", dial: "593" },
  { iso: "SV", name: "El Salvador", dial: "503" },
  { iso: "GT", name: "Guatemala", dial: "502" },
  { iso: "HN", name: "Honduras", dial: "504" },
  { iso: "MX", name: "México", dial: "52" },
  { iso: "NI", name: "Nicaragua", dial: "505" },
  { iso: "PA", name: "Panamá", dial: "507" },
  { iso: "PY", name: "Paraguay", dial: "595" },
  { iso: "UY", name: "Uruguay", dial: "598" },
  { iso: "VE", name: "Venezuela", dial: "58" },
  { iso: "US", name: "EE. UU. / Canadá", dial: "1" },
  { iso: "ES", name: "España", dial: "34" },
  { iso: "FR", name: "Francia", dial: "33" },
  { iso: "DE", name: "Alemania", dial: "49" },
  { iso: "IT", name: "Italia", dial: "39" },
  { iso: "PT", name: "Portugal", dial: "351" },
  { iso: "GB", name: "Reino Unido", dial: "44" },
];

export const DEFAULT_DIAL = "51";

export const PHONE_MIN_DIGITS = 3;
/** E.164: el código de país más el número nacional suman como máximo 15 dígitos. */
export const PHONE_MAX_DIGITS = 15;
/** Con "+" hace falta al menos un código de país y un número nacional corto. */
export const PHONE_MIN_INTERNATIONAL_DIGITS = 7;
/** Largo de las columnas phone_number existentes. */
export const PHONE_MAX_RAW_LENGTH = 30;

const SHAPE = /^\+?[0-9(][0-9 ()\-.]*$/;

const DIALS_LONGEST_FIRST = COUNTRIES.map((c) => c.dial).sort((a, b) => b.length - a.length);

const digitsOf = (value: string | null | undefined): string => (value ?? "").replace(/\D/g, "");

export function isValidPhone(raw: string | null | undefined): boolean {
  if (typeof raw !== "string") return false;
  const value = raw.trim();
  if (!value || value.length > PHONE_MAX_RAW_LENGTH || !SHAPE.test(value)) return false;
  const digits = digitsOf(value).length;
  if (digits < PHONE_MIN_DIGITS || digits > PHONE_MAX_DIGITS) return false;
  if (value.startsWith("+") && digits < PHONE_MIN_INTERNATIONAL_DIGITS) return false;
  return true;
}

/** Quita separadores y conserva un "+" inicial. */
export function normalizePhone(raw: string | null | undefined): string {
  const value = (raw ?? "").trim();
  if (!value) return "";
  const digits = digitsOf(value);
  return value.startsWith("+") ? `+${digits}` : digits;
}

export interface ParsedPhone {
  /** Código de país sin "+". Vacío cuando el país no está en la lista ("otro"). */
  dial: string;
  /** Solo dígitos del número nacional. */
  national: string;
}

/** Descompone un valor guardado para mostrarlo en el selector de país + el número. */
export function parsePhone(raw: string | null | undefined): ParsedPhone {
  const value = (raw ?? "").trim();
  if (!value) return { dial: DEFAULT_DIAL, national: "" };
  const digits = digitsOf(value);
  if (value.startsWith("+")) {
    const dial = DIALS_LONGEST_FIRST.find((d) => digits.startsWith(d));
    return dial ? { dial, national: digits.slice(dial.length) } : { dial: "", national: digits };
  }
  const peruMobile = /^51(9\d{8})$/.exec(digits);
  return { dial: DEFAULT_DIAL, national: peruMobile ? peruMobile[1] : digits };
}

/**
 * Valor a guardar. Perú queda como 9 dígitos sin prefijo (igual que siempre); cualquier otro
 * país, canónico con "+" y código. Sin dígitos no hay número.
 */
export function composePhone(dial: string, national: string): string {
  const digits = digitsOf(national);
  if (!digits) return "";
  return dial === DEFAULT_DIAL ? digits : `+${dial}${digits}`;
}

/**
 * Dígitos para wa.me / api.whatsapp.com. Con "+" ya trae el código de país y no se toca; un
 * número peruano (9 dígitos o menos, con o sin 0 de fijo) recibe el 51; uno largo sin "+"
 * se asume con su código de país (p. ej. "5491123456789"). El prefijo "00" cuenta como "+".
 * Antes se anteponía 51 a todo lo que no empezara con 51, y +54… quedaba como 5154….
 *
 * No sustituye a utils/whatsapp/build-whatsapp-url (estricta: solo celulares peruanos, la usan
 * los flujos de Shalom).
 */
export function toWhatsAppDigits(raw: string | null | undefined): string {
  const value = (raw ?? "").trim();
  const digits = digitsOf(value);
  if (!digits) return "";
  if (value.startsWith("+")) return digits;
  const national = digits.replace(/^0+/, "");
  if (!national) return "";
  return national.length <= 9 ? `51${national}` : national;
}
