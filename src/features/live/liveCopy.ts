/**
 * FEAT-33 A2: copia un texto al portapapeles.
 * 1. `navigator.clipboard.writeText` (https y permiso del navegador).
 * 2. Si no existe o el navegador lo niega (http, iframe, Safari viejo): textarea oculto +
 *    `document.execCommand("copy")`.
 * 3. Si los dos fallan responde "manual": la pantalla muestra el texto seleccionado.
 */
export type LiveCopyResult = "copied" | "manual";

export async function copyLiveText(text: string): Promise<LiveCopyResult> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return "copied";
    }
  } catch {
    // Se intenta el método alternativo.
  }
  return execCommandCopy(text) ? "copied" : "manual";
}

function execCommandCopy(text: string): boolean {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "0";
  area.style.left = "0";
  area.style.opacity = "0";
  document.body.appendChild(area);
  try {
    area.focus();
    area.select();
    area.setSelectionRange(0, text.length);
    return document.execCommand("copy") === true;
  } catch {
    return false;
  } finally {
    area.remove();
  }
}
