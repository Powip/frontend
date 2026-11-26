import type { EnvironmentProfile } from "./profile";

/**
 * Local frontend and local ms-integrations (the Olva integration is not deployed yet), on top of
 * the deployed Railway services. Those services are shared with production, so isolation comes
 * from the dedicated test company (`E2E_COMPANY_ID`), enforced by the environment guard.
 *
 * When ms-integrations is deployed, point `integrations` at it and `startFrontend` stays true
 * until the Olva UI is on a deployed frontend.
 */
export const hybrid = {
  name: "hybrid",
  frontendUrl: "http://localhost:3000",
  allowedFrontendHosts: ["localhost:3000"],
  startFrontend: true,
  apis: {
    productos: "https://ms-products-production-37a7.up.railway.app",
    companies: "https://ms-company-production.up.railway.app",
    ventas: "https://ms-ventas-production-ce8a.up.railway.app",
    courier: "https://ms-courier-production.up.railway.app",
    inventory: "https://ms-logistics-production.up.railway.app",
    users: "https://ms-auth-production-71c9.up.railway.app/api/v1",
    subs: "https://ms-subscription-production-7771.up.railway.app/api/v1",
    integrations: "http://localhost:3007",
    sunat: "https://ms-sunat-tax-documents-production.up.railway.app",
  },
} as const satisfies EnvironmentProfile;
