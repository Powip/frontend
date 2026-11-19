// Piezas comunes de los PDF que se imprimen desde Facturación (notas de crédito).
// Antes vivían en imprimir-guia-pdf.ts, que FEAT-24 H12 retiró con la guía mock.

export interface PrintIssuer {
  ruc: string;
  razonSocial: string;
  direccion?: string;
}

export function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Iniciales del emisor para el recuadro del logo (como en la boleta). */
export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join("") || "G"
  );
}
