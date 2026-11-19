// FEAT-24 H7 — etiquetas de producto. Mismas listas que ms-products (`src/labels/label-format.constants.ts`).

export const LABEL_FIELDS = [
  "logo",
  "store",
  "brand",
  "name",
  "variant",
  "sku",
  "location",
  "lot",
  "price",
  "barcode",
  "qr",
] as const;
export type LabelField = (typeof LABEL_FIELDS)[number];

export const LABEL_FIELD_NAMES: Record<LabelField, string> = {
  logo: "Logo",
  store: "Tienda",
  brand: "Marca",
  name: "Nombre del producto",
  variant: "Variante",
  sku: "SKU",
  location: "Ubicación",
  lot: "Lote y vencimiento",
  price: "Precio",
  barcode: "Código de barras",
  qr: "QR",
};

/** Tamaños permitidos (ancho × alto en mm). */
export const LABEL_SIZES: ReadonlyArray<readonly [number, number]> = [
  [50, 25],
  [40, 30],
  [50, 50],
  [60, 40],
  [100, 50],
];

export type LabelOutput = "termica" | "a4";
export const LABEL_OUTPUT_NAMES: Record<LabelOutput, string> = {
  termica: "Térmica (rollo)",
  a4: "Hoja A4",
};

export type LabelCodeType = "EAN13" | "CODE128";

/** Tope de etiquetas por impresión (igual que el backend). */
export const MAX_LABELS_PER_PRINT = 2000;

/** Lo que define cómo se ve una etiqueta (lo guardado o el borrador del editor). */
export interface LabelFormatShape {
  name: string;
  widthMm: number;
  heightMm: number;
  output: LabelOutput;
  fields: LabelField[];
}

export interface LabelFormat extends LabelFormatShape {
  id: string;
  priceSource: "price_vta";
  isDefault: boolean;
}

/** Una línea de `POST /labels/data`: una variante con su cantidad, sin costo. */
export interface LabelLine {
  variantId: string;
  productId: string;
  quantity: number;
  name: string;
  variant: string | null;
  sku: string;
  qrText: string;
  code: string;
  codeType: LabelCodeType;
  brand: string | null;
  store: string | null;
  location: string | null;
  lot: string | null;
  price: number | null;
}

/** Datos de ejemplo de la vista previa del editor. */
export const SAMPLE_LABEL_LINE: LabelLine = {
  variantId: "muestra",
  productId: "muestra",
  quantity: 1,
  name: "Polo básico de algodón",
  variant: "M / Negro",
  sku: "POLO-M-NEG",
  qrText: "POLO-M-NEG",
  code: "7750123400012",
  codeType: "EAN13",
  brand: "Mi marca",
  store: "Mi tienda",
  location: "A-01",
  lot: "Lote L2408 · vence 30/08/2027",
  price: 59.9,
};

export const isLabelSize = (widthMm: number, heightMm: number) =>
  LABEL_SIZES.some(([w, h]) => w === widthMm && h === heightMm);

/** Copias de una línea: entero ≥ 0 (lo que no es número cuenta 0). */
export const labelCount = (quantity: number) => (Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0);

export const hasScanField = (fields: readonly LabelField[]) => fields.includes("barcode") || fields.includes("qr");
