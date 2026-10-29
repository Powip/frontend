const CREDENTIALS_MESSAGE =
  "El correo o la contraseña son incorrectos. Revisa tus datos e intenta nuevamente.";
const VALIDATION_MESSAGE = "Revisa tu correo y contraseña e intenta nuevamente.";
const FALLBACK_MESSAGE = "No pudimos iniciar sesión. Intenta nuevamente.";
const AUTH_FIELDS = [
  "email",
  "password",
  "name",
  "surname",
  "phone",
  "phoneNumber",
  "identityDocument",
  "address",
  "district",
];

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function payloadMessages(value: unknown, depth = 0): string[] {
  if (depth > 4) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) {
    return value.slice(0, 20).flatMap((item) => payloadMessages(item, depth + 1));
  }
  const record = asRecord(value);
  if (!record) return [];
  return ["message", "error", "errors", "defaultMessage", ...AUTH_FIELDS].flatMap((field) =>
    payloadMessages(record[field], depth + 1).map((message) =>
      AUTH_FIELDS.includes(field) ? `${field} ${message}` : message,
    ),
  );
}

function normalize(message: string): string {
  return message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isCredentialsMessage(message: string): boolean {
  return /bad credentials|invalid credentials|credenciales (?:invalid|incorrect)|(?:correo|email|usuario|user|account|cuenta).*(?:no (?:existe|encontrad)|not found|does not exist|unknown|no registrad|not registered|ya registrad|already (?:exists|registered)|bloquead|inactiv|deshabilitad|disabled|locked)|(?:password|contrasena).*(?:incorrect|invalid|no coincide|does not match)/.test(
    message,
  );
}

function validationMessage(message: string): string | undefined {
  const isRequired =
    /obligatori|requerid|required|not (?:be )?(?:blank|empty)|no puede estar vaci/.test(message);
  if (/email|correo/.test(message)) {
    if (isRequired) return "Ingresa tu correo electrónico.";
    if (/invalid|valid|formato|format|must be an email/.test(message)) {
      return "Ingresa un correo electrónico válido.";
    }
  }
  if (/password|contrasena/.test(message)) {
    if (isRequired) return "Ingresa tu contraseña.";
    if (
      /(?:al menos|minim|least|equal to) 6 (?:caracter|character)/.test(message) &&
      /minuscula|lowercase/.test(message) &&
      /numero|number|digit/.test(message)
    ) {
      return "La contraseña debe tener al menos 6 caracteres, una letra minúscula y un número.";
    }
  }
  return undefined;
}

/** Converts login failures into fixed UI copy; never returns server text or account existence. */
export function loginErrorMessage(error: unknown): string {
  const record = asRecord(error);
  if (!record) return FALLBACK_MESSAGE;
  const response = asRecord(record.response);
  const status = response?.status;

  if (status === 401 || status === 403) return CREDENTIALS_MESSAGE;
  if (status === 429) {
    return "Demasiados intentos. Espera unos minutos e intenta nuevamente.";
  }
  if (typeof status === "number" && status >= 500) {
    return "No pudimos iniciar sesión en este momento. Intenta nuevamente en unos minutos.";
  }
  if (status === 408 || (!response && /^(?:ECONNABORTED|ETIMEDOUT)$/.test(String(record.code)))) {
    return "La solicitud tardó demasiado. Intenta nuevamente.";
  }
  if (
    !response &&
    (/^(?:ERR_NETWORK|ENOTFOUND|ECONNREFUSED|ECONNRESET)$/.test(String(record.code)) ||
      record.request !== undefined)
  ) {
    return "No pudimos conectarnos. Revisa tu conexión e intenta nuevamente.";
  }
  if (status === 400) {
    const messages = payloadMessages(response?.data).map(normalize);
    // Spring can wrap authentication exceptions as 400; keep them indistinguishable from 401.
    if (messages.some(isCredentialsMessage)) return CREDENTIALS_MESSAGE;
    const validations = [...new Set(messages.map(validationMessage).filter(Boolean))];
    return validations.length > 0 ? validations.join(" ") : VALIDATION_MESSAGE;
  }
  return FALLBACK_MESSAGE;
}

function registrationValidationMessage(message: string): string | undefined {
  const authValidation = validationMessage(message);
  if (authValidation) return authValidation.replace(/\.$/, "");
  const isRequired =
    /obligatori|requerid|required|not (?:be )?(?:blank|empty)|no puede estar vaci/.test(message);
  if (/phone|telefono/.test(message)) {
    if (isRequired) return "El teléfono es obligatorio";
    if (/9 (?:digitos|digits)/.test(message)) return "El teléfono debe tener 9 dígitos";
  }
  if (/address|direccion/.test(message)) {
    if (isRequired) return "La dirección es obligatoria";
    if (/(?:al menos|least|equal to) 5 (?:caracter|character)/.test(message)) {
      return "La dirección debe tener al menos 5 caracteres";
    }
  }
  if (/district|distrito/.test(message) && isRequired) return "El distrito es obligatorio";
  if (/surname|apellido/.test(message) && isRequired) return "El apellido es obligatorio";
  if (/\bname\b|nombre/.test(message) && isRequired) return "El nombre es obligatorio";
  if (/identity\s*document|documento|\bdni\b|\bruc\b/.test(message) && isRequired) {
    return "El documento de identidad es obligatorio";
  }
  return undefined;
}

/** Keeps registration guidance actionable without displaying untrusted server details. */
export function registrationErrorMessage(error: unknown): string {
  const fallback = "No pudimos crear tu cuenta. Intenta nuevamente.";
  const record = asRecord(error);
  if (!record) return fallback;
  const response = asRecord(record.response);
  const status = response?.status;
  if (status === 429) {
    return "Demasiados intentos. Espera unos minutos e intenta nuevamente.";
  }
  if (typeof status === "number" && status >= 500) {
    return "No pudimos crear tu cuenta en este momento. Intenta nuevamente en unos minutos.";
  }
  if (status === 408 || (!response && /^(?:ECONNABORTED|ETIMEDOUT)$/.test(String(record.code)))) {
    return "La solicitud tardó demasiado. Intenta nuevamente.";
  }
  if (
    !response &&
    (/^(?:ERR_NETWORK|ENOTFOUND|ECONNREFUSED|ECONNRESET)$/.test(String(record.code)) ||
      record.request !== undefined)
  ) {
    return "No pudimos conectarnos. Revisa tu conexión e intenta nuevamente.";
  }

  const payload = response?.data;
  const messages = payloadMessages(payload).map(normalize);
  const payloadRecord = asRecord(payload);
  const details = [
    ...messages,
    ...payloadMessages(payloadRecord?.code),
    ...payloadMessages(payloadRecord?.errorCode),
  ]
    .map(normalize)
    .join(" ");
  const isDuplicate =
    status === 409 ||
    (status === 400 &&
      /already\s*(?:exists|registered|used)|duplicate|duplicad|ya (?:existe|esta registrad|registrad|esta en uso)|(?:email|correo|identity document|dni|ruc)\s*(?:exists|registered|taken)/.test(
        details,
      ));
  if (isDuplicate) {
    const hasDocument = /identity\s*document|documento|\bdni\b|\bruc\b/.test(details);
    const hasEmail = /email|correo/.test(details);
    if (hasDocument && !hasEmail) {
      return "El documento de identidad ya está registrado. Revisa tus datos o contacta a soporte.";
    }
    if (hasEmail && !hasDocument) {
      return "Este email ya está registrado. Inicia sesión para continuar con tu suscripción.";
    }
    return "Estos datos ya están registrados. Si ya tienes una cuenta, inicia sesión para continuar.";
  }
  if (status === 400) {
    const validations = [...new Set(messages.map(registrationValidationMessage).filter(Boolean))];
    return validations.length > 0
      ? validations.join(". ")
      : "Datos inválidos. Revisa los campos e intenta nuevamente.";
  }
  return fallback;
}
