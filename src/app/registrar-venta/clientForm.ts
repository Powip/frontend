import type { Client } from "@/interfaces/ICliente";
import type { UpdateClientPayload } from "@/services/clients.service";

// Use the same normalization for loading a client and comparing edits. The API
// returns null for absent fields, and decimal coordinates can arrive as strings.
export function clientToFormFields(client: Client) {
  return {
    fullName: client.fullName ?? "",
    phoneNumber: client.phoneNumber ?? "",
    documentType: client.documentType ?? undefined,
    documentNumber: client.documentNumber ?? "",
    clientType: client.clientType,
    department: client.city ?? "",
    province: client.province ?? "",
    district: client.district ?? "",
    address: client.address ?? "",
    reference: client.reference ?? "",
    latitude: client.latitude != null ? String(client.latitude) : "",
    longitude: client.longitude != null ? String(client.longitude) : "",
    googleMapsUrl: client.googleMapsUrl ?? "",
  };
}

export function buildClientUpdatePayload(
  original: Client,
  form: ReturnType<typeof clientToFormFields>,
): UpdateClientPayload {
  const previous = clientToFormFields(original);
  const changes: UpdateClientPayload = {};

  // Existing clients from imports can have fields that don't meet today's
  // create validation. A PATCH must validate only the values actually edited.
  for (const field of [
    "fullName",
    "phoneNumber",
    "province",
    "district",
    "address",
  ] as const) {
    if (form[field] !== previous[field]) changes[field] = form[field];
  }
  if (form.clientType !== previous.clientType) changes.clientType = form.clientType;
  if (form.department !== previous.department) changes.city = form.department;

  // The number's validator needs its type in the same request. Explicit nulls
  // clear nullable columns; omitted/undefined values would keep the old data.
  if (
    form.documentType !== previous.documentType ||
    form.documentNumber !== previous.documentNumber
  ) {
    changes.documentType = form.documentType ?? null;
    changes.documentNumber = form.documentType ? form.documentNumber : null;
  }
  for (const field of ["reference", "googleMapsUrl"] as const) {
    if (form[field] !== previous[field]) changes[field] = form[field] || null;
  }
  for (const field of ["latitude", "longitude"] as const) {
    if (form[field] !== previous[field]) {
      changes[field] = form[field].trim() ? Number(form[field]) : null;
    }
  }
  return changes;
}
