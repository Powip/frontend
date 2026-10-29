export type PartnerResourceKind = "VIDEO" | "PDF" | "LOGOS";

export interface PartnerResource {
  id: string;
  title: string;
  description: string | null;
  kind: PartnerResourceKind;
  category: string;
  downloadUrl: string | null;
}
