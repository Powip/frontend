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
};

export function clientSaveErrorMessage(error: unknown): string {
  const retained = "Los datos de la venta se conservan en el formulario.";
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
