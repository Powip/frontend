import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import type { ExportLibroQuery, ExportLibroResponse } from "../models/exportacion.model";

/** `filename` de un `Content-Disposition`; `fallback` si el header no llegó o no lo trae. */
export function nombreDeDescarga(contentDisposition: unknown, fallback: string): string {
  if (typeof contentDisposition !== "string") return fallback;
  const coincide = /filename\s*=\s*"?([^";]+)"?/i.exec(contentDisposition);
  const nombre = coincide?.[1]?.trim();
  return nombre || fallback;
}

/**
 * Con `responseType: 'blob'` axios deja el cuerpo de un error (JSON de Nest) como Blob. Se lee y
 * se vuelve a poner como objeto para que `mensajeDeError` encuentre `message`.
 */
function textoDelBlob(blob: Blob): Promise<string> {
  if (typeof blob.text === "function") return blob.text();
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result));
    lector.onerror = () => reject(lector.error);
    lector.readAsText(blob);
  });
}

async function leerErrorDelBlob(error: unknown): Promise<unknown> {
  const respuesta = (error as { response?: { data?: unknown } } | null)?.response;
  if (!respuesta || !(respuesta.data instanceof Blob)) return error;
  try {
    respuesta.data = JSON.parse(await textoDelBlob(respuesta.data));
  } catch {
    // Cuerpo que no es JSON: se conserva el error original.
  }
  return error;
}

/** GET /panel/export.xlsx (solo Dueño). El nombre viene del `Content-Disposition`. */
export async function descargarLibro(query: ExportLibroQuery): Promise<ExportLibroResponse> {
  const { formato: _formato, ...params } = query;
  const base = process.env.NEXT_PUBLIC_API_VENTAS || GATEWAY.ventas;
  try {
    const { data, headers } = await axiosAuth.get<Blob>(`${base}/panel/export.xlsx`, {
      params,
      responseType: "blob",
    });
    const fallback = `powip_panel_${params.desde}_${params.hasta}.xlsx`;
    return {
      archivo: data,
      nombreArchivo: nombreDeDescarga(
        (headers as Record<string, unknown> | undefined)?.["content-disposition"],
        fallback,
      ),
    };
  } catch (error) {
    throw await leerErrorDelBlob(error);
  }
}
