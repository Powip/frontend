import type { PartnerResource } from "../models/partner-resource";

export const PARTNER_RESOURCES_MOCK: PartnerResource[] = [
  { id: "res-logos", title: "Logos POWIP", description: "PNG · SVG", kind: "logos" },
  { id: "res-playbook", title: "Playbook de partner", description: "Cómo cerrar", kind: "playbook" },
  {
    id: "res-templates",
    title: "Plantillas de mensajes",
    description: "Con tu link y código",
    kind: "templates",
  },
];
