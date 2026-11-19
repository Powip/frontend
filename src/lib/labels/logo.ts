// FEAT-24 H7 — el logo de la empresa como data URL para jsPDF. Si no se puede leer (CORS, red, formato), `null`:
// la etiqueta lleva el nombre de la empresa en su lugar.

export async function loadImageAsDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!/^image\/(png|jpe?g)$/i.test(blob.type)) return null;
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
