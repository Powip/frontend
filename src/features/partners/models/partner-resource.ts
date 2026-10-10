export type PartnerResourceKind = "logos" | "playbook" | "templates";

export interface PartnerResource {
  id: string;
  title: string;
  description: string;
  kind: PartnerResourceKind;
}
