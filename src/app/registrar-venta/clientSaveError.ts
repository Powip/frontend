import axios from "axios";

const fieldLabels: Record<string, string> = {
  fullName: "nombre",
  phoneNumber: "teléfono",
  documentType: "tipo de documento",
  documentNumber: "número de documento",
  clientType: "tipo de cliente",
  province: "provincia",
  city: "departamento",
  district: "distrito",
  address: "dirección",
  reference: "referencia",
  latitude: "latitud",
  longitude: "longitud",
  googleMapsUrl: "enlace de Google Maps (URL completa con http:// o https://, máximo 500 caracteres)",
  email: "correo electrónico",
};

const EMAIL_CONFLICT = "Ya existe otro cliente con ese correo en esta empresa";

export function clientSaveErrorMessage(error: unknown): string {
  const retained = "Los datos de la venta se conservan en el formulario.";
  // ms-ventas: (company_id, email) es único. Solo se muestra el texto conocido, nunca el cuerpo crudo.
  if (
    axios.isAxiosError(error) &&
    error.response?.status === 409 &&
    error.response.data?.message === EMAIL_CONFLICT
  ) {
    return `No se pudieron guardar los cambios del cliente. ${EMAIL_CONFLICT}: usa otro correo o déjalo vacío. ${retained}`;
  }
  if (axios.isAxiosError(error) && error.response?.status === 400) {
    const message: unknown = error.response.data?.message;
    const messages = typeof message === "string"
      ? [message]
      : Array.isArray(message) ? message : [];
    const fields = Object.entries(fieldLabels)
      .filter(([field]) => messages.some(
        (item) => typeof item === "string" && new RegExp(`\\b${field}\\b`).test(item),
      ))
      .map(([, label]) => label);
    if (
      messages.some((item) => typeof item === "string" && item.includes("número de documento")) &&
      !fields.includes(fieldLabels.documentNumber)
    ) {
      fields.push(fieldLabels.documentNumber);
    }
    return `No se pudieron guardar los cambios del cliente. Revisa ${fields.length ? fields.join(", ") : "los datos del cliente"}. ${retained}`;
  }
  return `No se pudieron guardar los cambios del cliente. ${retained} Vuelve a confirmar para reintentar.`;
}

const CREATE_FALLBACK = "No se pudo crear el cliente. Revisa los datos del cliente e intenta de nuevo.";
const CREATE_CONFLICTS = [
  EMAIL_CONFLICT,
  "Ya existe un cliente con ese teléfono en esta empresa",
];

/** Reason shown when ms-ventas rejects POST /clients. Never shows the raw body. */
export function clientCreateErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) return CREATE_FALLBACK;
  if (!error.response) {
    return "No se pudo crear el cliente: no hay conexión con el servidor. Revisa tu internet e intenta de nuevo.";
  }
  const { status, data } = error.response;
  const message: unknown = data?.message;
  const messages = (typeof message === "string" ? [message] : Array.isArray(message) ? message : [])
    .filter((item): item is string => typeof item === "string");

  if (status === 400) {
    // The validator starts each message with the field name; matching anywhere
    // would read "googleMapsUrl must be a URL address" as the address field too.
    const fields = Object.keys(fieldLabels).filter((field) =>
      messages.some((item) => new RegExp(`^${field}\\b`).test(item)),
    );
    if (
      messages.some((item) => item.includes("número de documento")) &&
      !fields.includes("documentNumber")
    ) {
      fields.push("documentNumber");
    }
    const parts: string[] = [];
    if (fields.includes("googleMapsUrl")) parts.push("El link de Google Maps no es válido.");
    const others = fields.filter((field) => field !== "googleMapsUrl").map((field) => fieldLabels[field]);
    if (others.length) parts.push(`Revisa ${others.join(", ")}.`);
    return parts.length ? `No se pudo crear el cliente. ${parts.join(" ")}` : CREATE_FALLBACK;
  }
  if (status === 409) {
    const known = CREATE_CONFLICTS.find((text) => messages.includes(text));
    return known
      ? `No se pudo crear el cliente. ${known}.`
      : "No se pudo crear el cliente: ya existe un cliente con esos datos en esta empresa.";
  }
  if (status === 401) return "No se pudo crear el cliente: tu sesión venció. Vuelve a iniciar sesión.";
  if (status === 403) return "No se pudo crear el cliente: tu usuario no tiene permiso en esta empresa.";
  return "No se pudo crear el cliente por un problema del servidor. Intenta de nuevo en unos minutos.";
}
