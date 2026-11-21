import type { Client } from "@/interfaces/ICliente";
import type { OrderDeliveryPatch } from "@/interfaces/IOrder";
import type { UpdateClientPayload } from "@/services/clients.service";

export const INVALID_GOOGLE_MAPS_LINK = "El link de Google Maps no es válido";

/**
 * ms-ventas only accepts the client's Google Maps link as a full http(s) URL.
 * People paste it without the protocol ("maps.app.goo.gl/..."), so add
 * https:// right before sending. `valid: false` means it still isn't a URL and
 * must not be sent. An empty field is allowed (url: null).
 */
export function normalizeGoogleMapsUrl(
  value?: string | null,
): { valid: true; url: string | null } | { valid: false } {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return { valid: true, url: null };
  const url = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  if (url.length > 500 || /\s/.test(url)) return { valid: false };
  try {
    const { hostname } = new URL(url);
    // Same idea as the backend rule: a real host with a domain ("a.b").
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(hostname)) return { valid: false };
  } catch {
    return { valid: false };
  }
  return { valid: true, url };
}

// Use the same normalization for loading a client and comparing edits. The API
// returns null for absent fields, and decimal coordinates can arrive as strings.
export function clientToFormFields(client: Client) {
  return {
    fullName: client.fullName ?? "",
    phoneNumber: client.phoneNumber ?? "",
    email: client.email ?? "",
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
  for (const field of ["fullName", "phoneNumber", "province", "district", "address"] as const) {
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
  // Email is a shared client field (not delivery). Empty clears the column.
  if (form.email.trim() !== previous.email.trim()) changes.email = form.email.trim() || null;
  if (form.reference !== previous.reference) changes.reference = form.reference || null;
  // Only an edited link is normalized: old imported values stay untouched. An
  // invalid one is kept as typed; the caller blocks the save and shows why.
  if (form.googleMapsUrl !== previous.googleMapsUrl) {
    const link = normalizeGoogleMapsUrl(form.googleMapsUrl);
    changes.googleMapsUrl = link.valid ? link.url : form.googleMapsUrl;
  }
  for (const field of ["latitude", "longitude"] as const) {
    if (form[field] !== previous[field]) {
      changes[field] = form[field].trim() ? Number(form[field]) : null;
    }
  }
  return changes;
}

/** Route one-order delivery edits away from the shared customer PATCH. */
export function splitOrderClientChanges(
  changes: UpdateClientPayload,
  hasDeliverySnapshot: boolean,
) {
  if (!hasDeliverySnapshot) return { sharedClientChanges: changes, deliveryChanges: undefined };
  const sharedClientChanges = { ...changes };
  const deliveryChanges: OrderDeliveryPatch = {};
  for (const field of [
    "province",
    "district",
    "address",
    "reference",
    "latitude",
    "longitude",
    "googleMapsUrl",
  ] as const) {
    if (changes[field] !== undefined) Object.assign(deliveryChanges, { [field]: changes[field] });
    delete sharedClientChanges[field];
  }
  if (changes.city !== undefined) deliveryChanges.department = changes.city;
  delete sharedClientChanges.city;
  return {
    sharedClientChanges,
    deliveryChanges: Object.keys(deliveryChanges).length ? deliveryChanges : undefined,
  };
}
