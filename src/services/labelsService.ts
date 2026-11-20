import axios from "axios";
import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import type { LabelFormat, LabelFormatShape, LabelLine } from "@/lib/labels/types";
import type { LabelsDataRequest } from "@/lib/labels/request";

// FEAT-24 H7 — etiquetas de producto en ms-products. La empresa sale del token: nunca se envía un companyId.

const base = () => process.env.NEXT_PUBLIC_API_PRODUCTOS || GATEWAY.products;

export interface SaveLabelFormatInput extends LabelFormatShape {
  isDefault?: boolean;
}

/** Formatos de la empresa (la primera vez el backend copia los 3 base de POWIP). */
export async function listLabelFormats(): Promise<LabelFormat[]> {
  const { data } = await axiosAuth.get<LabelFormat[]>(`${base()}/label-formats`);
  return data;
}

const body = (input: SaveLabelFormatInput) => ({
  name: input.name.trim(),
  widthMm: input.widthMm,
  heightMm: input.heightMm,
  output: input.output,
  fields: input.fields,
  ...(input.isDefault ? { isDefault: true } : {}),
});

export async function createLabelFormat(input: SaveLabelFormatInput): Promise<LabelFormat> {
  const { data } = await axiosAuth.post<LabelFormat>(`${base()}/label-formats`, body(input));
  return data;
}

export async function updateLabelFormat(id: string, input: SaveLabelFormatInput): Promise<LabelFormat> {
  const { data } = await axiosAuth.put<LabelFormat>(`${base()}/label-formats/${encodeURIComponent(id)}`, body(input));
  return data;
}

export async function setDefaultLabelFormat(id: string): Promise<LabelFormat> {
  const { data } = await axiosAuth.put<LabelFormat>(`${base()}/label-formats/${encodeURIComponent(id)}/default`);
  return data;
}

/** Líneas a imprimir (sin costo). */
export async function fetchLabelLines(request: LabelsDataRequest, signal?: AbortSignal): Promise<LabelLine[]> {
  const { data } = await axiosAuth.post<LabelLine[]>(`${base()}/labels/data`, request, { signal });
  return data;
}

/** El mensaje del backend (string o lista), o `fallback`. */
export function labelsErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<{ message?: string | string[] }>(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message) && message.length) return message.join(", ");
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}
