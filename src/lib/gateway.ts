const GW = (
  process.env.NEXT_PUBLIC_API_GATEWAY || "http://localhost:8083"
).replace(/\/$/, "");

export const GATEWAY = {
  auth: `${GW}/users`,
  company: `${GW}/company`,
  ventas: `${GW}/ventas`,
  products: `${GW}/products`,
  logistics: `${GW}/logistics`,
  courier: `${GW}/courier`,
  subscription: `${GW}/subscription`,
  subscriptionFlow: `${GW}/subscription-flow`,
  clients: `${GW}/clients`,
  integrations: `${GW}/integrations`,
} as const;
